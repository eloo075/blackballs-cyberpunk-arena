'use client';
import { motion } from 'framer-motion';
import { CRASH_TIER_COLOR } from '@/lib/crash-engine';
import { RoundSparkThumb } from '@/components/round-spark-thumb';
import type { RoundSummary } from '@/lib/crash-types';

export function LastHundred({ history }: { history: RoundSummary[] }) {
  const avg =
    history.length > 0
      ? history.reduce((s, r) => s + r.crashPoint, 0) / history.length
      : 0;
  const moons = history.filter(r => r.crashPoint >= 20).length;
  const rugs = history.filter(r => r.crashPoint <= 1.01).length;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] p-3 font-arcade">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/70">
          Last 100
        </div>
        {history.length > 0 && (
          <div className="text-[10px] text-white/35 flex gap-2 font-bold">
            <span>avg {avg.toFixed(2)}x</span>
            <span className="text-rose-400">{rugs} rugs</span>
            <span className="text-violet-400">{moons} moon</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-[148px] overflow-y-auto pr-0.5">
        {history.length === 0 && (
          <div className="text-xs text-white/35 font-bold py-4 w-full text-center">No rounds yet</div>
        )}
        {history.map(r => (
          <motion.div
            key={`${r.id}-${r.ts}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <RoundSparkThumb round={r} />
          </motion.div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2 text-[9px] text-white/30 font-bold uppercase tracking-wide">
        <span style={{ color: CRASH_TIER_COLOR.rug }}>≤1x</span>
        <span style={{ color: CRASH_TIER_COLOR.low }}>1-3x</span>
        <span style={{ color: CRASH_TIER_COLOR.mid }}>3-9x</span>
        <span style={{ color: CRASH_TIER_COLOR.high }}>9-20x</span>
        <span style={{ color: CRASH_TIER_COLOR.moon }}>20x+</span>
      </div>
    </div>
  );
}
