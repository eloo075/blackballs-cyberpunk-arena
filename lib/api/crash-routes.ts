import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import {
  ensureCrashStateSynced,
  loadAndApplyEngineSnapshot,
  loadAndApplyPlayerSnapshot,
  maybePersistEngineSnapshot,
  persistPlayerSnapshot,
  flushPendingSettlements,
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
import { DEMO_REWARDS_MODE } from '@/lib/launch-surface';
import { isEvmWalletAddress, normalizeWalletAddress } from '@/lib/demo-rewards';
import { ensureDemoAccount, applyDailyRefill, nextRefillAtIso } from '@/lib/supabase/demo-account-store';
import { getLeaderboard } from '@/lib/supabase/crash-leaderboard-store';
import { clientIp, clientUserAgent } from '@/lib/request-meta';
import { DEMO_REFILL_ELIGIBLE_BELOW } from '@/lib/demo-credits';

function parseWalletAddress(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  if (DEMO_REWARDS_MODE) {
    return isEvmWalletAddress(raw) ? normalizeWalletAddress(raw) : null;
  }
  return raw.trim();
}

export async function handleStream(req: NextRequest) {
  const address = parseWalletAddress(req.nextUrl.searchParams.get('address'));
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
  const address = parseWalletAddress(req.nextUrl.searchParams.get('address'));
  const manager = getManager(address);
  await ensureCrashStateSynced(manager, address);
  return NextResponse.json(manager.snapshotForStream(address));
}

export async function handleSession(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = parseWalletAddress(body.address);
  const stimmy = parseFloat(body.stimmy);
  const frenzy = parseFloat(body.frenzy);

  if (!address) {
    return NextResponse.json(
      { ok: false, error: DEMO_REWARDS_MODE ? 'Connect a wallet to play' : 'wallet not connected' },
      { status: 401 },
    );
  }

  if (DEMO_REWARDS_MODE) {
    try {
      const ensured = await ensureDemoAccount(address, {
        ip: clientIp(req),
        userAgent: clientUserAgent(req),
      });
      if (!ensured.ok) {
        return NextResponse.json({ ok: false, error: ensured.error }, { status: ensured.status });
      }

      const manager = getManager(address);
      await ensureCrashStateSynced(manager, address);
      manager.hydrateDemoBalance(address, ensured.account.balance);
      await persistPlayerSnapshot(manager, address);
      const view = manager.clientPlayerView(address);
      const nextRefill = nextRefillAtIso(ensured.account.lastRefillAt);
      return NextResponse.json({
        ok: true,
        balance: view.balance,
        view,
        account: {
          roundsPlayed: ensured.account.roundsPlayed,
          wins: ensured.account.wins,
          bestMultiplier: ensured.account.bestMultiplier,
          createdAt: ensured.account.createdAt,
        },
        refill: {
          eligibleBelow: DEMO_REFILL_ELIGIBLE_BELOW,
          nextRefillAt: nextRefill,
          available: view.balance <= DEMO_REFILL_ELIGIBLE_BELOW && (!nextRefill || Date.now() >= new Date(nextRefill).getTime()),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'account unavailable';
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
  }

  const balance = parseFloat(body.balance);
  const boot = body.boot === true;
  const isRealWallet = body.isRealWallet === true;

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
  const address = parseWalletAddress(body.address);
  const side = body.side === 'sell' ? 'sell' : 'buy';
  const amount = parseFloat(body.amount);
  const leverage = parseFloat(body.leverage ?? '1');
  const clientBalance = parseFloat(body.balance);
  const isRealWallet = body.isRealWallet === true;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }

  const manager = getManager(address);
  const clientView = DEMO_REWARDS_MODE ? null : parseClientView(body);
  await ensureCrashStateSynced(manager, address, clientView);

  const debugBefore = manager.getPositionDebug(address);

  if (!DEMO_REWARDS_MODE && Number.isFinite(clientBalance) && clientBalance >= 0) {
    manager.syncPlayer(
      address,
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
  void flushPendingSettlements(manager);

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
    parseWalletAddress(body.address) ?? parseWalletAddress(body.walletAddress);

  if (!address) {
    return NextResponse.json(
      { ok: false, error: 'wallet not connected', message: 'wallet not connected' },
      { status: 401 },
    );
  }

  const manager = getManager(address);
  const clientView = DEMO_REWARDS_MODE ? null : parseClientView(body);
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
  void flushPendingSettlements(manager);

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
  const address = parseWalletAddress(body.address);
  const percent = parseFloat(body.percent ?? '1');

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent > 1) {
    return NextResponse.json({ ok: false, error: 'invalid percent' }, { status: 400 });
  }

  const manager = getManager(address);
  const clientView = DEMO_REWARDS_MODE ? null : parseClientView(body);
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
  void flushPendingSettlements(manager);

  return NextResponse.json({ ...result, chain, view: manager.clientPlayerView(address) });
}

export async function handleAuto(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address = parseWalletAddress(body.address);
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

export async function handleRefill(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = parseWalletAddress(body.address);
  if (!address) {
    return NextResponse.json({ ok: false, error: 'Connect a wallet to claim credits' }, { status: 401 });
  }

  try {
    const ensured = await ensureDemoAccount(address, {
      ip: clientIp(req),
      userAgent: clientUserAgent(req),
    });
    if (!ensured.ok) {
      return NextResponse.json({ ok: false, error: ensured.error }, { status: ensured.status });
    }

    const manager = getManager(address);
    await ensureCrashStateSynced(manager, address);
    manager.hydrateDemoBalance(address, ensured.account.balance);
    const view = manager.clientPlayerView(address);
    if (view.hasPosition || view.entryPending) {
      return NextResponse.json(
        { ok: false, error: 'Finish or cancel your position before refilling.' },
        { status: 400 },
      );
    }

    // Starting-grant / empty-account backfill already put credits on the account.
    if (view.balance > DEMO_REFILL_ELIGIBLE_BELOW) {
      await persistPlayerSnapshot(manager, address);
      return NextResponse.json({
        ok: true,
        balance: view.balance,
        nextRefillAt: nextRefillAtIso(ensured.account.lastRefillAt),
        view: manager.clientPlayerView(address),
      });
    }

    const result = await applyDailyRefill(address, view.balance);
    if (!result.ok) {
      return NextResponse.json(result, { status: result.status });
    }

    manager.hydrateDemoBalance(address, result.balance);
    manager.syncPlayer(address, result.balance, undefined, { boot: true });
    await persistPlayerSnapshot(manager, address);
    return NextResponse.json({
      ok: true,
      balance: result.balance,
      nextRefillAt: result.nextRefillAt,
      view: manager.clientPlayerView(address),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'refill unavailable';
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function handleLeaderboard(req: NextRequest) {
  const address = parseWalletAddress(req.nextUrl.searchParams.get('address'));
  try {
    const board = await getLeaderboard(address);
    return NextResponse.json(board);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'leaderboard unavailable';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
