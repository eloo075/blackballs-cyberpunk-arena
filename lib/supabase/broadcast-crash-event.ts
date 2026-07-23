import 'server-only';

import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  CRASH_GAME_CHANNEL,
  type CrashSpectatorEvent,
} from '@/lib/crash-spectator-types';

/** Fire-and-forget broadcast to Supabase Realtime (server-side). */
export function broadcastCrashEvent(event: CrashSpectatorEvent): void {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  void supabase.channel(CRASH_GAME_CHANNEL).send({
    type: 'broadcast',
    event: 'crash_event',
    payload: event,
  });
}
