'use client';

import { useMemo } from 'react';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { computeHistoryStats } from '@/lib/crash-engine';
import type { RoundSummary } from '@/lib/crash-types';

interface CrashStatsPanelProps {
  history: RoundSummary[];
}

export function CrashStatsPanel({ history }: CrashStatsPanelProps) {
  const stats = useMemo(() => computeHistoryStats(history.slice(0, 100)), [history]);

  const volumeEst = useMemo(() => {
    return history.slice(0, 100).reduce((s, r) => s + r.crashPoint * 12.5, 0);
  }, [history]);

  return (
    <div className="cp-panel p-3 font-arcade">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm font-extrabold text-white/80">Public Stats</div>
        <div className="text-[10px] font-extrabold text-sky-400/80 uppercase tracking-wide">Last 100</div>
      </div>
      {stats.count === 0 ? (
        <div className="text-xs text-white/35 font-bold">Collecting rounds…</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl bg-[#1f2025] border border-white/5 p-2">
            <div className="text-white/40 font-bold">Avg mult</div>
            <div className="text-emerald-400 font-extrabold tabular-nums">{stats.avgMult.toFixed(2)}x</div>
          </div>
          <div className="rounded-xl bg-[#1f2025] border border-white/5 p-2">
            <div className="text-white/40 font-bold">Rug rate</div>
            <div className="text-rose-400 font-extrabold tabular-nums">{stats.rugPct.toFixed(1)}%</div>
          </div>
          <div className="rounded-xl bg-[#1f2025] border border-white/5 p-2">
            <div className="text-white/40 font-bold">Biggest</div>
            <div className="text-violet-400 font-extrabold tabular-nums">{stats.biggest.toFixed(2)}x</div>
          </div>
          <div className="rounded-xl bg-[#1f2025] border border-white/5 p-2">
            <div className="text-white/40 font-bold">Est. volume</div>
            <div className="text-amber-300 font-extrabold tabular-nums">{volumeEst.toFixed(0)} {CURRENCY_LABEL}</div>
          </div>
        </div>
      )}
      <div className="mt-2 text-[10px] text-white/35 font-bold">
        ~3% house edge · 3% instant rugs · max 40x · provably fair
      </div>
    </div>
  );
}
