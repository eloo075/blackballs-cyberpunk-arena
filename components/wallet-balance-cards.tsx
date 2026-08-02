'use client';

import { CURRENCY_LABEL } from '@/lib/format-currency';
import { formatBetTokens } from '@/lib/bet-sizing';
import { useTokenUsd } from '@/hooks/use-token-usd';

interface WalletBalanceCardsProps {
  solBalance: number;
  blackballsBalance: number;
  /** Optional win streak suffix for desktop nav. */
  arenaWinStreak?: number;
  className?: string;
}

export function WalletBalanceCards({
  solBalance,
  blackballsBalance,
  arenaWinStreak = 0,
  className = '',
}: WalletBalanceCardsProps) {
  const { formatUsd } = useTokenUsd();

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <div className="rounded-xl border border-sky-500/25 bg-gradient-to-b from-sky-500/12 to-sky-500/5 px-3 py-1.5 min-w-[72px]">
        <div className="text-[9px] font-extrabold text-sky-300/75 uppercase tracking-wider">SOL</div>
        <div className="text-sm font-extrabold text-sky-100 tabular-nums leading-tight mt-0.5">
          {solBalance.toFixed(2)}
        </div>
      </div>

      <div className="rounded-xl border border-amber-400/35 bg-gradient-to-b from-amber-400/14 to-amber-400/5 px-3 py-1.5 min-w-[96px]">
        <div className="text-[9px] font-extrabold text-amber-300/80 uppercase tracking-wider">
          {CURRENCY_LABEL}
        </div>
        <div
          className="text-base font-extrabold text-amber-300 tabular-nums leading-tight mt-0.5"
          style={{ textShadow: '0 0 12px rgba(251,191,36,0.25)' }}
        >
          {formatBetTokens(blackballsBalance)}
        </div>
        <div className="text-[10px] font-bold text-white/40 tabular-nums mt-0.5">
          {formatUsd(blackballsBalance)}
          {arenaWinStreak >= 2 && (
            <span className="text-rose-400 font-extrabold ml-1.5">🔥{arenaWinStreak}</span>
          )}
        </div>
      </div>
    </div>
  );
}
