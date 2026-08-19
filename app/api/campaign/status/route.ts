import { NextRequest, NextResponse } from 'next/server';
import { getCampaignStatus } from '@/lib/launch-campaign-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');
    const status = await getCampaignStatus(address ?? undefined);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Campaign status unavailable';
    console.error('[campaign/status]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
