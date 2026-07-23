import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import { isVaultEnabled, processSettlement, verifyEscrowForWager } from '@/lib/chain/crash-vault-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const manager = getManager();
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const side = body.side === 'sell' ? 'sell' : 'buy';
  const amount = parseFloat(body.amount);
  const leverage = parseFloat(body.leverage ?? '1');

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 400 });
  }

  const player = manager.getFullState(address);
  const isClose = player.hasPosition && player.positionSide !== side;

  if (!isClose && isVaultEnabled()) {
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
    return NextResponse.json(result, { status: 400 });
  }

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
