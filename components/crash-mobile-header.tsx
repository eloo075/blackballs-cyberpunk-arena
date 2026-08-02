'use client';

import { DEMO_REFILL_BB } from '@/lib/demo-credits';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { formatBetTokens } from '@/lib/bet-sizing';
import { useTokenUsd } from '@/hooks/use-token-usd';

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
  const { formatUsd } = useTokenUsd();
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
    <div className="sm:hidden cp-panel px-3 py-3 font-arcade bg-gradient-to-r from-[#1f2025] via-[#252018] to-[#1f2025] border-amber-500/15">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-white/45 uppercase tracking-wider">Balance</div>
          <div className="mt-1 inline-flex flex-col rounded-xl bg-amber-400/10 border border-amber-400/30 px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-extrabold tabular-nums leading-none text-amber-300"
                style={{ textShadow: '0 0 20px rgba(251,191,36,0.35)' }}
              >
                {formatBetTokens(blackballsBalance)}
              </span>
              <span className="text-sm font-extrabold text-amber-200/90">{CURRENCY_LABEL}</span>
            </div>
            <div className="text-[11px] font-bold text-white/45 mt-0.5 tabular-nums">
              ≈ {formatUsd(blackballsBalance)}
            </div>
            <div className="text-sm font-bold text-sky-300/90 mt-1.5 tabular-nums">
              {solBalance.toFixed(2)} SOL
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 pt-1">
          <div className="text-[9px] font-bold text-white/35 uppercase">Round #{roundId}</div>
          <div
            className={`text-3xl font-extrabold tabular-nums leading-none mt-0.5 ${phaseClass}`}
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
          >
            {phaseLabel}
          </div>
          <div className="text-[9px] font-bold text-white/35 mt-0.5">
            {phase === 'waiting' ? 'Countdown' : phase === 'running' ? 'Live mult' : 'Crashed'}
          </div>
        </div>
      </div>

      {isDemoWallet && onDemoRefill && (
        <button
          type="button"
          onClick={onDemoRefill}
          className="mt-2.5 w-full touch-manipulation min-h-[38px] px-3 py-1.5 text-xs font-extrabold rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 active:bg-emerald-500/30"
        >
          +{DEMO_REFILL_BB} Demo {CURRENCY_LABEL}
        </button>
      )}
    </div>
  );
}
