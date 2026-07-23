'use client';

import { useEffect } from 'react';

export const REFERRAL_STORAGE_KEY = 'bb_referral_code';

export function captureReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (!ref) return null;
  const code = ref.trim().toUpperCase();
  localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  return code;
}

export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

export function clearStoredReferralCode() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}

/** Bind stored ?ref= code to wallet once connected. */
export function useReferralCapture(address: string | undefined) {
  useEffect(() => {
    if (!address?.startsWith('0x')) return;
    const ref = getStoredReferralCode();
    if (!ref) return;

    void fetch('/api/referrals/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, ref }),
    })
      .then(async res => {
        if (res.ok) clearStoredReferralCode();
      })
      .catch(() => {
        /* retry on next connect */
      });
  }, [address]);
}
