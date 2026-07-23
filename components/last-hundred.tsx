'use client';
import { motion } from 'framer-motion';
import { CRASH_TIER_COLOR, crashTier } from '@/lib/crash-engine';
import type { RoundSummary } from '@/lib/crash-types';

export function LastHundred({ history }: { history: RoundSummary[] }) {
  const avg =
    history.length > 0
      ? history.reduce((s, r) => s + r.crashPoint, 0) / history.length
      : 0;
  const moons = history.filter(r => r.crashPoint >= 20).length;
  const rugs = history.filter(r => r.crashPoint <= 1.01).length;

  return (
    <div className="cp-panel p-2 font-mono">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] neon-cyan">LAST_100</div>
        {history.length > 0 && (
          <div className="text-[8px] text-white/35 flex gap-2">
            <span>avg {avg.toFixed(2)}x</span>
            <span className="text-cp-magenta">{rugs} rugs</span>
            <span className="text-cp-purple">{moons} moon</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1 max-h-[88px] overflow-y-auto">
        {history.length === 0 && <div className="text-[9px] text-white/30">// NO_ROUNDS_YET</div>}
        {history.map(r => {
          const tier = crashTier(r.crashPoint);
          const color = CRASH_TIER_COLOR[tier];
          return (
            <motion.div
              key={`${r.id}-${r.ts}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-1.5 py-0.5 text-[8px] font-bold border shrink-0"
              style={{ color, borderColor: color + '44', background: color + '11' }}
              title={`Round #${r.id} · ${r.crashPoint.toFixed(2)}x · ${tier.toUpperCase()}`}
            >
              {r.crashPoint.toFixed(2)}x
            </motion.div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2 text-[7px] text-white/25 uppercase tracking-wider">
        <span style={{ color: CRASH_TIER_COLOR.rug }}>≤1x</span>
        <span style={{ color: CRASH_TIER_COLOR.low }}>1-3x</span>
        <span style={{ color: CRASH_TIER_COLOR.mid }}>3-9x</span>
        <span style={{ color: CRASH_TIER_COLOR.high }}>9-20x</span>
        <span style={{ color: CRASH_TIER_COLOR.moon }}>20x+</span>
      </div>
    </div>
  );
}
