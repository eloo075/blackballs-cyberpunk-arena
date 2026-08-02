import { NextRequest, NextResponse } from 'next/server';
import { getFlipManager } from '@/lib/flip-manager';
import type { FlipSide } from '@/lib/flip-engine';
import { normalizeDemoSessionBalance } from '@/lib/session-balance';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
    console.warn('[flip/join] 400 invalid amount', { address, amount, raw: body.amount });
    return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 400 });
  }

  const manager = getFlipManager();
  const normalizedBalance =
    !isNaN(clientBalance) && clientBalance >= 0
      ? normalizeDemoSessionBalance(address, clientBalance, isRealWallet)
      : null;

  // Demo: boot-sync before every join — clears stale lobbies / zero server balance.
  if (!isRealWallet && normalizedBalance != null) {
    manager.syncPlayer(address, normalizedBalance, holdsBlackballs, { boot: true });
  } else if (normalizedBalance != null) {
    manager.syncPlayer(address, normalizedBalance, holdsBlackballs, { boot: false });
  }

  const before = manager.getFullState(address);

  if (mode === 'dogpile') {
    const result = manager.joinDogpile(address, side as FlipSide, amount, message);
    if (!result.ok) {
      console.warn('[flip/join] 400 dogpile rejected', {
        address,
        side,
        amount,
        serverBalance: before.player?.balance,
        active1v1Id: before.player?.active1v1Id,
        error: result.error,
      });
      return NextResponse.json(result, { status: 400 });
    }
    const state = manager.getFullState(address);
    return NextResponse.json({ ok: true, balance: state.player?.balance });
  }

  if (matchId) {
    const result = manager.join1v1(address, matchId, message);
    if (!result.ok) {
      console.warn('[flip/join] 400 join1v1 rejected', {
        address,
        matchId,
        amount,
        serverBalance: before.player?.balance,
        active1v1Id: before.player?.active1v1Id,
        error: result.error,
      });
      return NextResponse.json(result, { status: 400 });
    }
    const state = manager.getFullState(address);
    const activeMatch =
      state.active1v1?.id === result.matchId ? state.active1v1 : null;
    return NextResponse.json({
      ...result,
      balance: state.player?.balance,
      waitingMatch: state.open1v1.find(m => m.id === result.matchId) ?? null,
      activeMatch,
    });
  }

  const result = manager.createOrJoin1v1(address, side as FlipSide, amount, message);
  if (!result.ok) {
    console.warn('[flip/join] 400 create rejected', {
      address,
      side,
      amount,
      serverBalance: before.player?.balance,
      active1v1Id: before.player?.active1v1Id,
      error: result.error,
    });
    return NextResponse.json(result, { status: 400 });
  }
  const state = manager.getFullState(address);
  const activeMatch =
    state.active1v1?.id === result.matchId ? state.active1v1 : null;
  return NextResponse.json({
    ...result,
    balance: state.player?.balance,
    waitingMatch: state.open1v1.find(m => m.id === result.matchId) ?? null,
    activeMatch,
  });
}
