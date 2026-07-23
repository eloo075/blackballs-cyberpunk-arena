'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CRASH_GAME_CHANNEL,
  isGoldHighlight,
  isHallOfFame,
  isHallOfShame,
  type CrashSpectatorEvent,
} from '@/lib/crash-spectator-types';
import { getSupabaseBrowser, isSupabaseRealtimeConfigured } from '@/lib/supabase/client';

const MAX_EVENTS = 40;

export interface SpectatorToast {
  id: string;
  kind: 'fame' | 'shame';
  title: string;
  body: string;
}

function parseSpectatorEvent(payload: unknown): CrashSpectatorEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Partial<CrashSpectatorEvent>;
  if (
    typeof p.id !== 'string' ||
    typeof p.type !== 'string' ||
    typeof p.player !== 'string' ||
    typeof p.amount !== 'number' ||
    typeof p.multiplier !== 'number' ||
    typeof p.ts !== 'number'
  ) {
    return null;
  }
  return p as CrashSpectatorEvent;
}

export function useCrashSpectatorChannel() {
  const [events, setEvents] = useState<CrashSpectatorEvent[]>([]);
  const [toasts, setToasts] = useState<SpectatorToast[]>([]);
  const seenIds = useRef(new Set<string>());
  const realtimeEnabled = isSupabaseRealtimeConfigured();

  const pushEvent = useCallback((event: CrashSpectatorEvent) => {
    if (seenIds.current.has(event.id)) return;
    seenIds.current.add(event.id);
    if (seenIds.current.size > 200) {
      const oldest = seenIds.current.values().next().value;
      if (oldest) seenIds.current.delete(oldest);
    }

    setEvents(prev => [event, ...prev].slice(0, MAX_EVENTS));

    if (isHallOfFame(event)) {
      const profit = event.pnl ?? event.payout ?? 0;
      setToasts(t => [
        ...t,
        {
          id: `fame-${event.id}`,
          kind: 'fame',
          title: 'HALL OF FAME',
          body: `${event.player} cashed +${profit.toFixed(0)} $BlackBalls @ ${event.multiplier.toFixed(2)}x`,
        },
      ]);
    } else if (isHallOfShame(event)) {
      setToasts(t => [
        ...t,
        {
          id: `shame-${event.id}`,
          kind: 'shame',
          title: 'HALL OF SHAME',
          body: `${event.player} liquidated instantly @ ${event.multiplier.toFixed(2)}x`,
        },
      ]);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (!realtimeEnabled) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const channel = supabase
      .channel(CRASH_GAME_CHANNEL)
      .on('broadcast', { event: 'crash_event' }, ({ payload }) => {
        const event = parseSpectatorEvent(payload);
        if (event) pushEvent(event);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [realtimeEnabled, pushEvent]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 5200);
    return () => clearTimeout(timer);
  }, [toasts]);

  return {
    events,
    toasts,
    dismissToast,
    realtimeEnabled,
    isGoldHighlight,
  };
}
