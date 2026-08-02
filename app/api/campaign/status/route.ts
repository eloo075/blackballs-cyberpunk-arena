import { NextRequest, NextResponse } from 'next/server';
import { getCampaignStatus } from '@/lib/launch-campaign-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const status = await getCampaignStatus(address ?? undefined);
  return NextResponse.json(status);
}
