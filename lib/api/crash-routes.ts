import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import {
  ensureCrashStateSynced,
  loadAndApplyEngineSnapshot,
  loadAndApplyPlayerSnapshot,
  maybePersistEngineSnapshot,
  persistPlayerSnapshot,
  type CrashClientViewPayload,
} from '@/lib/supabase/crash-state-store';
import {
  fromTokenWei,
  getSessionBalance,
  isOnChainPlayer,
  isVaultEnabled,
  processSettlement,
  verifyEscrowForWager,
} from '@/lib/chain/crash-vault-client';
import { normalizeDemoSessionBalance } from '@/lib/session-balance';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';
import { verifyContinuousCrashRound, verifyCrashRound } from '@/lib/crash-engine';

export async function handleStream(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const manager = getManager(address);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      let hydrateTimer: ReturnType<typeof setInterval> | null = null;
      // Single-instance hosts (Fly) keep authoritative in-memory state — hydrating
      // from Supabase would overwrite live positions with stale rows (cashout flicker).
      const skipDbHydrate = process.env.SINGLE_INSTANCE_GAME === 'true';

      void (async () => {
        if (!skipDbHydrate) {
          await loadAndApplyEngineSnapshot(manager);
          if (address) await loadAndApplyPlayerSnapshot(manager, address);
        }
        send(manager.snapshotForStream(address));
      })();

      const unsub = manager.subscribe(address, s => {
        send(s);
        maybePersistEngineSnapshot(manager);
      });

      if (!skipDbHydrate) {
        hydrateTimer = setInterval(() => {
          void (async () => {
            const engineSynced = await loadAndApplyEngineSnapshot(manager);
            if (address) await loadAndApplyPlayerSnapshot(manager, address);
            if (engineSynced) {
              send(manager.snapshotForStream(address));
            }
          })();
        }, 1000);
      }

      // Tiny keepalive only — full snapshots already flow via manager.subscribe on each tick.
      // Re-sending the whole state every 4s doubled JSON work and helped hang the VM.
      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ka\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);
      req.signal.addEventListener('abort', () => {
        clearInterval(ka);
        if (hydrateTimer) clearInterval(hydrateTimer);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function handleState(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const manager = getManager(address);
  await ensureCrashStateSynced(manager, address);
  return NextResponse.json(manager.snapshotForStream(address));
}

export async function handleSession(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const balance = parseFloat(body.balance);
  const stimmy = parseFloat(body.stimmy);
  const frenzy = parseFloat(body.frenzy);
  const boot = body.boot === true;
  const isRealWallet = body.isRealWallet === true;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }

  let syncedBalance = Number.isFinite(balance) && balance >= 0 ? balance : 0;

  if (isVaultEnabled() && address.startsWith('0x')) {
    try {
      const onChain = await getSessionBalance(address);
      syncedBalance = fromTokenWei(onChain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'vault read failed';
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
  } else if (!Number.isFinite(balance) || balance < 0) {
    return NextResponse.json({ ok: false, error: 'invalid balance' }, { status: 400 });
  } else {
    // Boot / idle session may refill empty demo wallets; mid-round sync must keep 0.
    syncedBalance = normalizeDemoSessionBalance(address, syncedBalance, isRealWallet, {
      allowRefill: boot === true,
    });
  }

  const manager = getManager(address);
  await ensureCrashStateSynced(manager, address);

  const finalBalance = manager.syncPlayer(
    address,
    syncedBalance,
    {
      stimmy: Number.isFinite(stimmy) ? stimmy : 0,
      frenzy: Number.isFinite(frenzy) ? frenzy : 0,
    },
    { boot },
  );

  void persistPlayerSnapshot(manager, address);

  return NextResponse.json({
    ok: true,
    balance: finalBalance,
    view: manager.clientPlayerView(address),
    vaultSynced: isVaultEnabled(),
  });
}

function parseClientView(body: Record<string, unknown>): CrashClientViewPayload | null {
  const raw = body.clientView;
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as CrashClientViewPayload;
  return v;
}

export async function handleEnter(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const side = body.side === 'sell' ? 'sell' : 'buy';
  const amount = parseFloat(body.amount);
  const leverage = parseFloat(body.leverage ?? '1');
  const clientBalance = parseFloat(body.balance);
  const isRealWallet = body.isRealWallet === true;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }

  const manager = getManager(address);
  const clientView = parseClientView(body);
  await ensureCrashStateSynced(manager, address, clientView);

  const debugBefore = manager.getPositionDebug(address);

  if (Number.isFinite(clientBalance) && clientBalance >= 0) {
    manager.syncPlayer(
      address,
      // Never rewrite a true 0 into 100 on enter — that undid all-in / post-buy liquid.
      normalizeDemoSessionBalance(address, clientBalance, isRealWallet, { allowRefill: false }),
      undefined,
      { boot: false },
    );
  }

  const clearedReason = manager.preparePlayerForEnter(address);
  const debugAfterPrepare = manager.getPositionDebug(address);

  if (!Number.isFinite(amount) || amount <= 0) {
    console.warn('[crash/enter] 400 invalid amount', { address, amount, raw: body.amount });
    return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 400 });
  }

  if (!Number.isFinite(leverage)) {
    return NextResponse.json({ ok: false, error: 'invalid leverage' }, { status: 400 });
  }
  if (leverage < 1 || leverage > 5) {
    return NextResponse.json({ ok: false, error: 'leverage must be 1–5x' }, { status: 400 });
  }

  const snapshot = manager.getFullState(address);
  const phase = snapshot.phase;

  const liveContinuous = manager.mode === 'continuous' && phase === 'running';
  if (phase !== 'waiting' && !liveContinuous) {
    console.warn('[crash/enter] 400 wait for round', {
      address,
      phase,
      side,
      amount,
      leverage,
      debugBefore,
      debugAfterPrepare,
      clearedReason,
    });
    return NextResponse.json(
      { ok: false, error: 'wait for the next round', view: manager.clientPlayerView(address) },
      { status: 400 },
    );
  }

  const pending = debugAfterPrepare.pendingEntry;
  const sameSidePending =
    pending && pending.roundId === debugAfterPrepare.currentRoundId && pending.side === side;
  const sameSidePosition =
    debugAfterPrepare.hasPosition &&
    debugAfterPrepare.positionRoundId === debugAfterPrepare.currentRoundId &&
    debugAfterPrepare.positionSide === side;

  // Continuous live: same-side BUY stacks (average entry) — do not short-circuit.
  const continuousStackBuy =
    liveContinuous && side === 'buy' && sameSidePosition && !sameSidePending;

  if ((sameSidePending || sameSidePosition) && !continuousStackBuy) {
    const view = manager.clientPlayerView(address);
    console.info('[crash/enter] already entered (idempotent ok)', {
      address,
      side,
      reason: sameSidePending ? 'pending same side' : 'position same side',
    });
    return NextResponse.json({
      ok: true,
      action: 'open',
      balance: view.balance,
      message:
        phase === 'running'
          ? 'Long position already open'
          : 'Long entered this countdown — waiting for round start',
      view,
    });
  }

  const isClose =
    (pending && pending.roundId === debugAfterPrepare.currentRoundId && pending.side !== side) ||
    (snapshot.hasPosition && snapshot.positionSide !== side);

  if (!isClose && isVaultEnabled() && isOnChainPlayer(address)) {
    const escrow = await verifyEscrowForWager(address, amount);
    if (!escrow.ok) {
      return NextResponse.json(
        { ok: false, error: escrow.error, sessionBalance: escrow.sessionBalance },
        { status: 402 },
      );
    }
  }

  const result = manager.trade(address, side, amount, leverage);
  if (!result.ok) {
    console.warn('[crash/enter] 400 trade rejected', {
      address,
      side,
      amount,
      leverage,
      phase,
      debugBefore,
      debugAfterPrepare,
      clearedReason,
      debugAfterTrade: manager.getPositionDebug(address),
      error: result.error,
    });
    return NextResponse.json(result, { status: 400 });
  }

  console.info('[crash/enter] ok', {
    address,
    side,
    action: result.action,
    debugAfterTrade: manager.getPositionDebug(address),
  });

  let chain = null;
  if (result.settlement) {
    chain = await processSettlement(result.settlement);
    if (!chain.ok && !chain.skipped) {
      return NextResponse.json(
        {
          ...result,
          ok: false,
          error: chain.error ?? 'on-chain settlement failed',
          chain,
        },
        { status: 502 },
      );
    }
  }

  void persistPlayerSnapshot(manager, address);

  return NextResponse.json({
    ...result,
    chain,
    view: manager.clientPlayerView(address),
  });
}

