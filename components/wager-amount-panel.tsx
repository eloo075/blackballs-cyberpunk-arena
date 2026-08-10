'use client';

import { BetAmountInput } from '@/components/bet-amount-input';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { useTokenUsd } from '@/hooks/use-token-usd';
import {
  BET_BB_PRESETS,
  betAmountDecimals,
  clampBetToBalance,
  formatBetTokens,
  formatBetUsd,
  tokensToUsd,
} from '@/lib/bet-sizing';

const PERCENTS = [10, 25, 50, 100];

interface WagerAmountPanelProps {
  amount: number;
  onAmountChange: (value: number) => void;
  onDraftChange?: (draft: string) => void;
  balance: number;
  disabled?: boolean;
  /** Red border + helper when wager can't open a trade (0 / starts with 0). */
  invalid?: boolean;
  invalidMessage?: string;
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
  onDraftChange,
  balance,
  disabled = false,
  invalid = false,
  invalidMessage = 'Place your amount',
  percent = 0,
  onPercentChange,
  showPercentButtons = false,
  showBalanceHint = false,
  inputClassName = 'flex-1 min-w-0 bg-transparent text-xl sm:text-3xl font-extrabold text-white outline-none disabled:opacity-50 tabular-nums placeholder:text-white/20',
}: WagerAmountPanelProps) {
  const { usdPerToken } = useTokenUsd();
  const decimals = betAmountDecimals(usdPerToken);
  const usdValue = tokensToUsd(amount, usdPerToken);

  const setTokensFree = (tokens: number) => {
    onPercentChange?.(0);
    onAmountChange(clampBetToBalance(Math.max(0, tokens), balance));
  };

  const setTokensMax = () => {
    onPercentChange?.(0);
    onAmountChange(clampBetToBalance(balance, balance));
  };

  const bumpBb = (bb: number) => {
    setTokensFree(parseFloat((amount + bb).toFixed(decimals)));
  };

  return (
    <>
      <div className="hidden sm:flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-extrabold text-white/80">💰 Wager</span>
        {showBalanceHint && (
          <span className="text-[11px] text-white/45">
            Balance{' '}
            <span className="text-sky-400 font-extrabold">{formatBetTokens(balance)}</span> {CURRENCY_LABEL}
            <span className="text-white/35"> · {formatBetUsd(tokensToUsd(balance, usdPerToken))}</span>
          </span>
        )}
      </div>

      <div
        className={`relative flex items-center gap-1.5 sm:gap-2 mb-1 px-2 py-0.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-[#1f2025] transition-colors ${
          invalid
            ? 'border-2 border-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_18px_rgba(244,63,94,0.25)]'
            : 'border border-white/10'
        }`}
      >
        {invalid && (
          <span
            className="pointer-events-none absolute -top-2 right-2 z-[1] rounded-md bg-rose-500 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_12px_rgba(244,63,94,0.55)]"
            aria-live="polite"
          >
            {invalidMessage}
          </span>
        )}
        <BetAmountInput
          value={amount}
          onChange={v => {
            onPercentChange?.(0);
            onAmountChange(v);
          }}
          onDraftChange={onDraftChange}
          clampToMax
          max={Number.isFinite(balance) && balance > 0 ? balance : 0}
          decimals={decimals}
          disabled={disabled}
          placeholder="0"
          aria-label={`Wager amount in ${CURRENCY_LABEL}`}
          className={`${inputClassName}${invalid ? ' text-rose-200 placeholder:text-rose-400/50' : ''}`}
        />
        <div className="flex flex-col items-end shrink-0 min-w-0">
          <span className={`text-[9px] sm:text-xs font-extrabold ${invalid ? 'text-rose-300' : 'text-amber-300/90'}`}>
            {CURRENCY_LABEL}
          </span>
          <span className="text-[9px] sm:text-[10px] font-bold text-white/40 tabular-nums">
            ≈ {formatBetUsd(usdValue)}
          </span>
        </div>
      </div>
      {invalid && (
        <div className="mb-1.5 text-[10px] sm:text-[11px] font-bold text-rose-400 hidden sm:block">
          Enter a wager above 0 to play.
        </div>
      )}

      {percent > 0 && (
        <div className="text-[10px] sm:text-[11px] text-sky-400 mb-1.5 sm:mb-2 text-center font-bold hidden sm:block">
          {percent}% = {formatBetTokens(amount)} {CURRENCY_LABEL}
          <span className="text-white/40"> · {formatBetUsd(usdValue)}</span>
        </div>
      )}

      <div className="flex flex-nowrap gap-1 sm:flex-wrap sm:gap-1.5">
        {BET_BB_PRESETS.map(bb => (
          <button
            key={bb}
            type="button"
            onClick={() => bumpBb(bb)}
            disabled={disabled}
            title={`Add ${formatBetTokens(bb)} ${CURRENCY_LABEL}`}
            className="hidden sm:flex flex-1 min-w-[52px] min-h-[32px] rounded-lg text-[11px] font-extrabold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-emerald-300/90 border border-emerald-500/20 hover:bg-[#353842] items-center justify-center"
          >
            +{formatBetTokens(bb)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTokensFree(amount / 2)}
          disabled={disabled}
          className="flex-1 min-h-[26px] sm:min-h-[32px] rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-white/60 border border-white/10 hover:bg-[#353842]"
        >
          ½
        </button>
        <button
          type="button"
          onClick={() => setTokensFree(amount * 2)}
          disabled={disabled}
          className="flex-1 min-h-[26px] sm:min-h-[32px] rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-white/60 border border-white/10 hover:bg-[#353842]"
        >
          2×
        </button>
        <button
          type="button"
          onClick={setTokensMax}
          disabled={disabled}
          className="flex-1 min-h-[26px] sm:min-h-[32px] rounded-md sm:rounded-lg text-[11px] sm:text-xs font-extrabold touch-manipulation disabled:opacity-30 bg-amber-400 text-black border-b-2 border-amber-600 hover:bg-amber-300"
        >
          MAX
        </button>
        {showPercentButtons &&
          onPercentChange &&
          PERCENTS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPercentChange(p);
                onAmountChange(clampBetToBalance(parseFloat(((balance * p) / 100).toFixed(decimals)), balance));
              }}
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
