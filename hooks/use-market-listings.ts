'use client';
import { useEffect, useState, useCallback } from 'react';
import type { MarketListing } from '@/lib/market-types';

export function useMarketListings() {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastOk, setLastOk] = useState<boolean | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/market-listings', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setListings(data.listings ?? []);
      setLastOk(true);
      setLastUpdate(Date.now());
    } catch {
      setLastOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 12000);
    return () => clearInterval(id);
  }, [poll]);

  return { listings, loading, lastOk, lastUpdate };
}
