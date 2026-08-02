import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import { isOnChainPlayer, isVaultEnabled, processSettlement, verifyEscrowForWager } from '@/lib/chain/crash-vault-client';
import { normalizeDemoSessionBalance } from '@/lib/session-balance';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const manager = getManager();
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

  const debugBefore = manager.getPositionDebug(address);

  if (!isNaN(clientBalance) && clientBalance >= 0) {
    manager.syncPlayer(
      address,
      normalizeDemoSessionBalance(address, clientBalance, isRealWallet),
      undefined,
      { boot: false },
    );
  }

  const clearedReason = manager.preparePlayerForEnter(address);
  const debugAfterPrepare = manager.getPositionDebug(address);

  if (isNaN(amount) || amount <= 0) {
    console.warn('[crash/enter] 400 invalid amount', { address, amount, raw: body.amount });
    return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 400 });
  }

  const snapshot = manager.getFullState(address);
  const phase = snapshot.phase;

  if (phase !== 'waiting') {
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

  if (sameSidePending || sameSidePosition) {
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
      message: `already entered ${side === 'buy' ? 'long' : 'short'} this countdown — waiting for round start`,
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

  return NextResponse.json({ ...result, chain });
}
