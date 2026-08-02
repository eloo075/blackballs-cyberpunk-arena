import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const blocked = assertGameNotCampaignLocked();
  if (blocked) return blocked;

  const manager = getManager();
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const v = body.value != null ? parseFloat(body.value) : null;
  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }
  if (v != null && (isNaN(v) || v < 1.01)) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }
  manager.setAutoSell(address, v);
  return NextResponse.json({ ok: true });
}
