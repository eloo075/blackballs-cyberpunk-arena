'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardPayload } from '@/lib/crash-leaderboard-types';

export function useCrashLeaderboard(address: string | null) {
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const url = address
        ? `/api/crash/leaderboard?address=${encodeURIComponent(address)}`
        : '/api/crash/leaderboard';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Leaderboard unavailable');
      }
      setData((await res.json()) as LeaderboardPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Leaderboard unavailable');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { data, error, loading, refresh };
}

export function formatPeriodRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
