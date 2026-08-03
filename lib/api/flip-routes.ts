import { NextRequest, NextResponse } from 'next/server';
import { getFlipManager } from '@/lib/flip-manager';
import type { FlipSide } from '@/lib/flip-engine';
import { verifyFlipRound } from '@/lib/flip-engine';
import {
  fromTokenWei,
  getSessionBalance,
  isVaultEnabled,
} from '@/lib/chain/crash-vault-client';
import { normalizeDemoSessionBalance } from '@/lib/session-balance';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';
import {
  ensureFlipStateSynced,
  loadAndApplyFlipEngineSnapshot,
  loadAndApplyFlipPlayerSnapshot,
  maybePersistFlipEngineSnapshot,
  persistFlipEngineSnapshot,
  persistFlipPlayerSnapshot,
} from '@/lib/supabase/flip-state-store';

export async function handleState(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const manager = getFlipManager();
  await ensureFlipStateSynced(manager, address);
  return NextResponse.json(manager.getFullState(address));
}

export async function handleStream(req: NextRequest) {
  const manager = getFlipManager();
  const address = req.nextUrl.searchParams.get('address');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let hydrateTimer: ReturnType<typeof setInterval> | null = null;

      void (async () => {
        await loadAndApplyFlipEngineSnapshot(manager);
        if (address) await loadAndApplyFlipPlayerSnapshot(manager, address);
        send(manager.getFullState(address));
      })();

      const unsub = manager.subscribe(address, s => {
        send(s);
        maybePersistFlipEngineSnapshot(manager);
      });

      if (address) {
        hydrateTimer = setInterval(() => {
          void loadAndApplyFlipPlayerSnapshot(manager, address);
        }, 1000);
      }

      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
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
          /* closed */
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

export async function handleSession(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const balance = parseFloat(body.balance);
  const holdsBlackballs = body.holdsBlackballs === true;
  const boot = body.boot === true;
  const isRealWallet = body.isRealWallet === true;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }

  let syncedBalance = !isNaN(balance) && balance >= 0 ? balance : 0;

  if (isVaultEnabled() && address.startsWith('0x')) {
    try {
      const onChain = await getSessionBalance(address);
      syncedBalance = fromTokenWei(onChain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'vault read failed';
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
  } else if (isNaN(balance) || balance < 0) {
    return NextResponse.json({ ok: false, error: 'invalid balance' }, { status: 400 });
  } else {
    syncedBalance = normalizeDemoSessionBalance(address, syncedBalance, isRealWallet);
  }

  const manager = getFlipManager();
  await ensureFlipStateSynced(manager, address);

  const finalBalance = manager.syncPlayer(address, syncedBalance, holdsBlackballs, { boot });

  void persistFlipPlayerSnapshot(manager, address);

  return NextResponse.json({ ok: true, balance: finalBalance, vaultSynced: isVaultEnabled() });
}

export async function handleJoin(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const mode = body.mode === 'dogpile' ? 'dogpile' : '1v1';
  const side = body.side === 'tails' ? 'tails' : 'heads';
  const amount = parseFloat(body.amount);
  const message = typeof body.message === 'string' ? body.message.slice(0, 80) : undefined;
  const matchId = typeof body.matchId === 'string' ? body.matchId : undefined;
  const clientBalance = parseFloat(body.balance);
  const holdsBlackballs = body.holdsBlackballs === true;
  const isRealWallet = body.isRealWallet === true;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 400 });
  }

  const manager = getFlipManager();
  await ensureFlipStateSynced(manager, address);

  const normalizedBalance =
    !isNaN(clientBalance) && clientBalance >= 0
      ? normalizeDemoSessionBalance(address, clientBalance, isRealWallet)
      : null;

  if (!isRealWallet && normalizedBalance != null) {
    manager.syncPlayer(address, normalizedBalance, holdsBlackballs, { boot: true });
  } else if (normalizedBalance != null) {
    manager.syncPlayer(address, normalizedBalance, holdsBlackballs, { boot: false });
  }

  if (mode === 'dogpile') {
    const result = manager.joinDogpile(address, side as FlipSide, amount, message);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    const state = manager.getFullState(address);
    void persistFlipPlayerSnapshot(manager, address);
    void persistFlipEngineSnapshot(manager);
    return NextResponse.json({ ok: true, balance: state.player?.balance });
  }

  if (matchId) {
    const result = manager.join1v1(address, matchId, message);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    const state = manager.getFullState(address);
    void persistFlipPlayerSnapshot(manager, address);
    void persistFlipEngineSnapshot(manager);
    const activeMatch = state.active1v1?.id === result.matchId ? state.active1v1 : null;
    return NextResponse.json({
      ...result,
      balance: state.player?.balance,
      waitingMatch: state.open1v1.find(m => m.id === result.matchId) ?? null,
      activeMatch,
    });
  }

  const result = manager.createOrJoin1v1(address, side as FlipSide, amount, message);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  const state = manager.getFullState(address);
  void persistFlipPlayerSnapshot(manager, address);
  void persistFlipEngineSnapshot(manager);
  const activeMatch = state.active1v1?.id === result.matchId ? state.active1v1 : null;
  return NextResponse.json({
    ...result,
    balance: state.player?.balance,
    waitingMatch: state.open1v1.find(m => m.id === result.matchId) ?? null,
    activeMatch,
  });
}

export async function handleCancel(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }

  const manager = getFlipManager();
  await ensureFlipStateSynced(manager, address);

  const result = manager.cancel1v1(address);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  const state = manager.getFullState(address);
  void persistFlipPlayerSnapshot(manager, address);
  void persistFlipEngineSnapshot(manager);
  return NextResponse.json({ ok: true, balance: state.player?.balance });
}

export async function handleRevenge(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const wager = body.wager != null ? parseFloat(body.wager) : undefined;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }

  const result = getFlipManager().revenge(address, wager);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  const state = getFlipManager().getFullState(address);
  return NextResponse.json({ ...result, balance: state.player?.balance });
}

export async function handleVerify(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const serverSeed = typeof body.serverSeed === 'string' ? body.serverSeed : '';
  const serverSeedHash = typeof body.serverSeedHash === 'string' ? body.serverSeedHash : '';
  const clientSeed = typeof body.clientSeed === 'string' ? body.clientSeed : '';
  const nonce = parseInt(body.nonce, 10);
  const expectedSide = body.expectedSide === 'tails' ? 'tails' : 'heads';

  if (!serverSeed || !serverSeedHash || !clientSeed || !Number.isFinite(nonce)) {
    return NextResponse.json({ valid: false, reason: 'invalid payload' }, { status: 400 });
  }

  const result = verifyFlipRound({
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    expectedSide: expectedSide as FlipSide,
  });

  return NextResponse.json(result, { status: result.valid ? 200 : 400 });
}
