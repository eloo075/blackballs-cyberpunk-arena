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
    <div className="cp-panel p-3 font-arcade">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm font-extrabold text-white/80">Last 100</div>
        {history.length > 0 && (
          <div className="text-[11px] text-white/40 flex gap-2 font-bold">
            <span>avg {avg.toFixed(2)}x</span>
            <span className="text-rose-400">{rugs} rugs</span>
            <span className="text-violet-400">{moons} moon</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto">
        {history.length === 0 && <div className="text-xs text-white/35 font-bold">No rounds yet</div>}
        {history.map(r => {
          const tier = crashTier(r.crashPoint);
          const color = CRASH_TIER_COLOR[tier];
          return (
            <motion.div
              key={`${r.id}-${r.ts}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-2 py-1 text-[11px] font-extrabold rounded-full shrink-0 bg-[#2a2c33]"
              style={{ color }}
              title={`Round #${r.id} · ${r.crashPoint.toFixed(2)}x · ${tier.toUpperCase()}`}
            >
              {r.crashPoint.toFixed(2)}x
            </motion.div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/35 font-bold">
        <span style={{ color: CRASH_TIER_COLOR.rug }}>≤1x</span>
        <span style={{ color: CRASH_TIER_COLOR.low }}>1-3x</span>
        <span style={{ color: CRASH_TIER_COLOR.mid }}>3-9x</span>
        <span style={{ color: CRASH_TIER_COLOR.high }}>9-20x</span>
        <span style={{ color: CRASH_TIER_COLOR.moon }}>20x+</span>
      </div>
    </div>
  );
}
