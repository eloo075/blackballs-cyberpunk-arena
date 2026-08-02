import { NextRequest, NextResponse } from 'next/server';
import { getFlipManager } from '@/lib/flip-manager';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
