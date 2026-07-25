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

/** Placeholder meme avatar slot — swap for Pepe/Wojak images later. */
function MemeAvatar({ player }: { player: string }) {
  const hue = player.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-8 h-8 rounded-full shrink-0 bg-gray-700 border border-white/10 flex items-center justify-center text-[10px] font-extrabold text-white/50 overflow-hidden"
      style={{ background: `hsl(${hue} 18% 32%)` }}
      aria-hidden
    >
      {player.slice(0, 2).toUpperCase()}
    </div>
  );
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
      ? 'text-sky-400'
      : event.type === 'cash_out'
        ? 'text-emerald-400'
        : event.type === 'liquidation'
          ? 'text-rose-400'
          : 'text-amber-300';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-start gap-2 py-2 border-b border-white/5 ${
        gold ? 'bg-amber-400/5 -mx-1 px-1 rounded-xl' : ''
      }`}
    >
      <MemeAvatar player={event.player} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-xs font-extrabold ${gold ? 'text-amber-300' : 'text-white/70'}`}>
            {event.player}
          </span>
          <span
            className={`font-extrabold shrink-0 text-[11px] tabular-nums ${
              profit >= 0 ? (gold ? 'text-amber-300' : 'text-emerald-400') : 'text-rose-400'
            }`}
          >
            {profit >= 0 && profit !== 0 ? '+' : ''}
            {profit !== 0 ? profit.toFixed(1) : '—'}
          </span>
        </div>
        <div className={`text-[11px] font-bold mt-0.5 ${gold ? 'text-amber-300' : typeColor}`}>
          {gold && '★ '}
          {spectatorEventLabel(event)}
          {(event.leverage ?? 0) > 1 ? ` · ${event.leverage}x` : ''}
        </div>
      </div>
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
    <div className="p-4 font-arcade h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-extrabold text-white/80">Live Chat</div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2a2c33] border border-white/5 text-[11px] font-bold text-white/70">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Online (87)
          </span>
          <span
            className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full ${
              realtimeEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/40'
            }`}
          >
            {realtimeEnabled ? 'Live' : 'Local'}
          </span>
        </div>
      </div>

      <div className="space-y-0.5 flex-1 min-h-[140px] max-h-[220px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {displayEvents.length === 0 && (
            <div className="text-xs text-white/35 font-bold py-4 text-center">Waiting for degens…</div>
          )}
          {displayEvents.map(event => (
            <EventRow key={event.id} event={event} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
