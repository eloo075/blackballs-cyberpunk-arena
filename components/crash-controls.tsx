'use client';

import { useEffect, useRef, useState } from 'react';
import { WagerAmountPanel } from '@/components/wager-amount-panel';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { affordableBetAmount, clampBetToBalance, formatBetTokens, formatBetUsd, tokensToUsd } from '@/lib/bet-sizing';
import { useTokenUsd } from '@/hooks/use-token-usd';
import { motion, AnimatePresence } from 'framer-motion';
import type { HoldBonuses } from '@/lib/hold-bonuses';
import { calcPositionPct, calcPositionPnl, formatLivePnl } from '@/lib/crash-pnl';

interface CrashControlsProps {
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  balance: number;
  hasPosition: boolean;
  hasLivePosition?: boolean;
  entryPending?: boolean;
  positionSide: 'buy' | 'sell';
  positionAmount: number;
  positionLeverage: number;
  positionEntryPrice: number;
  waitLeft: number;
  gameId?: number;
  roundEpoch?: number;
  streamConnected?: boolean;
  streamEpoch?: number;
  autoSell: number | null;
  lastResult: { won: boolean; amount: number; price: number; bonusAmount?: number; frenzyProc?: boolean } | null;
  holdBonuses: HoldBonuses;
  walletConnected: boolean;
  sessionReady?: boolean;
  isDemoWallet?: boolean;
  vaultEnabled?: boolean;
  onConnect: () => void;
  onTryDemo?: () => void;
  onTrade: (side: 'buy' | 'sell', amount: number, leverage: number) => Promise<{ ok: boolean; error?: string }>;
  onCancelEntry: () => Promise<{ ok: boolean; error?: string }>;
  onSetAutoSell: (v: number | null) => Promise<void>;
  onCashOut?: (percent: number) => Promise<{ ok: boolean; error?: string; exitPrice?: number }>;
}

const CASH_OUT_PCTS = [0.25, 0.5, 0.75, 1] as const;
const LEVERAGE_PRESETS = [1, 1.5, 2, 5, 10, 25, 50] as const;
const WAIT_FOR_ROUND_MSG = 'Wait for the next round — BUY/SELL open during the countdown.';
/** Block entries in the last second — server may already be in the live round. */
const COUNTDOWN_ENTRY_BUFFER_SEC = 1.0;

function entryButtonSubtext(
  phase: 'waiting' | 'running' | 'crashed',
  waitLeft: number,
  entriesOpen: boolean,
): string {
  if (entriesOpen) return `${waitLeft.toFixed(1)}s to enter @ 1.00x`;
  if (phase === 'waiting' && waitLeft <= COUNTDOWN_ENTRY_BUFFER_SEC) return 'Starting soon…';
  if (phase === 'crashed') return 'Rugged — wait for countdown';
  if (phase === 'running') return 'Round in progress';
  return 'Wait for countdown';
}

function clampWager(amount: number, balance: number): number {
  if (balance <= 0) return 0;
  return Math.floor(Math.min(amount, balance) * 1000) / 1000;
}

function leveragePillClass(preset: number, active: boolean): string {
  if (!active) {
    return 'bg-[#2a2c33] text-white/55 border border-white/10 hover:bg-[#353842]';
  }
  if (preset >= 50) return 'bg-amber-400 text-black border-b-[3px] border-amber-600';
  if (preset >= 25) return 'bg-rose-500 text-white border-b-[3px] border-rose-700';
  if (preset >= 10) return 'bg-orange-500 text-white border-b-[3px] border-orange-700';
  if (preset >= 5) return 'bg-violet-500 text-white border-b-[3px] border-violet-700';
  if (preset >= 2) return 'bg-sky-500 text-white border-b-[3px] border-sky-700';
  return 'bg-slate-500 text-white border-b-[3px] border-slate-700';
}

const ARCADE_BTN_BUY =
  'bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-wider rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all';
