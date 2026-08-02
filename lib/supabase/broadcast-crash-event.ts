import 'server-only';

import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import { isLaunchCampaignLocked } from '@/lib/launch-campaign';
import {
  CRASH_GAME_CHANNEL,
  type CrashSpectatorEvent,
} from '@/lib/crash-spectator-types';

/** Fire-and-forget broadcast to Supabase Realtime (server-side). */
export function broadcastCrashEvent(event: CrashSpectatorEvent): void {
  if (isLaunchCampaignLocked() || !isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  void supabase
    .channel(CRASH_GAME_CHANNEL)
    .httpSend('crash_event', event)
    .catch(() => {
      /* spectator feed is best-effort */
    });
}
