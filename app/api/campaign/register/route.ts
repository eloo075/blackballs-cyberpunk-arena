import { NextRequest, NextResponse } from 'next/server';
import { registerCampaignWallet } from '@/lib/launch-campaign-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await registerCampaignWallet(body.address);

  if (!result.ok) {
    return NextResponse.json(result, { status: result.full ? 409 : 400 });
  }

  return NextResponse.json(result);
}
