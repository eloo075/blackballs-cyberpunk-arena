'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedEvent } from '@/lib/crash-types';

export function DegenFeed({ feed }: { feed: FeedEvent[] }) {
  return (
    <div className="p-3 font-mono">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] neon-magenta mb-2">DEGEN_FEED</div>
      <div className="space-y-0.5 min-h-[140px] max-h-[200px] overflow-y-auto pr-1">
        <AnimatePresence>
          {feed.length === 0 && <div className="text-[10px] text-white/30">// AWAITING_TRADES...</div>}
          {feed.map(e => (
            <motion.div key={e.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-between text-[10px] py-0.5">
              <span className="text-white/50">{e.user}</span>
              <span className={
                e.kind === 'buy' ? 'text-cp-green' :
                e.kind === 'sell' ? 'text-cp-magenta' :
                e.kind === 'cashout' ? 'text-cp-yellow' : 'text-cp-magenta'
              }>
                {e.kind === 'buy' ? 'BUY' : e.kind === 'sell' ? 'SELL' : e.kind === 'cashout' ? 'CASHOUT' : 'RUG'} {e.amount.toFixed(2)}@{e.price.toFixed(2)}x
              </span>
              <span className={`font-bold ${e.delta >= 0 ? 'text-cp-green' : 'text-cp-magenta'}`}>{e.delta >= 0 ? '+' : ''}{e.delta.toFixed(2)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
