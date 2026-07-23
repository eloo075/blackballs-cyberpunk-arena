'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { FeedEvent } from '@/lib/crash-types';
import {
  isGoldHighlight,
  spectatorEventLabel,
  type CrashSpectatorEvent,
} from '@/lib/crash-spectator-types';
import { useCrashSpectator } from '@/components/crash-spectator-provider';

interface LiveActivityFeedProps {
  /** Local SSE feed fallback when Supabase Realtime is not configured. */
  fallbackFeed?: FeedEvent[];
}

function feedEventToSpectator(e: FeedEvent): CrashSpectatorEvent {
  const isOpen = e.delta < 0;
  const isLiquidation = e.kind === 'rug' && e.price <= 1.01 && e.delta <= -e.amount * 0.99;
  let type: CrashSpectatorEvent['type'] = 'rug';
  if (isLiquidation) type = 'liquidation';
  else if (e.kind === 'rug') type = 'rug';
  else if (isOpen) type = 'player_joined';
  else type = 'cash_out';

  return {
    id: `local-${e.id}`,
    type,
    player: e.user,
    amount: e.amount,
    multiplier: e.price,
    side: e.kind === 'sell' ? 'sell' : e.kind === 'buy' ? 'buy' : undefined,
    pnl: e.delta,
    payout: e.delta > 0 ? e.delta : undefined,
    ts: e.t,
  };
}

function EventRow({ event }: { event: CrashSpectatorEvent }) {
  const gold = isGoldHighlight(event);
  const profit = event.pnl ?? event.payout ?? 0;

  const typeColor =
    event.type === 'player_joined'
      ? 'text-cp-cyan'
      : event.type === 'cash_out'
        ? 'text-cp-green'
        : event.type === 'liquidation'
          ? 'text-cp-magenta'
          : 'text-cp-yellow';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-center justify-between gap-1 text-[10px] py-1 border-b border-white/5 ${
        gold ? 'bg-cp-yellow/5 -mx-1 px-1 rounded' : ''
      }`}
    >
      <span className={`truncate max-w-[72px] ${gold ? 'text-cp-yellow font-bold' : 'text-white/50'}`}>
        {event.player}
      </span>
      <span className={`font-bold shrink-0 ${gold ? 'text-cp-yellow' : typeColor}`}>
        {gold && '★ '}
        {spectatorEventLabel(event)}
        {(event.leverage ?? 0) > 1 ? ` · ${event.leverage}x` : ''}
      </span>
      <span
        className={`font-bold shrink-0 tabular-nums ${
          profit >= 0 ? (gold ? 'text-cp-yellow' : 'text-cp-green') : 'text-cp-magenta'
        }`}
      >
        {profit >= 0 && profit !== 0 ? '+' : ''}
        {profit !== 0 ? profit.toFixed(1) : '—'}
      </span>
    </motion.div>
  );
}

export function LiveActivityFeed({ fallbackFeed = [] }: LiveActivityFeedProps) {
  const { events, realtimeEnabled } = useCrashSpectator();

  const displayEvents: CrashSpectatorEvent[] =
    events.length > 0
      ? events
      : fallbackFeed.map(feedEventToSpectator).slice(0, 30);

  return (
    <div className="p-3 font-mono h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] neon-magenta">
          LIVE_FEED
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${realtimeEnabled ? 'bg-cp-green cp-pulse' : 'bg-white/30'}`}
          />
          <span className="text-[8px] text-white/35 uppercase">
            {realtimeEnabled ? 'REALTIME' : 'LOCAL'}
          </span>
        </div>
      </div>

      <div className="space-y-0.5 flex-1 min-h-[140px] max-h-[220px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {displayEvents.length === 0 && (
            <div className="text-[10px] text-white/30">// AWAITING_SPECTATORS...</div>
          )}
          {displayEvents.map(event => (
            <EventRow key={event.id} event={event} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
