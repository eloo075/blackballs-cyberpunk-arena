'use client';

import { useEffect, useRef, useState } from 'react';
import { DEMO_REFILL_BB } from '@/lib/demo-credits';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { formatBetTokens } from '@/lib/bet-sizing';

interface CrashMobileHeaderProps {
  blackballsBalance: number;
  solBalance: number;
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  waitLeft: number;
  roundId: number;
  isDemoWallet: boolean;
  onDemoRefill?: () => void;
}

export function CrashMobileHeader({
  blackballsBalance,
  solBalance,
  phase,
  mult,
  waitLeft,
  roundId,
  isDemoWallet,
  onDemoRefill,
}: CrashMobileHeaderProps) {
  const prevRef = useRef(blackballsBalance);
  const [tickClass, setTickClass] = useState('');

  useEffect(() => {
    const prev = prevRef.current;
    if (Math.abs(blackballsBalance - prev) < 0.0005) return;
    setTickClass(blackballsBalance > prev ? 'balance-tick-up' : 'balance-tick-down');
    prevRef.current = blackballsBalance;
    const t = window.setTimeout(() => setTickClass(''), 480);
    return () => window.clearTimeout(t);
  }, [blackballsBalance]);

  const phaseLabel =
    phase === 'waiting'
      ? `${waitLeft.toFixed(1)}s`
      : phase === 'running'
        ? `${mult.toFixed(2)}x`
        : 'RUGGED';

  const phaseClass =
    phase === 'waiting'
      ? 'text-white'
      : phase === 'running'
        ? 'text-emerald-400'
        : 'text-rose-400';

  return (
    <div className="sm:hidden shrink-0 rounded-md border border-white/[0.06] bg-[#12141a] px-1.5 py-0.5 font-arcade">
      <div className="flex items-center justify-between gap-1.5">
        <div className="min-w-0 flex items-baseline gap-1">
          <span
            className={`text-[13px] font-extrabold tabular-nums leading-none text-amber-300 ${tickClass}`}
            style={{ textShadow: '0 0 12px rgba(251,191,36,0.28)' }}
          >
            {formatBetTokens(blackballsBalance)}
          </span>
          <span className="text-[9px] font-extrabold text-amber-200/90">{CURRENCY_LABEL}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="text-right leading-none">
            <span className="text-[7px] font-bold text-white/35 uppercase">#{roundId}</span>
            <span className={`ml-1 text-[12px] font-extrabold tabular-nums ${phaseClass}`}>
              {phaseLabel}
            </span>
          </div>
          {isDemoWallet && onDemoRefill ? (
            <button
              type="button"
              onClick={onDemoRefill}
              className="touch-manipulation min-h-[22px] px-1.5 py-0.5 text-[8px] font-extrabold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            >
              +{DEMO_REFILL_BB}
            </button>
          ) : null}
        </div>
      </div>
      <div className="sr-only">{solBalance.toFixed(2)} SOL</div>
    </div>
  );
}
