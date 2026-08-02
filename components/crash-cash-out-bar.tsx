'use client';

import { useState } from 'react';

const CASH_OUT_PCTS = [0.25, 0.5, 0.75, 1] as const;

interface CrashCashOutBarProps {
  mult: number;
  positionSide: 'buy' | 'sell';
  positionPnl: number;
  positionPct: number;
  onCashOut: (percent: number) => Promise<{ ok: boolean; error?: string }>;
}

export function CrashCashOutBar({
  mult,
  positionSide,
  positionPnl,
  positionPct,
  onCashOut,
}: CrashCashOutBarProps) {
  const [cashOutPct, setCashOutPct] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCashOut = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onCashOut(cashOutPct);
      if (!result.ok) setError(result.error ?? 'Cash-out failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cp-panel shrink-0 flex-none px-3 py-2.5 sm:px-4 sm:py-3 border-emerald-500/25 bg-emerald-500/10 font-arcade">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-xs sm:text-sm font-extrabold text-emerald-300">
            CASH OUT @ {mult.toFixed(2)}x
          </div>
          <div className="text-[10px] sm:text-xs text-white/50 font-bold mt-0.5">
            {positionSide === 'buy' ? 'LONG' : 'SHORT'} ·{' '}
            <span className={positionPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {positionPnl >= 0 ? '+' : ''}
              {positionPnl.toFixed(3)} ({positionPct >= 0 ? '+' : ''}
              {positionPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 mb-2">
        {CASH_OUT_PCTS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setCashOutPct(p)}
            disabled={busy}
            className={`flex-1 min-h-[36px] rounded-lg text-[11px] sm:text-xs font-extrabold touch-manipulation ${
              cashOutPct === p
                ? 'bg-emerald-500 text-white border-b-2 border-emerald-700'
                : 'bg-[#2a2c33] text-white/55 border border-white/10'
            }`}
          >
            {p * 100}%
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleCashOut}
        disabled={busy}
        className={`w-full touch-manipulation min-h-[48px] py-2.5 text-sm font-black rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all ${
          busy
            ? 'bg-[#2a2c33] text-white/40 border-white/10 cursor-not-allowed'
            : 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-700'
        }`}
      >
        {busy
          ? 'CASHING OUT…'
          : cashOutPct >= 1
            ? 'CASH OUT 100%'
            : `PARTIAL CASH OUT ${cashOutPct * 100}%`}
      </button>
      {error && (
        <div className="mt-2 text-[11px] font-bold text-rose-300 text-center">{error}</div>
      )}
    </div>
  );
}
