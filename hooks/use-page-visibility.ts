'use client';

import { useEffect, useState } from 'react';

/** True when the browser tab is visible AND the in-app game tab is active. */
export function usePageVisibility(appVisible = true): boolean {
  const [docVisible, setDocVisible] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setDocVisible(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return appVisible && docVisible;
}

export function isLikelyMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
