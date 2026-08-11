'use client';

import type { RoundSummary } from '@/lib/crash-types';

function pillClass(mult: number): string {
  if (mult >= 5) return 'bg-amber-400/20 text-amber-300 border-amber-400/35';
  if (mult >= 1.5) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  return 'bg-white/5 text-white/45 border-white/10';
}

/** Horizontal last-N multiplier reel for mobile — above the chart. */
export function CrashMobileHistoryReel({ history }: { history: RoundSummary[] }) {
  const recent = history.slice(0, 32);

  if (recent.length === 0) {
    return (
      <div className="md:hidden flex items-center gap-1.5 py-1 px-2 text-[10px] font-bold text-white/35">
        Waiting for round history…
      </div>
    );
  }

  return (
    <div
      className="md:hidden flex overflow-x-auto mobile-scroll-x gap-1.5 py-1 px-2"
      aria-label="Recent multipliers"
    >
      {recent.map(r => (
        <span
          key={`${r.id}-${r.ts}`}
          title={`Round #${r.id}`}
          className={`shrink-0 px-2 py-1 rounded-full border text-[10px] font-black tabular-nums leading-none ${pillClass(r.crashPoint)}`}
        >
          {r.crashPoint.toFixed(2)}x
        </span>
      ))}
    </div>
  );
}
