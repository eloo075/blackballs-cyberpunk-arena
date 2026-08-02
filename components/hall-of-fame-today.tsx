'use client';

import { useEffect, useState } from 'react';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { loadHallOfFameToday, type HallOfFameEntry } from '@/lib/player-retention';

export function HallOfFameToday() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);

  useEffect(() => {
    setEntries(loadHallOfFameToday());
    const id = setInterval(() => setEntries(loadHallOfFameToday()), 5000);
    return () => clearInterval(id);
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="cp-panel p-3 font-arcade">
      <div className="text-sm font-extrabold text-amber-300 mb-2">🏆 Biggest Wins Today</div>
      <div className="space-y-1">
        {entries.slice(0, 5).map((e, i) => (
          <div key={e.id} className="flex justify-between text-[11px] font-bold">
            <span className="text-white/60 truncate max-w-[120px]">
              {i + 1}. {e.player}
            </span>
            <span className="text-emerald-400 tabular-nums">
              +{e.profit.toFixed(0)} {CURRENCY_LABEL} @ {e.multiplier.toFixed(2)}x
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