export async function handleCancel(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address =
    typeof body.address === 'string'
      ? body.address
      : typeof body.walletAddress === 'string'
        ? body.walletAddress
        : null;

  if (!address) {
    return NextResponse.json(
      { ok: false, error: 'wallet not connected', message: 'wallet not connected' },
      { status: 401 },
    );
  }

  const manager = getManager(address);
  const clientView = parseClientView(body);
  await ensureCrashStateSynced(manager, address, clientView);

  let result = manager.cancelCountdownEntry(address);

  // Do NOT reconcile-then-retry cancel: recreating a ghost pending from a stale
  // clientView and refunding it was minting free BlackBalls after rug/cancel.

  if (!result.ok) {
    const view = manager.clientPlayerView(address);
    const alreadyClear = !view.hasPosition && !view.entryPending;
    if (alreadyClear) {
      return NextResponse.json({
        ok: true,
        balance: view.balance,
        action: 'close',
        message: 'Position already cleared',
        view,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? 'cancel failed',
        message: result.error ?? 'cancel failed',
        view,
      },
      { status: 400 },
    );
  }

  void persistPlayerSnapshot(manager, address);

  return NextResponse.json({
    ok: true,
    balance: result.balance,
    action: result.action ?? 'close',
    exitPrice: result.exitPrice,
    message: 'Position cancelled',
    view: manager.clientPlayerView(address),
  });
}

export async function handleCashout(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const percent = parseFloat(body.percent ?? '1');

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent > 1) {
    return NextResponse.json({ ok: false, error: 'invalid percent' }, { status: 400 });
  }

  const manager = getManager(address);
  const clientView = parseClientView(body);
  await ensureCrashStateSynced(manager, address, clientView);

  const before = manager.getPositionDebug(address);
  const result = manager.cashOut(address, percent);

  // No reconcile-then-retry: ghost rehydrate + cashout could credit returnAmount
  // without a real prepaid margin lock.

  if (!result.ok) {
    console.warn('[crash/cashout] rejected', {
      address: `${address.slice(0, 10)}...${address.slice(-4)}`,
      percent,
      before,
      error: result.error,
    });
    return NextResponse.json(result, { status: 400 });
  }

  let chain = null;
  if (result.settlement) {
    chain = await processSettlement(result.settlement);
    if (!chain.ok && !chain.skipped) {
      return NextResponse.json(
        { ...result, ok: false, error: chain.error ?? 'on-chain settlement failed', chain },
        { status: 502 },
      );
    }
  }

  void persistPlayerSnapshot(manager, address);

  return NextResponse.json({ ...result, chain, view: manager.clientPlayerView(address) });
}

