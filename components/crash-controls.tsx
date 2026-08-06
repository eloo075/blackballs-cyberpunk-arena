'use client';

import { useEffect, useRef, useState } from 'react';
import { WagerAmountPanel } from '@/components/wager-amount-panel';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { affordableBetAmount, clampBetToBalance, formatBetTokens, formatBetUsd, tokensToUsd } from '@/lib/bet-sizing';
import { useTokenUsd } from '@/hooks/use-token-usd';
import { motion, AnimatePresence } from 'framer-motion';
import type { HoldBonuses } from '@/lib/hold-bonuses';
import {
  calcPositionPct,
  calcPositionPnl,
  formatLivePnl,
  leveragedOpenFee,
  maxAffordableMargin,
} from '@/lib/crash-pnl';

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
  continuousMode?: boolean;
  vaultEnabled?: boolean;
  onConnect: () => void;
  onTryDemo?: () => void;
  onTrade: (side: 'buy' | 'sell', amount: number, leverage: number) => Promise<{ ok: boolean; error?: string }>;
  onCancelEntry: () => Promise<{ ok: boolean; error?: string }>;
  onSetAutoSell: (v: number | null) => Promise<void>;
  onCashOut?: (percent: number) => Promise<{ ok: boolean; error?: string; exitPrice?: number }>;
}

const CASH_OUT_PCTS = [0.25, 0.5, 0.75, 1] as const;
const LEVERAGE_PRESETS = [1, 1.5, 2, 3, 5] as const;
const WAIT_FOR_ROUND_MSG = 'Wait for the next round — BUY/SELL open during the countdown.';
/** Block entries in the last second — server may already be in the live round. */
const COUNTDOWN_ENTRY_BUFFER_SEC = 1.0;

