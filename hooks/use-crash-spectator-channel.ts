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
const SHAME_TOAST_MS = 1800;
const FAME_TOAST_MS = 2600;

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

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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
      const id = `fame-${event.id}`;
      const toast: SpectatorToast = {
        id,
        kind: 'fame',
        title: 'FAME',
        body: `${event.player} +${profit.toFixed(0)} @ ${event.multiplier.toFixed(2)}x`,
      };
      setToasts(t => [...t.filter(x => x.kind !== 'fame'), toast]);
      window.setTimeout(() => dismissToast(id), FAME_TOAST_MS);
    } else if (isHallOfShame(event)) {
      const id = `shame-${event.id}`;
      const toast: SpectatorToast = {
        id,
        kind: 'shame',
        title: 'SHAME',
        body: `${event.player} rekt @ ${event.multiplier.toFixed(2)}x`,
      };
      setToasts(t => [...t.filter(x => x.kind !== 'shame'), toast]);
      window.setTimeout(() => dismissToast(id), SHAME_TOAST_MS);
    }
  }, [dismissToast]);

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

  return {
    events,
    toasts,
    dismissToast,
    realtimeEnabled,
    isGoldHighlight,
  };
}
