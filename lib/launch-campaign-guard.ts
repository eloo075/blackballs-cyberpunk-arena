import { NextResponse } from 'next/server';
import { isLaunchCampaignLocked } from '@/lib/launch-campaign';

const CAMPAIGN_BLOCK_MESSAGE =
  'Game is locked during the First 500 launch campaign. Submit your wallet on the homepage.';

export function launchCampaignBlockedResponse() {
  return NextResponse.json(
    { ok: false, error: CAMPAIGN_BLOCK_MESSAGE, campaignLocked: true },
    { status: 403 },
  );
}

export function assertGameNotCampaignLocked(): NextResponse | null {
  if (isLaunchCampaignLocked()) {
    return launchCampaignBlockedResponse();
  }
  return null;
}
