'use client';

import { useEffect } from 'react';
import { captureReferralFromUrl } from '@/hooks/use-referral-capture';

/** Persist ?ref=CODE from landing URL before wallet connect. */
export function ReferralUrlCapture() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return null;
}