function entryButtonSubtext(
  phase: 'waiting' | 'running' | 'crashed',
  waitLeft: number,
  entriesOpen: boolean,
  continuousMode: boolean,
): string {
  if (continuousMode && phase === 'running') return 'Open now at the live price';
  if (continuousMode && entriesOpen) return `PRESALE · guaranteed 1.00x · ${waitLeft.toFixed(1)}s`;
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
  if (preset >= 5) return 'bg-rose-500 text-white border-b-[3px] border-rose-700';
  if (preset >= 3) return 'bg-orange-500 text-white border-b-[3px] border-orange-700';
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
  'touch-manipulation min-h-[48px] sm:min-h-[52px] py-2 sm:py-2.5 px-2 sm:px-3 text-sm sm:text-base font-black uppercase tracking-wider';

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
  continuousMode,
  vaultEnabled = false,
  onConnect,
  onTryDemo,
  onTrade,
  onCancelEntry,
  onSetAutoSell: _onSetAutoSell,
  onCashOut,
}: CrashControlsProps) {
  void _onSetAutoSell;
  const { usdPerToken } = useTokenUsd();
  const [amount, setAmount] = useState(0.01);
  const [percent, setPercent] = useState(0);
  const [cashOutPct, setCashOutPct] = useState(0.5);
  const [leverage, setLeverage] = useState(1);
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

  const continuousDemo = continuousMode ?? isDemoWallet;
  const entriesOpen =
    (phase === 'waiting' && waitLeft > COUNTDOWN_ENTRY_BUFFER_SEC) ||
    (continuousDemo && phase === 'running');
  const rawWager = percent > 0
    ? parseFloat((balance * percent / 100).toFixed(4))
    : clampBetToBalance(amount, balance);
  const affordableMargin = maxAffordableMargin(balance, leverage);
  const safeAmount = clampWager(rawWager, affordableMargin);
  const effectiveWager =
    !hasPosition && balance > 0 && safeAmount <= 0
      ? clampWager(affordableBetAmount(usdPerToken, balance), affordableMargin)
      : safeAmount;
  const notionalExposure = parseFloat((effectiveWager * leverage).toFixed(4));
  const openFee = leveragedOpenFee(effectiveWager, leverage);

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
  const canOpenSell = continuousDemo ? false : canOpenBuy;

  const canCloseBuy =
    !continuousDemo &&
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
    (!continuousDemo && phase === 'running') ||
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
        : continuousDemo && phase === 'running'
          ? 'Live market — BUY opens a long at the current price.'
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
          continuousDemo
            ? 'Presale BUY cancelled.'
            : positionSide === 'sell'
              ? 'Short position cancelled.'
              : 'Long position cancelled.',
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

    if (phase === 'crashed' || (phase === 'running' && !continuousDemo)) {
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

    // Continuous Demo: SELL uses the cash-out % (50/75/100) so partial exits work.
    if (closing && continuousDemo && side === 'sell' && onCashOut) {
      setPendingAction('cashout');
      setTradeError(null);
      setCashOutError(null);
      try {
        const result = await onCashOut(cashOutPct);
        setPendingAction(null);
        if (result.ok) {
          const sold = parseFloat((positionAmount * cashOutPct).toFixed(3));
          setEntryNotice(
            cashOutPct >= 0.999
              ? `Sold ${positionAmount.toFixed(3)} ${CURRENCY_LABEL} @ ${mult.toFixed(2)}x`
              : `Cashed out ${Math.round(cashOutPct * 100)}% (${sold.toFixed(3)} ${CURRENCY_LABEL}) @ ${mult.toFixed(2)}x`,
          );
        } else if (result.error) {
          setCashOutError(result.error);
          setTradeError(result.error);
        }
      } catch {
        setPendingAction(null);
        setTradeError('Network error — try again.');
      }
      return;
    }

    setPendingAction(side);
    setTradeError(null);
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
    const cancelLabel = isBuy ? 'CANCEL BUY' : 'CANCEL SHORT';
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
          : continuousDemo
            ? 'SELLING…'
            : 'CLOSING LONG…'
        : isBuy
          ? continuousDemo
            ? 'BUYING…'
            : 'ENTERING LONG…'
          : continuousDemo
            ? 'SELLING…'
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

    const noDemoAction =
      continuousDemo && (isBuy ? hasPosition && !entryPending : !hasPosition || entryPending);
    const locked = entriesClosed || oppositePending || noDemoAction;
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
            {continuousDemo
              ? isBuy
                ? 'BUY (LOCKED)'
                : 'SELL (NO POSITION)'
              : isBuy
                ? 'BUY LONG (LOCKED)'
                : 'SELL SHORT (LOCKED)'}
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
            {continuousDemo
              ? isBuy
                ? 'BUY'
                : hasPosition && !entryPending
                  ? `SELL ${Math.round(cashOutPct * 100)}%`
                  : 'SELL'
              : isBuy
                ? 'BUY LONG'
                : 'SELL SHORT'}
            {isBuy && !hasPosition && stimmyLabel && (
              <span className="block text-[10px] font-extrabold text-amber-300 mt-0.5 normal-case tracking-normal">
                {stimmyLabel}
              </span>
            )}
            {!isBuy && !hasPosition && !continuousDemo && (
              <span className="block text-[10px] font-bold text-rose-200/80 mt-0.5 normal-case tracking-normal">
                Shorts love rugs
              </span>
            )}
            {continuousDemo && !isBuy && hasPosition && !entryPending && (
              <span className="block text-[10px] font-bold text-orange-200/90 mt-0.5 normal-case tracking-normal">
                Partial exit · pick % above
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
                {entryButtonSubtext(phase, waitLeft, entriesOpen, continuousDemo)}
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

      <div className="flex flex-col gap-1.5 p-2 sm:p-2.5">
        {/* rugs.fun-style: wager | leverage/% in two separate rectangles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            className={`rounded-xl border border-white/10 bg-[#1a1b20] px-2.5 py-2 ${
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
              showPercentButtons={false}
              showBalanceHint
              inputClassName="flex-1 min-w-0 bg-transparent text-lg sm:text-2xl font-extrabold text-white outline-none disabled:opacity-50 tabular-nums placeholder:text-white/20"
            />
          </div>

          <div
            className={`rounded-xl border border-white/10 bg-[#1a1b20] px-2.5 py-2 ${
              hasPosition ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-extrabold text-amber-300">⚡ Leverage</span>
              <span className="text-[10px] text-white/45 tabular-nums">
                <span className="text-sky-400 font-extrabold">{notionalExposure.toFixed(2)}</span>
                {openFee > 0 && <span className="text-rose-300"> · {openFee.toFixed(3)} fee</span>}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="shrink-0 min-w-[48px] text-center px-2 py-1 rounded-lg bg-amber-400 text-black border-b-2 border-amber-600">
                <div className="text-lg font-extrabold leading-none tabular-nums">
                  {leverage % 1 === 0 ? `${leverage}x` : `${leverage.toFixed(1)}x`}
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={leverage}
                onChange={e => setLeverage(parseFloat(e.target.value))}
                disabled={hasPosition}
                className="leverage-slider flex-1 h-2 cursor-pointer touch-manipulation disabled:opacity-30"
                style={{
                  ['--lev-pct' as string]: `${((leverage - 1) / 4) * 100}%`,
                }}
              />
            </div>
            <div className="flex gap-1 mb-1.5">
              {LEVERAGE_PRESETS.map(preset => {
                const active = leverage === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLeverage(preset)}
                    disabled={hasPosition}
                    className={`flex-1 min-h-[28px] rounded-lg text-[10px] font-extrabold touch-manipulation transition-all disabled:opacity-30 ${leveragePillClass(preset, active)}`}
                  >
                    {preset}x
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1">
              {[10, 25, 50, 100].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPercent(p)}
                  disabled={hasPosition}
                  className={`flex-1 min-h-[30px] rounded-lg text-[10px] font-extrabold touch-manipulation disabled:opacity-30 ${
                    percent === p
                      ? 'bg-violet-500 text-white border-b-2 border-violet-700'
                      : 'bg-[#2a2c33] text-white/55 border border-white/10'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {hasPosition && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl border border-white/10 bg-[#1a1b20] px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <span className={positionSide === 'buy' ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold'}>
                  {continuousDemo ? 'POSITION' : positionSide === 'buy' ? 'LONG' : 'SHORT'} ·{' '}
                  {positionAmount.toFixed(3)}
                </span>
                <span className="text-[10px] text-white/45">
                  ENTRY {positionEntryPrice.toFixed(2)}x
                  {phase === 'running' && ` · NOW ${mult.toFixed(2)}x`}
                </span>
                <span className={positionPnl >= 0 ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold'}>
                  {pnlDisplay.text} ({pnlDisplay.pct}%)
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showCashoutPanel && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              {CASH_OUT_PCTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCashOutPct(p)}
                  className={`flex-1 min-h-[34px] rounded-lg text-[11px] font-extrabold touch-manipulation ${
                    cashOutPct === p
                      ? 'bg-emerald-500 text-white border-b-2 border-emerald-700'
                      : 'bg-[#2a2c33] text-white/55 border border-white/10'
                  }`}
                >
                  {p * 100}%
                </button>
              ))}
              <button
                type="button"
                onClick={handleCashOut}
                disabled={!canCashOut}
                className={`flex-[1.4] min-h-[34px] rounded-lg text-[11px] font-black touch-manipulation ${
                  canCashOut
                    ? 'bg-emerald-500 text-white border-b-2 border-emerald-700'
                    : 'bg-[#2a2c33] text-white/40 border border-white/10'
                }`}
              >
                {pendingAction === 'cashout' ? '…' : cashOutPct >= 1 ? 'CASH OUT' : `OUT ${cashOutPct * 100}%`}
              </button>
            </div>
            {cashOutError && (
              <div className="text-[10px] font-bold text-rose-200">{cashOutError}</div>
            )}
          </div>
        )}

        {(entryNotice || cancelNotice || tradeError || (tradeBlockReason && !hasPosition && phase !== 'running')) &&
          walletConnected &&
          !pendingAction && (
            <div className="px-1 text-[10px] font-bold text-amber-200/90 leading-snug">
              {tradeError ?? entryNotice ?? cancelNotice ?? tradeBlockReason}
            </div>
          )}

        {/* BUY / SELL — always visible under chart, no scroll required */}
        <div className="grid grid-cols-2 gap-2">
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
            className={`mx-2 mb-2 p-2 text-center text-xs font-extrabold rounded-xl ${lastResult.won ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/25' : 'text-rose-300 bg-rose-500/15 border border-rose-500/25'}`}
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
