import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import { processSettlement } from '@/lib/chain/crash-vault-client';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const manager = getManager();
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const percent = parseFloat(body.percent ?? '1');

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }
  if (isNaN(percent) || percent <= 0 || percent > 1) {
    return NextResponse.json({ ok: false, error: 'invalid percent' }, { status: 400 });
  }

  const before = manager.getPositionDebug(address);
  const result = manager.cashOut(address, percent);

  if (!result.ok) {
    console.warn('[crash/cashout] rejected', {
      address: `${address.slice(0, 10)}...${address.slice(-4)}`,
      percent,
      before,
      error: result.error,
    });
    return NextResponse.json(result, { status: 400 });
  }

  console.info('[crash/cashout] ok', {
    address: `${address.slice(0, 10)}...${address.slice(-4)}`,
    percent,
    action: result.action,
    exitPrice: result.exitPrice,
  });

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

  return NextResponse.json({ ...result, chain });
}
