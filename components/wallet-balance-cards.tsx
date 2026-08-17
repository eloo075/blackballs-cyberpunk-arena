'use client';

import { useEffect, useRef, useState } from 'react';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { formatBetTokens } from '@/lib/bet-sizing';

interface WalletBalanceCardsProps {
  solBalance: number;
  blackballsBalance: number;
  /** Optional win streak suffix for desktop nav. */
  arenaWinStreak?: number;
  variant?: 'default' | 'nav';
  className?: string;
}

export function WalletBalanceCards({
  solBalance,
  blackballsBalance,
  arenaWinStreak = 0,
  variant = 'default',
  className = '',
}: WalletBalanceCardsProps) {
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

  if (variant === 'nav') {
    return (
      <div className={`flex items-stretch gap-1.5 ${className}`}>
        <div className="nav-balance-chip nav-balance-sol px-2.5 py-1.5 min-w-[70px]">
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/solana-logo.svg"
              alt=""
              width={14}
              height={14}
              className="w-3.5 h-3.5 object-contain shrink-0"
              draggable={false}
            />
            <span className="text-[8px] font-extrabold text-sky-300/80 uppercase tracking-wider">SOL</span>
          </div>
          <div className="text-[13px] font-black text-sky-50 tabular-nums leading-tight mt-0.5">
            {solBalance.toFixed(2)}
          </div>
        </div>

        <div className="nav-balance-chip nav-balance-bb px-2.5 py-1.5 min-w-[98px]">
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/blackballs-coin.png"
              alt=""
              width={14}
              height={14}
              className="w-3.5 h-3.5 object-contain shrink-0"
              draggable={false}
            />
            <span className="text-[8px] font-extrabold text-amber-300/80 uppercase tracking-wider">
              {CURRENCY_LABEL}
            </span>
          </div>
          <div
            className={`text-[15px] font-black text-amber-300 tabular-nums leading-tight mt-0.5 ${tickClass}`}
            style={{ textShadow: '0 0 14px rgba(251,191,36,0.35)' }}
          >
            {formatBetTokens(blackballsBalance)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-stretch gap-1.5 ${className}`}>
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.07] px-2.5 py-1.5 min-w-[68px]">
        <div className="flex items-center gap-1 mb-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/solana-logo.svg"
            alt=""
            width={12}
            height={12}
            className="w-3 h-3 object-contain shrink-0"
            draggable={false}
          />
          <div className="text-[8px] font-extrabold text-sky-300/70 uppercase tracking-wider">SOL</div>
        </div>
        <div className="text-sm font-extrabold text-sky-100 tabular-nums leading-tight">
          {solBalance.toFixed(2)}
        </div>
      </div>

      <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-1.5 min-w-[92px]">
        <div className="flex items-center gap-1 mb-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/blackballs-coin.png"
            alt=""
            width={12}
            height={12}
            className="w-3 h-3 object-contain shrink-0"
            draggable={false}
          />
          <div className="text-[8px] font-extrabold text-amber-300/75 uppercase tracking-wider">
            {CURRENCY_LABEL}
          </div>
        </div>
        <div
          className={`text-[15px] font-extrabold text-amber-300 tabular-nums leading-tight ${tickClass}`}
          style={{ textShadow: '0 0 12px rgba(251,191,36,0.2)' }}
        >
          {formatBetTokens(blackballsBalance)}
        </div>
      </div>
    </div>
  );
}
