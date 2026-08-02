'use client';

import { BetAmountInput } from '@/components/bet-amount-input';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { useTokenUsd } from '@/hooks/use-token-usd';
import {
  BET_USD_PRESETS,
  betAmountDecimals,
  clampBetToBalance,
  formatBetTokens,
  formatBetUsd,
  formatUsdPreset,
  tokensToUsd,
  usdToTokens,
} from '@/lib/bet-sizing';

const PERCENTS = [10, 25, 50, 100];

interface WagerAmountPanelProps {
  amount: number;
  onAmountChange: (value: number) => void;
  balance: number;
  disabled?: boolean;
  /** When set, amount is derived from balance × percent. */
  percent?: number;
  onPercentChange?: (percent: number) => void;
  showPercentButtons?: boolean;
  showBalanceHint?: boolean;
  inputClassName?: string;
}

export function WagerAmountPanel({
  amount,
  onAmountChange,
  balance,
  disabled = false,
  percent = 0,
  onPercentChange,
  showPercentButtons = false,
  showBalanceHint = false,
  inputClassName = 'flex-1 min-w-0 bg-transparent text-xl sm:text-3xl font-extrabold text-white outline-none disabled:opacity-50 tabular-nums placeholder:text-white/20',
}: WagerAmountPanelProps) {
  const { usdPerToken } = useTokenUsd();
  const decimals = betAmountDecimals(usdPerToken);
  const usdValue = tokensToUsd(amount, usdPerToken);

  const setTokens = (tokens: number) => {
    onPercentChange?.(0);
    onAmountChange(clampBetToBalance(parseFloat(Math.max(0, tokens).toFixed(decimals)), balance));
  };

  const bumpUsd = (usd: number) => {
    const added = usdToTokens(usd, usdPerToken);
    setTokens(parseFloat((amount + added).toFixed(decimals)));
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
        <span className="text-xs font-extrabold text-white/80">💰 Wager</span>
        {showBalanceHint && (
          <span className="hidden sm:inline text-[11px] text-white/45">
            Balance{' '}
            <span className="text-sky-400 font-extrabold">{formatBetTokens(balance)}</span> {CURRENCY_LABEL}
            <span className="text-white/35"> · {formatBetUsd(tokensToUsd(balance, usdPerToken))}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-white/10 bg-[#1f2025]">
        <BetAmountInput
          value={amount}
          onChange={v => {
            onPercentChange?.(0);
            onAmountChange(clampBetToBalance(v, balance));
          }}
          max={balance}
          decimals={decimals}
          disabled={disabled}
          placeholder="0"
          aria-label={`Wager amount in ${CURRENCY_LABEL}`}
          className={inputClassName}
        />
        <div className="flex flex-col items-end shrink-0 min-w-0">
          <span className="text-[10px] sm:text-xs font-extrabold text-amber-300/90">{CURRENCY_LABEL}</span>
          <span className="text-[10px] font-bold text-white/40 tabular-nums">
            ≈ {formatBetUsd(usdValue)}
          </span>
        </div>
      </div>

      {percent > 0 && (
        <div className="text-[10px] sm:text-[11px] text-sky-400 mb-1.5 sm:mb-2 text-center font-bold">
          {percent}% = {formatBetTokens(amount)} {CURRENCY_LABEL}
          <span className="text-white/40"> · {formatBetUsd(usdValue)}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1 sm:gap-1.5">
        {BET_USD_PRESETS.map(usd => (
          <button
            key={usd}
            type="button"
            onClick={() => bumpUsd(usd)}
            disabled={disabled}
            title={`Add ${formatUsdPreset(usd)} (~${formatBetTokens(usdToTokens(usd, usdPerToken))} ${CURRENCY_LABEL})`}
            className="flex-1 min-w-[52px] min-h-[30px] sm:min-h-[32px] rounded-lg text-[10px] sm:text-[11px] font-extrabold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-emerald-300/90 border border-emerald-500/20 hover:bg-[#353842]"
          >
            +{formatUsdPreset(usd)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTokens(amount / 2)}
          disabled={disabled}
          className="min-w-[36px] min-h-[30px] sm:min-h-[32px] rounded-lg text-[11px] sm:text-xs font-bold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-white/60 border border-white/10 hover:bg-[#353842]"
        >
          ½
        </button>
        <button
          type="button"
          onClick={() => setTokens(amount * 2)}
          disabled={disabled}
          className="min-w-[36px] min-h-[30px] sm:min-h-[32px] rounded-lg text-[11px] sm:text-xs font-bold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-white/60 border border-white/10 hover:bg-[#353842]"
        >
          2×
        </button>
        <button
          type="button"
          onClick={() => setTokens(balance)}
          disabled={disabled}
          className="min-w-[44px] min-h-[30px] sm:min-h-[32px] rounded-lg text-[11px] sm:text-xs font-extrabold touch-manipulation disabled:opacity-30 bg-amber-400 text-black border-b-2 border-amber-600 hover:bg-amber-300"
        >
          MAX
        </button>
        {showPercentButtons &&
          onPercentChange &&
          PERCENTS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onPercentChange(p)}
              disabled={disabled}
              className={`hidden sm:flex flex-1 min-h-[36px] rounded-lg text-xs font-extrabold touch-manipulation disabled:opacity-30 ${
                percent === p
                  ? 'bg-sky-500 text-white border-b-[3px] border-sky-700'
                  : 'bg-[#2a2c33] text-white/55 border border-white/10 hover:bg-[#353842]'
              }`}
            >
              {p}%
            </button>
          ))}
      </div>
    </>
  );
}
