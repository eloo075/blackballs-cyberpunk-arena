'use client';

import { useEffect, useState } from 'react';
import { FALLBACK_USD_PER_TOKEN, formatBetUsd, tokensToUsd, usdToTokens } from '@/lib/bet-sizing';

export function useTokenUsd() {
  const [usdPerToken, setUsdPerToken] = useState(FALLBACK_USD_PER_TOKEN);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/market-listings');
        if (!res.ok) return;
        const data = await res.json();
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const bb = listings.find(
          (l: { symbol?: string; name?: string }) => {
            const sym = l.symbol?.toUpperCase() ?? '';
            const name = l.name?.toUpperCase() ?? '';
            return sym.includes('BLACKBALL') || name.includes('BLACKBALL');
          },
        );
        const price = parseFloat(bb?.price ?? '0');
        if (!cancelled && price > 0) setUsdPerToken(price);
      } catch {
        /* keep fallback */
      }
    };
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const formatUsd = (tokens: number) => formatBetUsd(tokensToUsd(tokens, usdPerToken));

  const tokensFromUsd = (usd: number) => usdToTokens(usd, usdPerToken);

  return { usdPerToken, formatUsd, tokensFromUsd };
}