const ARCADE_BTN_SELL =
  'bg-rose-500 hover:bg-rose-400 text-white font-black uppercase tracking-wider rounded-xl border-b-4 border-rose-700 active:border-b-0 active:translate-y-1 transition-all';
const ARCADE_BTN_LOCKED =
  'bg-[#2a2c33] text-white/35 font-black uppercase tracking-wider rounded-xl border border-white/10 cursor-not-allowed';
const ARCADE_BTN_CANCEL_SHORT =
  'bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-wider rounded-xl border-b-4 border-rose-600 active:border-b-0 active:translate-y-1 transition-all';
const ARCADE_BTN_CANCEL_LONG =
  'bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-wider rounded-xl border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1 transition-all';
const TRADE_BTN =
  'touch-manipulation min-h-[52px] sm:min-h-[56px] py-2.5 sm:py-3 px-3 sm:px-4 text-sm sm:text-base font-black uppercase tracking-wider';

function TradeSpinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"
    />
  );
}

export function CrashControls({
  phase,
  mult,
  balance = 0,
  hasPosition,
  hasLivePosition = false,
  entryPending = false,
  positionSide,
  positionAmount,
  positionLeverage,
  positionEntryPrice,
  waitLeft,
  gameId,
  roundEpoch = 0,
  streamConnected = true,
  streamEpoch = 0,
  lastResult,
  holdBonuses,
  walletConnected,
  sessionReady = true,
  isDemoWallet = false,
  vaultEnabled = false,
  onConnect,
  onTryDemo,
  onTrade,
  onCancelEntry,
  onSetAutoSell,
  onCashOut,
}: CrashControlsProps) {
  const { usdPerToken } = useTokenUsd();
  const [amount, setAmount] = useState(0.01);
  const [percent, setPercent] = useState(0);
  const [cashOutPct, setCashOutPct] = useState(1);
  const [leverage, setLeverage] = useState(1);
  const [autoVal, setAutoVal] = useState('');
  const [pendingAction, setPendingAction] = useState<'buy' | 'sell' | 'cancel' | 'cashout' | null>(null);
  const tradeBusy = pendingAction === 'buy' || pendingAction === 'sell' || pendingAction === 'cancel';
  const cashoutBusy = pendingAction === 'cashout';
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [cashOutError, setCashOutError] = useState<string | null>(null);
  const [entryCooldown, setEntryCooldown] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [entryNotice, setEntryNotice] = useState<string | null>(null);
  const cancelToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entriesOpen = phase === 'waiting' && waitLeft > COUNTDOWN_ENTRY_BUFFER_SEC;
  const rawWager = percent > 0
    ? parseFloat((balance * percent / 100).toFixed(4))
    : clampBetToBalance(amount, balance);
  const safeAmount = clampWager(rawWager, balance);
  const effectiveWager =
    !hasPosition && balance > 0 && safeAmount <= 0
      ? affordableBetAmount(usdPerToken, balance)
      : safeAmount;
  const notionalExposure = parseFloat((effectiveWager * leverage).toFixed(4));

  const liveMult = hasPosition && phase === 'waiting' ? 1.0 : mult;
  const positionPct = hasPosition
    ? calcPositionPct(positionSide, positionLeverage, positionEntryPrice, liveMult)
    : 0;
  const positionPnl = hasPosition
    ? calcPositionPnl(positionSide, positionAmount, positionLeverage, positionEntryPrice, liveMult)
    : 0;
  const pnlDisplay = hasPosition ? formatLivePnl(positionPnl, positionPct) : { text: '0.00', pct: '0.0' };

  /** Wipe local UI locks when a new countdown round begins (crashed → waiting / new gameId). */
  useEffect(() => {
    setPendingAction(null);
    setEntryCooldown(false);
    setTradeError(null);
    setCashOutError(null);
    setCancelNotice(null);
    setEntryNotice(null);
    if (entryCooldownTimerRef.current) {
      clearTimeout(entryCooldownTimerRef.current);
      entryCooldownTimerRef.current = null;
    }
  }, [phase, gameId, roundEpoch]);

  useEffect(() => {
    return () => {
      if (cancelToastTimerRef.current) clearTimeout(cancelToastTimerRef.current);
      if (entryCooldownTimerRef.current) clearTimeout(entryCooldownTimerRef.current);
    };
  }, []);

  const canOpenBuy =
    walletConnected &&
    sessionReady &&
    streamConnected &&
    entriesOpen &&
    !tradeBusy &&
    !entryCooldown &&
    !hasPosition &&
    effectiveWager > 0 &&
    effectiveWager <= balance + 0.0005;
  const canOpenSell = canOpenBuy;

  const canCloseBuy =
    walletConnected && sessionReady && streamConnected && entriesOpen && !tradeBusy && hasPosition && positionSide === 'sell' && !entryPending;
  const canCloseSell =
    walletConnected && sessionReady && streamConnected && entriesOpen && !tradeBusy && hasPosition && positionSide === 'buy' && !entryPending;

  const stimmyLabel =
    holdBonuses.stimmy > 0 ? `+${Math.round(holdBonuses.stimmy * 100)}% stimmy` : null;

  const livePosition = hasLivePosition || (hasPosition && phase === 'running' && !entryPending);
  const showCashoutPanel =
    phase === 'running' && walletConnected && (livePosition || (hasPosition && pendingAction === 'cashout'));

  /** Clear pending spinner once server state catches up (avoids BUY → gray → CANCEL flicker). */
  useEffect(() => {
    if (!pendingAction) return;
    if (pendingAction === 'cancel' && !hasPosition) {
      setPendingAction(null);
      return;
    }
    if ((pendingAction === 'buy' || pendingAction === 'sell') && hasPosition) {
      setPendingAction(null);
      return;
    }
  }, [pendingAction, hasPosition]);

  const canCashOut =
    walletConnected && streamConnected && phase === 'running' && livePosition && !cashoutBusy && !!onCashOut;

  const handleCashOut = async () => {
    if (!canCashOut || !onCashOut) return;
    setTradeError(null);
    setCashOutError(null);
    setPendingAction('cashout');
    const result = await onCashOut(cashOutPct);
    setPendingAction(null);
    if (!result.ok && result.error) {
      setCashOutError(result.error);
      setTradeError(result.error);
    }
  };

  /** True when BUY/SELL must show locked — live round, rugged, or countdown closed (no pending cancel). */
  const entriesClosed =
    phase === 'running' ||
    phase === 'crashed' ||
    (phase === 'waiting' && !entriesOpen && !(entryPending && hasPosition));

  const tradeBlockReason = (() => {
    if (!walletConnected) return null;
    if (phase === 'running' && livePosition) {
      return `LIVE @ ${mult.toFixed(2)}x — use CASH OUT or Auto TP. Partial: 25/50/75/100%.`;
    }
    if (phase === 'running' || phase === 'crashed') {
      return livePosition
        ? `Round live — cash out anytime or wait for rug.`
        : WAIT_FOR_ROUND_MSG;
    }
    if (phase === 'waiting' && waitLeft <= COUNTDOWN_ENTRY_BUFFER_SEC && !hasPosition) {
      return 'Round starting — wait for the next countdown.';
    }
    if (pendingAction) return null;
    if (!hasPosition && balance <= 0 && vaultEnabled && !isDemoWallet) {
      return 'Vault balance is 0 — deposit BlackBalls via VAULT (top bar) to trade for real.';
    }
    if (!hasPosition && balance <= 0) {
      return 'Balance is 0 — connect with demo credits or deposit to play.';
    }
    if (!hasPosition && effectiveWager > balance + 0.0005) {
      return `Wager (${effectiveWager.toFixed(3)}) exceeds balance (${balance.toFixed(3)}). Lower amount or use MAX.`;
    }
    if (!hasPosition && effectiveWager <= 0) {
      return 'Set a wager amount above 0.';
    }
    if (entriesOpen && !hasPosition) {
      return `${waitLeft.toFixed(1)}s left to enter before round starts @ 1.00x`;
    }
    return null;
  })();

  useEffect(() => {
    if (hasPosition || balance <= 0) return;
    if (percent > 0) {
      if (safeAmount <= 0) setPercent(0);
      return;
    }
    setAmount(prev => {
      if (prev > 0 && prev <= balance) return prev;
      return affordableBetAmount(usdPerToken, balance);
    });
  }, [hasPosition, balance, usdPerToken, percent, safeAmount, gameId, roundEpoch]);

  const prevHasPositionRef = useRef(false);
  useEffect(() => {
    if (prevHasPositionRef.current && !hasPosition && balance > 0) {
      setPercent(0);
      setAmount(affordableBetAmount(usdPerToken, balance));
    }
    prevHasPositionRef.current = hasPosition;
  }, [hasPosition, balance, usdPerToken]);

  const showEntrySuccess = (side: 'buy' | 'sell', wager: number) => {
    setEntryNotice(
      side === 'buy'
        ? `Long entered — ${wager.toFixed(3)} ${CURRENCY_LABEL} locked for this round @ 1.00x`
        : `Short entered — ${wager.toFixed(3)} ${CURRENCY_LABEL} locked for this round @ 1.00x`,
    );
    setTradeError(null);
    if (cancelToastTimerRef.current) clearTimeout(cancelToastTimerRef.current);
    cancelToastTimerRef.current = setTimeout(() => setEntryNotice(null), 4000);
  };

  const showCancelSuccess = (message: string) => {
    setCancelNotice(message);
    setTradeError(null);
    if (cancelToastTimerRef.current) clearTimeout(cancelToastTimerRef.current);
    cancelToastTimerRef.current = setTimeout(() => setCancelNotice(null), 4000);
  };

  const pendingShort = hasPosition && entryPending && positionSide === 'sell';
  const pendingLong = hasPosition && entryPending && positionSide === 'buy';

  const canCancel =
    walletConnected && sessionReady && !tradeBusy && entryPending && hasPosition && phase === 'waiting';

  const handleCancel = async () => {
    if (!walletConnected || !sessionReady || tradeBusy) return;
    if (!entryPending || !hasPosition) return;
    setPendingAction('cancel');
    setTradeError(null);
    let ok = false;
    try {
      const result = await onCancelEntry();
      ok = result.ok;
      if (result.ok) {
        showCancelSuccess(
          positionSide === 'sell' ? 'Short position cancelled.' : 'Long position cancelled.',
        );
        setEntryCooldown(true);
        entryCooldownTimerRef.current = setTimeout(() => {
          setEntryCooldown(false);
          entryCooldownTimerRef.current = null;
        }, 700);
      } else {
        setTradeError(result.error ?? 'Failed to cancel');
      }
    } finally {
      if (!ok) setPendingAction(null);
    }
  };

  const handleTrade = async (side: 'buy' | 'sell') => {
    if (!walletConnected) return;
    if (tradeBusy) return;
    if (!sessionReady) {
      setTradeError('Syncing session — try again in a moment.');
      return;
    }

    if (phase === 'running' || phase === 'crashed') {
      setTradeError(WAIT_FOR_ROUND_MSG);
      return;
    }

    // Pending countdown entries use dedicated cancel buttons — never trade here.
    if (entryPending && hasPosition) {
      setTradeError('Use the yellow cancel button to remove your countdown entry.');
      return;
    }

    if (hasPosition && positionSide === side) {
      setTradeError('Use the opposite side to close your position.');
      return;
    }

    const closing = hasPosition && positionSide !== side;
    if (closing) {
      if (side === 'buy' && !canCloseBuy) {
        setTradeError('Cannot close short — wait for countdown or check position.');
        return;
      }
      if (side === 'sell' && !canCloseSell) {
        setTradeError('Cannot close long — wait for countdown or check position.');
        return;
      }
    } else if (side === 'buy' ? !canOpenBuy : !canOpenSell) {
      if (effectiveWager <= 0) setTradeError('Set a wager amount above 0.');
      else if (effectiveWager > balance) setTradeError(`Insufficient balance (${balance.toFixed(3)} available).`);
      return;
    }

    setPendingAction(side);
    setTradeError(null);
    let ok = false;
    try {
      const wager = closing ? positionAmount : effectiveWager;
      const result = await onTrade(side, wager, closing ? positionLeverage : leverage);
      if (result.ok) {
        showEntrySuccess(side, closing ? positionAmount : effectiveWager);
      } else if (result.error) {
        const msg = result.error;
        setTradeError(msg === 'invalid amount' ? `Insufficient balance (${balance.toFixed(3)} available).` : msg);
      }
      setPendingAction(null);
      if (result.ok && !closing) setPercent(0);
    } catch {
      setPendingAction(null);
      setTradeError('Network error — try again.');
    }
  };

  const renderTradeButton = (side: 'buy' | 'sell') => {
    const isBuy = side === 'buy';
    const showCancel = isBuy ? pendingLong : pendingShort;
    const oppositePending = isBuy ? pendingShort : pendingLong;
    const cancelClass = isBuy ? ARCADE_BTN_CANCEL_LONG : ARCADE_BTN_CANCEL_SHORT;
    const cancelLabel = isBuy ? 'CANCEL LONG' : 'CANCEL SHORT';
    const isPendingThis = pendingAction === side;
    const isClosingThis = isPendingThis && hasPosition && positionSide !== side;

    if (showCancel && phase === 'waiting') {
      return (
        <button
          type="button"
          onClick={handleCancel}
          disabled={!canCancel}
          className={`${TRADE_BTN} ${cancelClass} ${!canCancel ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className="flex items-center justify-center gap-2">
            {pendingAction === 'cancel' ? <TradeSpinner /> : <span aria-hidden className="text-lg leading-none">✕</span>}
            {pendingAction === 'cancel' ? 'CANCELLING…' : cancelLabel}
          </span>
        </button>
      );
    }

    if (isPendingThis) {
      const pendingLabel = isClosingThis
        ? isBuy
          ? 'CLOSING SHORT…'
          : 'CLOSING LONG…'
        : isBuy
          ? 'ENTERING LONG…'
          : 'ENTERING SHORT…';
      return (
        <button
          type="button"
          disabled
          className={`${TRADE_BTN} ${isBuy ? ARCADE_BTN_BUY : ARCADE_BTN_SELL}`}
        >
          <span className="flex items-center justify-center gap-2">
            <TradeSpinner />
            {pendingLabel}
          </span>
        </button>
      );
    }

    const locked = entriesClosed || oppositePending;
    const disabled = locked || tradeBusy;

    return (
      <button
        type="button"
        onClick={() => handleTrade(side)}
        disabled={disabled}
        className={`${TRADE_BTN} ${
          locked || oppositePending ? ARCADE_BTN_LOCKED : isBuy ? ARCADE_BTN_BUY : ARCADE_BTN_SELL
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {locked || oppositePending ? (
          <>
            {isBuy ? 'BUY LONG (LOCKED)' : 'SELL SHORT (LOCKED)'}
            <span className="block text-[10px] font-bold normal-case tracking-normal opacity-80 mt-0.5">
              {phase === 'crashed'
                ? 'Wait for countdown'
                : phase === 'running'
                  ? livePosition
                    ? 'Use CASH OUT above'
                    : 'Round in progress'
                  : oppositePending
                    ? isBuy
                      ? 'Short active on right — cancel or wait'
                      : 'Long active on left — cancel or wait'
                    : 'Starting soon…'}
            </span>
          </>
        ) : (
          <>
            {isBuy ? 'BUY LONG' : 'SELL SHORT'}
            {isBuy && !hasPosition && stimmyLabel && (
              <span className="block text-[10px] font-extrabold text-amber-300 mt-0.5 normal-case tracking-normal">
                {stimmyLabel}
              </span>
            )}
            {!isBuy && !hasPosition && (
              <span className="block text-[10px] font-bold text-rose-200/80 mt-0.5 normal-case tracking-normal">
                Shorts love rugs
              </span>
            )}
            {!hasPosition && (
              <span className="block text-xs font-bold opacity-90 mt-0.5 normal-case tracking-normal">
                {formatBetTokens(effectiveWager)} {CURRENCY_LABEL}
                <span className="text-white/50"> · {formatBetUsd(tokensToUsd(effectiveWager, usdPerToken))}</span>
                {leverage > 1 ? ` · ${leverage}x` : ''}
              </span>
            )}
            {!hasPosition && (
              <span className="block text-[11px] font-bold opacity-70 normal-case tracking-normal">
                {entryButtonSubtext(phase, waitLeft, entriesOpen)}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="cp-panel p-0 font-arcade relative safe-bottom">
      {!walletConnected && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#141518]/90 backdrop-blur-sm px-4 rounded-2xl">
          <span className="text-sm font-extrabold text-white/70 text-center">
            Connect to trade
          </span>
          <p className="text-xs text-white/45 text-center max-w-[260px] leading-relaxed">
            {vaultEnabled
              ? 'Real play: connect wallet + deposit in VAULT. Or try demo mode with free credits.'
              : 'Demo mode — connect for free BlackBalls credits to practice.'}
          </p>
          <button
            onClick={onConnect}
            className="touch-target touch-manipulation px-6 py-3 text-sm font-black bg-sky-500 hover:bg-sky-400 text-white w-full max-w-[240px] rounded-xl border-b-4 border-sky-700 active:border-b-0 active:translate-y-1 transition-all"
          >
            {vaultEnabled ? 'CONNECT WALLET' : 'CONNECT · DEMO PLAY'}
          </button>
          {vaultEnabled && onTryDemo && (
            <button
              type="button"
              onClick={onTryDemo}
              className="touch-target touch-manipulation px-4 py-2 text-xs font-bold border border-white/10 bg-[#2a2c33] text-amber-300 hover:bg-[#353842] w-full max-w-[240px] rounded-xl"
            >
              TRY DEMO (FREE CREDITS)
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col">
        {/* wager amount */}
        <div
          className={`relative px-3 py-2 sm:px-4 sm:py-3 border-b border-white/5 bg-[#25262c] ${
            hasPosition ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <WagerAmountPanel
            amount={hasPosition ? clampBetToBalance(amount, balance) : effectiveWager}
            onAmountChange={v => setAmount(clampBetToBalance(v, balance))}
            balance={balance}
            disabled={hasPosition}
            percent={percent}
            onPercentChange={setPercent}
            showPercentButtons
            showBalanceHint
          />
        </div>

        {/* leverage */}
        <div
          className={`relative px-3 py-2 sm:px-4 sm:py-3 border-b border-white/5 bg-[#25262c] ${
            hasPosition ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-amber-300">⚡ Leverage</span>
              {leverage > 1 && (
                <span className="hidden sm:inline text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  DEGEN MODE
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] text-white/45">
              <span className="text-sky-400 font-extrabold">{notionalExposure.toFixed(2)}</span> exp.
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <div className="shrink-0 min-w-[56px] sm:min-w-[72px] text-center px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-amber-400 text-black border-b-[3px] border-amber-600">
              <div className="text-xl sm:text-3xl font-extrabold leading-none tabular-nums">
                {leverage % 1 === 0 ? `${leverage}x` : `${leverage.toFixed(1)}x`}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <input
                type="range"
                min="1"
                max="50"
                step="0.5"
                value={leverage}
                onChange={e => setLeverage(parseFloat(e.target.value))}
                disabled={hasPosition}
                className="leverage-slider w-full h-2 sm:h-2.5 cursor-pointer touch-manipulation disabled:opacity-30"
                style={{
                  ['--lev-pct' as string]: `${((leverage - 1) / 49) * 100}%`,
                }}
              />
              <div className="hidden sm:flex justify-between text-[10px] text-white/40 font-bold">
                <span>1x safe</span>
                <span className="text-rose-400">50x max</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {LEVERAGE_PRESETS.map(preset => {
              const active = leverage === preset;
              const hideOnMobile = preset === 1.5 || preset === 25;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLeverage(preset)}
                  disabled={hasPosition}
                  className={`flex-1 min-w-[36px] min-h-[32px] sm:min-h-[36px] rounded-full text-[11px] sm:text-xs font-extrabold touch-manipulation transition-all disabled:opacity-30 ${leveragePillClass(preset, active)} ${hideOnMobile ? 'hidden sm:flex' : ''}`}
                >
                  {preset}x
                </button>
              );
            })}
          </div>
        </div>

        {/* auto take-profit — desktop only */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2.5 text-xs border-b border-white/5 bg-[#1f2025]">
          <span className="text-white/40 text-[11px] font-bold">
            {holdBonuses.stimmy > 0
              ? `+${Math.round(holdBonuses.stimmy * 100)}% stimmy active`
              : 'Wager → leverage → BUY / SELL'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-white/35 text-[11px] font-bold">Auto TP</span>
            <input
              type="number"
              min="1.01"
              step="0.1"
              inputMode="decimal"
              value={autoVal}
              onChange={e => {
                setAutoVal(e.target.value);
                onSetAutoSell(e.target.value ? parseFloat(e.target.value) : null);
              }}
              placeholder="OFF"
              className="w-16 bg-[#2a2c33] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-amber-300 text-right outline-none focus:border-amber-400/50"
            />
            <span className="text-white/35">x</span>
          </div>
        </div>

        {/* open position panel */}
        <AnimatePresence initial={false}>
          {hasPosition && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 py-2 border-b border-white/5 bg-[#25262c]"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <span className={positionSide === 'buy' ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold'}>
                  {positionSide === 'buy' ? 'LONG' : 'SHORT'} · {positionAmount.toFixed(3)} {CURRENCY_LABEL}
                </span>
                <span
                  className={`font-extrabold px-2.5 py-0.5 rounded-full text-xs shrink-0 ${
                    positionLeverage >= 50
                      ? 'bg-amber-400 text-black'
                      : positionLeverage >= 10
                        ? 'bg-rose-500 text-white'
                        : positionLeverage > 1
                          ? 'bg-amber-400/90 text-black'
                          : 'bg-[#2a2c33] text-white/55 border border-white/10'
                  }`}
                >
                  {positionLeverage}x LEV
                </span>
                <span className={positionPnl >= 0 ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold'}>
                  {pnlDisplay.text} ({pnlDisplay.pct}%)
                </span>
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                {entryPending && phase === 'waiting' ? (
                  <span className="text-amber-300 font-bold">COUNTDOWN ENTRY · starts @ 1.00x when timer hits 0</span>
                ) : (
                  <>
                    ENTRY {positionEntryPrice.toFixed(4)}x
                    {phase === 'waiting' && ' · LIVE @ ROUND START'}
                    {phase === 'running' && ` · NOW ${mult.toFixed(4)}x`}
                  </>
                )}
              </div>
              {holdBonuses.stimmy > 0 && (
                <div className="text-[10px] text-amber-300 font-extrabold mt-0.5">
                  +{Math.round(holdBonuses.stimmy * 100)}% stimmy on wins — because you hold BlackBalls
                </div>
              )}
              {positionSide === 'sell' && (
                <div className="text-[10px] text-rose-300/80 font-bold mt-0.5">Shorts love rugs 💀</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {showCashoutPanel && (
          <div className="px-3 py-2 border-b border-white/5 bg-emerald-500/10">
            <div className="text-[10px] font-extrabold text-emerald-300 mb-1.5">CASH OUT @ {mult.toFixed(2)}x</div>
            {cashOutError && (
              <div className="mb-2 px-2 py-1.5 text-[10px] font-bold rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200">
                {cashOutError}
              </div>
            )}
            <div className="flex gap-1 mb-2">
              {CASH_OUT_PCTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCashOutPct(p)}
                  disabled={cashoutBusy}
                  className={`flex-1 min-h-[32px] rounded-lg text-[10px] font-extrabold touch-manipulation ${
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
              disabled={!canCashOut}
              className={`w-full touch-manipulation min-h-[48px] py-2.5 text-sm font-black rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all ${
                canCashOut
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-700'
                  : 'bg-[#2a2c33] text-white/40 border-white/10 cursor-not-allowed'
              }`}
            >
              {pendingAction === 'cashout' ? 'CASHING OUT…' : cashOutPct >= 1 ? 'CASH OUT 100%' : `PARTIAL CASH OUT ${cashOutPct * 100}%`}
            </button>
          </div>
        )}

        {/* BUY / SELL */}
        <div className="min-h-0">
        {entryNotice && walletConnected && (
          <div className="mx-3 mt-2 px-3 py-2 text-xs leading-relaxed rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 font-bold">
            {entryNotice}
          </div>
        )}
        {cancelNotice && walletConnected && (
          <div className="mx-3 mt-2 px-3 py-2 text-xs leading-relaxed rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 font-bold">
            {cancelNotice}
          </div>
        )}
        {(tradeBlockReason || tradeError) && walletConnected && !pendingAction && (
          <div className="mx-3 mt-2 px-3 py-2 text-xs leading-relaxed rounded-xl bg-amber-400/10 border border-amber-400/25 text-amber-200 font-bold">
            {tradeError ?? tradeBlockReason}
            {tradeBlockReason?.includes('Vault balance is 0') && onTryDemo && (
              <button
                type="button"
                onClick={onTryDemo}
                className="block mt-2 text-xs font-extrabold underline text-sky-400"
              >
                Or switch to demo mode with free credits →
              </button>
            )}
          </div>
        )}
        </div>
        {walletConnected && isDemoWallet && (
          <div className="hidden sm:block mx-3 mt-2 px-3 py-1.5 text-[11px] text-center text-emerald-300 border border-emerald-500/20 bg-emerald-500/10 rounded-xl font-bold">
            DEMO MODE · off-chain credits · no real tokens at risk
          </div>
        )}

        {/* BUY / SELL — same markup on all screen sizes (no sticky / no duplicate logic) */}
        <div className="grid grid-cols-2 gap-3 p-3">
          {renderTradeButton('buy')}
          {renderTradeButton('sell')}
        </div>
      </div>

      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mx-3 mb-3 p-3 text-center text-sm font-extrabold rounded-xl ${lastResult.won ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/25' : 'text-rose-300 bg-rose-500/15 border border-rose-500/25'}`}
          >
            {lastResult.won
              ? `+${lastResult.amount.toFixed(3)} ${CURRENCY_LABEL} @ ${lastResult.price.toFixed(2)}x${lastResult.bonusAmount ? ` (+${lastResult.bonusAmount.toFixed(3)} bonus)` : ''}${lastResult.frenzyProc ? ' · FRENZY!' : ''}`
              : `${lastResult.amount >= 0 ? '+' : ''}${lastResult.amount.toFixed(3)} ${CURRENCY_LABEL} @ ${lastResult.price.toFixed(2)}x`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
