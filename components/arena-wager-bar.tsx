'use client';

import { WAGER_MAX, WAGER_MIN, WAGER_OPTIONS } from '@/lib/competitive';
import { BetAmountInput } from '@/components/bet-amount-input';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { formatBetUsd, tokensToUsd } from '@/lib/bet-sizing';
import { useTokenUsd } from '@/hooks/use-token-usd';

interface ArenaWagerBarProps {
  wager: number;
  onWagerChange: (amount: number) => void;
  balance: number;
  disabled?: boolean;
}

export function ArenaWagerBar({ wager, onWagerChange, balance, disabled }: ArenaWagerBarProps) {
  const { usdPerToken } = useTokenUsd();
  const maxAffordable = Math.min(WAGER_MAX, balance);

  return (
    <div className="cp-panel px-3 py-2 mb-3 border border-cp-purple/30">
      <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2">
        Wager · Win = 2× back + loot · Lose = lose wager · {WAGER_MIN}–{WAGER_MAX} {CURRENCY_LABEL}
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {WAGER_OPTIONS.map(amount => {
          const active = wager === amount;
          const tooHigh = amount > balance;
          return (
            <button
              key={amount}
              type="button"
              disabled={disabled || (amount > 0 && tooHigh)}
              onClick={() => onWagerChange(amount)}
              className={`px-3 py-1.5 text-[10px] font-black border transition-all disabled:opacity-30 ${
                active ? 'bg-cp-purple/30 text-cp-purple border-cp-purple' : 'text-white/50 border-white/10 hover:border-cp-cyan/40'
              }`}
            >
              {amount === 0 ? (
                'NO BET'
              ) : (
                <>
                  {amount} {CURRENCY_LABEL}
                  <span className="block text-[9px] font-bold text-white/35 mt-0.5">
                    {formatBetUsd(tokensToUsd(amount, usdPerToken))}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 items-center px-3 py-2 rounded-xl border border-white/10 bg-[#1f2025]">
        <BetAmountInput
          value={wager}
          onChange={onWagerChange}
          min={WAGER_MIN}
          max={maxAffordable}
          decimals={0}
          disabled={disabled}
          placeholder={`Custom ${WAGER_MIN}-${WAGER_MAX}`}
          aria-label={`Custom wager in ${CURRENCY_LABEL}`}
          className="flex-1 min-w-0 bg-transparent text-lg font-extrabold text-white outline-none tabular-nums placeholder:text-white/25 disabled:opacity-50"
        />
        <div className="flex flex-col items-end shrink-0">
          <span className="text-[10px] font-bold text-white/45">{CURRENCY_LABEL}</span>
          {wager > 0 && (
            <span className="text-[9px] font-bold text-white/35 tabular-nums">
              ≈ {formatBetUsd(tokensToUsd(wager, usdPerToken))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
