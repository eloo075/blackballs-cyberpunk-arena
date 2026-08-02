import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import { assertGameNotCampaignLocked } from '@/lib/launch-campaign-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ ok: false, error: 'wallet not connected', message: 'wallet not connected' }, { status: 401 });
  }

  const manager = getManager();
  const result = manager.cancelCountdownEntry(address);

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

  return NextResponse.json({
    ok: true,
    balance: result.balance,
    action: result.action ?? 'close',
    exitPrice: result.exitPrice,
    message: 'Position cancelled',
    view: manager.clientPlayerView(address),
  });
}