export async function handleAuto(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const v = body.value != null ? parseFloat(body.value) : null;
  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }
  const manager = getManager(address);
  if (v != null && (isNaN(v) || v < 1.01)) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }
  manager.setAutoSell(address, v);
  return NextResponse.json({ ok: true });
}

export async function handleVerify(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const serverSeed = typeof body.serverSeed === 'string' ? body.serverSeed.trim() : '';
  const serverSeedHash = typeof body.serverSeedHash === 'string' ? body.serverSeedHash.trim() : '';
  const clientSeed = typeof body.clientSeed === 'string' ? body.clientSeed.trim() : '';
  const nonce = parseInt(body.nonce, 10);
  const expectedCrashPoint = parseFloat(body.expectedCrashPoint);
  const mode = body.mode === 'continuous' ? 'continuous' : 'classic';
  const expectedRugTick = parseInt(body.expectedRugTick, 10);

  if (
    !serverSeed ||
    !serverSeedHash ||
    !clientSeed ||
    !Number.isFinite(nonce) ||
    !Number.isFinite(expectedCrashPoint) ||
    (mode === 'continuous' && !Number.isFinite(expectedRugTick))
  ) {
    return NextResponse.json({ valid: false, reason: 'invalid payload' }, { status: 400 });
  }

  const result =
    mode === 'continuous'
      ? verifyContinuousCrashRound({
          serverSeed,
          serverSeedHash,
          nonce,
          expectedPeak: expectedCrashPoint,
          expectedRugTick,
        })
      : verifyCrashRound({
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          expectedCrashPoint,
        });

  return NextResponse.json(result, { status: 200 });
}
