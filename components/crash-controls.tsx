'use client';

import { useEffect, useRef, useState } from 'react';
import { WagerAmountPanel } from '@/components/wager-amount-panel';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import {
  MIN_BET_BB,
  clampBetToBalance,
  formatBetTokens,
  formatBetUsd,
  isBuyableWagerDraft,
  tokensToUsd,
} from '@/lib/bet-sizing';
import { useTokenUsd } from '@/hooks/use-token-usd';
import { motion, AnimatePresence } from 'framer-motion';
import type { HoldBonuses } from '@/lib/hold-bonuses';
import {
  calcLotsPnl,
  calcLotsPnlBreakdown,
  calcLotsPositionPct,
  formatLivePnl,
  leveragedOpenFee,
  maxAffordableMargin,
  minExitMultiplierRatio,
} from '@/lib/crash-pnl';
import type { PositionLot } from '@/lib/crash-types';

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
  positionLots?: PositionLot[];
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
const WAGER_STORAGE_KEY = 'bb_crash_wager_v1';

function loadStoredWager(): { amount: number; draft: string } {
  if (typeof window === 'undefined') return { amount: 0, draft: '0' };
  try {
    const raw = localStorage.getItem(WAGER_STORAGE_KEY);
    if (!raw) return { amount: 0, draft: '0' };
    const parsed = JSON.parse(raw) as { amount?: unknown; draft?: unknown };
    const amount =
      typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount >= 0
        ? parsed.amount
        : 0;
    const draft =
      typeof parsed.draft === 'string' && parsed.draft.length > 0
        ? parsed.draft
        : amount > 0
          ? String(amount)
          : '0';
    return { amount, draft };
  } catch {
    return { amount: 0, draft: '0' };
  }
}

function saveStoredWager(amount: number, draft: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WAGER_STORAGE_KEY, JSON.stringify({ amount, draft }));
  } catch {
    /* ignore quota / private mode */
  }
}

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
  'crash-trade-btn bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-wider rounded-xl border-b-[3px] sm:border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 active:scale-[0.98] transition-all duration-150 shadow-[0_0_24px_rgba(16,185,129,0.25)]';
const ARCADE_BTN_SELL =
  'crash-trade-btn bg-rose-500 hover:bg-rose-400 text-white font-black uppercase tracking-wider rounded-xl border-b-[3px] sm:border-b-4 border-rose-700 active:border-b-0 active:translate-y-1 active:scale-[0.98] transition-all duration-150 shadow-[0_0_24px_rgba(244,63,94,0.22)]';
const ARCADE_BTN_LOCKED =
  'bg-[#1e2028] text-white/30 font-black uppercase tracking-wider rounded-xl border border-white/8 cursor-not-allowed';
const ARCADE_BTN_CANCEL_SHORT =
  'crash-trade-btn bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-wider rounded-xl border-b-[3px] sm:border-b-4 border-rose-600 active:border-b-0 active:translate-y-1 active:scale-[0.98] transition-all duration-150';
const ARCADE_BTN_CANCEL_LONG =
  'crash-trade-btn bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-wider rounded-xl border-b-[3px] sm:border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1 active:scale-[0.98] transition-all duration-150';
const TRADE_BTN =
  'touch-manipulation min-h-[44px] sm:min-h-[56px] py-2 sm:py-3 px-2 sm:px-3 text-[13px] sm:text-base font-black uppercase tracking-wider';

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
  positionLots,
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
  const [amount, setAmount] = useState(0);
  const [wagerDraft, setWagerDraft] = useState('0');
  const [wagerReady, setWagerReady] = useState(false);
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
  const [cashoutFlash, setCashoutFlash] = useState<{
    pct: number;
    sold: number;
    exitMult: number;
    fullExit: boolean;
  } | null>(null);
  const cancelToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cashoutFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  void holdBonuses;
  const continuousDemo = continuousMode ?? isDemoWallet;
  const entriesOpen =
    (phase === 'waiting' && waitLeft > COUNTDOWN_ENTRY_BUFFER_SEC) ||
    (continuousDemo && phase === 'running');
  const requestedWager =
    Number.isFinite(amount) && amount > 0 ? Math.floor(amount * 1000) / 1000 : 0;
  const affordableMargin = maxAffordableMargin(balance, leverage);
  const safeAmount = clampWager(requestedWager, affordableMargin);
  /** Trade uses the player's set stake — never silently rewrite it to MAX/balance. */
  const effectiveWager = safeAmount;
  const wagerDraftForGate = wagerDraft;
  const wagerBuyable =
    isBuyableWagerDraft(wagerDraftForGate, requestedWager) &&
    requestedWager <= balance + 0.0005 &&
    requestedWager <= affordableMargin + 0.0005;
  const notionalExposure = parseFloat((effectiveWager * leverage).toFixed(4));
  const openFee = leveragedOpenFee(effectiveWager, leverage);

  const liveMult = hasPosition && phase === 'waiting' ? 1.0 : mult;
  const positionPct = hasPosition
    ? calcLotsPositionPct(positionSide, positionLots, liveMult, {
        margin: positionAmount,
        leverage: positionLeverage,
        entry: positionEntryPrice,
      })
    : 0;
  const positionPnl = hasPosition
    ? calcLotsPnl(positionSide, positionLots, liveMult, {
        margin: positionAmount,
        leverage: positionLeverage,
        entry: positionEntryPrice,
      })
    : 0;
  const pnlDisplay = hasPosition ? formatLivePnl(positionPnl, positionPct) : { text: '0.000', pct: '0.0' };
  const lotCount = positionLots?.length ?? 0;
  const lotBreakdown =
    lotCount > 1 ? calcLotsPnlBreakdown(positionSide, positionLots, liveMult) : [];

  useEffect(() => {
    const stored = loadStoredWager();
    setAmount(stored.amount);
    setWagerDraft(stored.draft);
    setWagerReady(true);
  }, []);

  useEffect(() => {
    if (!wagerReady) return;
    saveStoredWager(amount, wagerDraft);
  }, [amount, wagerDraft, wagerReady]);

  /** Wipe local UI locks when a new countdown round begins (crashed → waiting / new gameId). */
  useEffect(() => {
    setPendingAction(null);
    setEntryCooldown(false);
    setTradeError(null);
    setCashOutError(null);
    setCancelNotice(null);
    setEntryNotice(null);
    setCashoutFlash(null);
    if (entryCooldownTimerRef.current) {
      clearTimeout(entryCooldownTimerRef.current);
      entryCooldownTimerRef.current = null;
    }
    if (cashoutFlashTimerRef.current) {
      clearTimeout(cashoutFlashTimerRef.current);
      cashoutFlashTimerRef.current = null;
    }
  }, [phase, gameId, roundEpoch]);

  useEffect(() => {
    return () => {
      if (cancelToastTimerRef.current) clearTimeout(cancelToastTimerRef.current);
      if (entryCooldownTimerRef.current) clearTimeout(entryCooldownTimerRef.current);
      if (cashoutFlashTimerRef.current) clearTimeout(cashoutFlashTimerRef.current);
    };
  }, []);

  const showCashoutFlash = (pct: number, sold: number, exitMult: number) => {
    setCashoutFlash({
      pct,
      sold,
      exitMult,
      fullExit: pct >= 0.999,
    });
    setEntryNotice(null);
    setTradeError(null);
    if (cashoutFlashTimerRef.current) clearTimeout(cashoutFlashTimerRef.current);
    cashoutFlashTimerRef.current = setTimeout(() => {
      setCashoutFlash(null);
      cashoutFlashTimerRef.current = null;
    }, 2800);
  };

  const canOpenBuy =
    walletConnected &&
    sessionReady &&
    streamConnected &&
    entriesOpen &&
    !tradeBusy &&
    !entryCooldown &&
    // Continuous: allow stacking buys while live; classic: one entry only
    (continuousDemo
      ? !(entryPending && phase === 'waiting') && !(hasPosition && phase === 'waiting')
      : !hasPosition) &&
    wagerBuyable &&
    effectiveWager >= MIN_BET_BB &&
    effectiveWager <= balance + 0.0005;
  const canOpenSell = continuousDemo ? false : canOpenBuy;

  const canCloseBuy =
    !continuousDemo &&
    walletConnected && sessionReady && streamConnected && entriesOpen && !tradeBusy && hasPosition && positionSide === 'sell' && !entryPending;
  const canCloseSell =
    walletConnected && sessionReady && streamConnected && entriesOpen && !tradeBusy && hasPosition && positionSide === 'buy' && !entryPending;

  const canStackBuy =
    continuousDemo && phase === 'running' && hasPosition && !entryPending && positionSide === 'buy';
  const wagerLocked = hasPosition && !canStackBuy;
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
    if ((pendingAction === 'buy' || pendingAction === 'sell') && hasPosition && !continuousDemo) {
      setPendingAction(null);
      return;
    }
  }, [pendingAction, hasPosition, continuousDemo]);

  const canCashOut =
    walletConnected && streamConnected && phase === 'running' && livePosition && !cashoutBusy && !!onCashOut;

  const handleCashOut = async () => {
    if (!canCashOut || !onCashOut) return;
    setTradeError(null);
    setCashOutError(null);
    setPendingAction('cashout');
    const result = await onCashOut(cashOutPct);
    setPendingAction(null);
    if (result.ok) {
      const sold = parseFloat((positionAmount * cashOutPct).toFixed(3));
      const exitMult = result.exitPrice ?? mult;
      showCashoutFlash(cashOutPct, sold, exitMult);
    } else if (result.error) {
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
      return continuousDemo
        ? `LIVE @ ${mult.toFixed(2)}x — BUY MORE anytime · SELL 25/50/75/100%.`
        : `LIVE @ ${mult.toFixed(2)}x — use CASH OUT or Auto TP. Partial: 25/50/75/100%.`;
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
    if (!hasPosition && !wagerBuyable) {
      return 'Place your amount — wager cannot be 0.';
    }
    if (entriesOpen && !hasPosition) {
      return `${waitLeft.toFixed(1)}s left to enter before round starts @ 1.00x`;
    }
    return null;
  })();

  useEffect(() => {
    // Clear stale percent mode only — never rewrite the typed wager.
    if (percent > 0 && safeAmount <= 0) setPercent(0);
  }, [percent, safeAmount]);

  const prevHasPositionRef = useRef(false);
  useEffect(() => {
    // After a position closes, keep the same wager the player set (do not auto MAX / refill).
    if (prevHasPositionRef.current && !hasPosition) {
      setPercent(0);
    }
    prevHasPositionRef.current = hasPosition;
  }, [hasPosition]);

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

    const stackingBuy =
      continuousDemo && phase === 'running' && side === 'buy' && hasPosition && positionSide === 'buy';
    const closingTrade =
      hasPosition && positionSide !== side && !stackingBuy;
    if (!closingTrade && (!wagerBuyable || effectiveWager < MIN_BET_BB)) {
      setTradeError('Place your amount — wager cannot be 0.');
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

    // Continuous: allow stacking BUY while already long (average entry).
    if (hasPosition && positionSide === side && !(continuousDemo && side === 'buy' && phase === 'running')) {
      setTradeError('Use the opposite side to close your position.');
      return;
    }

    const addingBuy =
      continuousDemo && phase === 'running' && side === 'buy' && hasPosition && positionSide === 'buy';
    const closing = hasPosition && positionSide !== side && !addingBuy;
    if (closing) {
      if (side === 'buy' && !canCloseBuy) {
        setTradeError('Cannot close short — wait for countdown or check position.');
        return;
      }
      if (side === 'sell' && !canCloseSell) {
        setTradeError('Cannot close long — wait for countdown or check position.');
        return;
      }
    } else if (!addingBuy && (side === 'buy' ? !canOpenBuy : !canOpenSell)) {
      if (!wagerBuyable) {
        setTradeError('Wager cannot start with 0 — enter a valid amount (base entry 1000).');
      } else if (effectiveWager > balance) {
        setTradeError(`Insufficient balance (${balance.toFixed(3)} available).`);
      }
      return;
    }

    if (addingBuy && !canOpenBuy) {
      if (!wagerBuyable) {
        setTradeError('Wager cannot start with 0 — enter a valid amount (base entry 1000).');
      } else if (effectiveWager > balance) {
        setTradeError(`Insufficient balance (${balance.toFixed(3)} available).`);
      }
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
          const exitMult = result.exitPrice ?? mult;
          showCashoutFlash(cashOutPct, sold, exitMult);
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
        if (addingBuy) {
          setEntryNotice(`Bought +${effectiveWager.toFixed(3)} ${CURRENCY_LABEL} @ ${mult.toFixed(2)}x`);
        } else {
          showEntrySuccess(side, closing ? positionAmount : effectiveWager);
        }
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
      continuousDemo &&
      (isBuy
        ? entryPending && phase === 'waiting'
        : !hasPosition || entryPending);
    const locked = entriesClosed || oppositePending || noDemoAction;
    const isClosingAction =
      hasPosition &&
      positionSide !== side &&
      !(continuousDemo && isBuy && phase === 'running' && positionSide === 'buy');
    const openBlocked = !isClosingAction && (isBuy ? !canOpenBuy : !canOpenSell);
    const needsAmount = openBlocked && !wagerBuyable;
    const disabled = locked || tradeBusy || openBlocked;

    return (
      <button
        type="button"
        onClick={() => handleTrade(side)}
        disabled={disabled}
        className={`${TRADE_BTN} ${
          locked || oppositePending || openBlocked
            ? ARCADE_BTN_LOCKED
            : isBuy
              ? ARCADE_BTN_BUY
              : ARCADE_BTN_SELL
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {needsAmount && !locked && !oppositePending ? (
          <>
            {isBuy ? 'BUY' : 'SELL'}
            <span className="block text-[10px] font-bold normal-case tracking-normal opacity-80 mt-0.5">
              Place your amount
            </span>
          </>
        ) : locked || oppositePending ? (
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
                ? hasPosition && phase === 'running' && !entryPending
                  ? 'BUY MORE'
                  : 'BUY'
                : hasPosition && !entryPending
                  ? `SELL ${Math.round(cashOutPct * 100)}%`
                  : 'SELL'
              : isBuy
                ? 'BUY LONG'
                : 'SELL SHORT'}
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
            {continuousDemo && isBuy && hasPosition && phase === 'running' && !entryPending && (
              <span className="block text-[10px] font-bold text-emerald-200/90 mt-0.5 normal-case tracking-normal">
                Stack at live price · avg entry
              </span>
            )}
            <span className="block text-xs font-bold opacity-90 mt-0.5 normal-case tracking-normal">
              {formatBetTokens(effectiveWager)} {CURRENCY_LABEL}
              <span className="text-white/50"> · {formatBetUsd(tokensToUsd(effectiveWager, usdPerToken))}</span>
              {leverage > 1 ? ` · ${leverage}x` : ''}
            </span>
            {!(hasPosition && phase === 'running' && !isBuy) && (
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
    <div className="rounded-lg sm:rounded-2xl border border-white/[0.06] bg-[#12141a] p-0 font-arcade relative max-sm:pb-[env(safe-area-inset-bottom,0px)] sm:safe-bottom overflow-hidden">
      {!walletConnected && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#141518]/90 backdrop-blur-sm px-4 rounded-lg sm:rounded-2xl">
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

      <div className="flex flex-col gap-1 sm:gap-2 p-1.5 sm:p-3">
        {/* Wager — hide on mobile while in a position so cashout stays on-screen */}
        <div
          className={`grid grid-cols-1 ${continuousDemo ? '' : 'sm:grid-cols-2'} gap-1 sm:gap-2 ${
            wagerLocked ? 'max-sm:hidden' : ''
          }`}
        >
          <div
            className={`rounded-lg sm:rounded-xl border border-white/[0.07] bg-[#0e1015] px-2 py-1 sm:px-3 sm:py-2.5 ${
              wagerLocked ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <WagerAmountPanel
              amount={amount}
              onAmountChange={v => {
                setPercent(0);
                setAmount(Number.isFinite(v) && v > 0 ? v : 0);
              }}
              onDraftChange={setWagerDraft}
              balance={balance}
              disabled={wagerLocked}
              invalid={!wagerLocked && !wagerBuyable}
              invalidMessage="Place your amount"
              percent={percent}
              onPercentChange={p => {
                setPercent(0);
                const next = clampBetToBalance(parseFloat(((balance * p) / 100).toFixed(4)), balance);
                setAmount(next);
                setWagerDraft(next > 0 ? String(Math.floor(next)) : '0');
              }}
              showPercentButtons={false}
              showBalanceHint
              inputClassName="flex-1 min-w-0 bg-transparent text-sm sm:text-2xl font-extrabold text-white outline-none disabled:opacity-50 tabular-nums placeholder:text-white/20"
            />
            {continuousDemo && (
              <div className="flex gap-1 mt-1 sm:mt-2">
                {[10, 25, 50, 100].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const next = clampBetToBalance(
                        parseFloat(((balance * p) / 100).toFixed(4)),
                        balance,
                      );
                      setPercent(0);
                      setAmount(next);
                      setWagerDraft(next > 0 ? String(Math.floor(next)) : '0');
                    }}
                    disabled={wagerLocked}
                    className={`flex-1 min-h-[26px] sm:min-h-[30px] rounded-md sm:rounded-lg text-[10px] font-extrabold touch-manipulation disabled:opacity-30 transition-colors ${
                      Math.abs(amount - (balance * p) / 100) < 0.001 && amount > 0
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-[#1a1d24] text-white/50 border border-white/8 hover:bg-[#22252e]'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {!continuousDemo && (
          <div
            className={`rounded-xl border border-white/[0.07] bg-[#0e1015] px-2.5 py-2 ${
              wagerLocked ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-extrabold text-amber-300">⚡ Leverage</span>
              <span className="text-[10px] text-white/45 tabular-nums">
                <span className="text-sky-400 font-extrabold">{notionalExposure.toFixed(2)}</span>
                {openFee > 0 && <span className="text-rose-300"> · {openFee.toFixed(3)} fee</span>}
              </span>
            </div>
            {leverage > 1 && (
              <div className="mb-1.5 text-[10px] font-bold text-amber-200/80 leading-snug">
                Anti-scalp: cash out from{' '}
                <span className="text-amber-300 font-extrabold">
                  {minExitMultiplierRatio(leverage).toFixed(2)}x
                </span>{' '}
                · 2% open fee on notional
              </div>
            )}
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
                disabled={wagerLocked}
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
                    disabled={wagerLocked}
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
                  disabled={wagerLocked}
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
          )}
        </div>

        <AnimatePresence initial={false}>
          {hasPosition && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-lg sm:rounded-xl border border-white/[0.07] bg-[#0e1015] px-2 py-1 sm:px-3 sm:py-2.5"
            >
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <div
                    className={
                      positionSide === 'buy'
                        ? 'text-emerald-400 font-extrabold text-[10px] sm:text-xs'
                        : 'text-rose-400 font-extrabold text-[10px] sm:text-xs'
                    }
                  >
                    {continuousDemo ? 'POS' : positionSide === 'buy' ? 'LONG' : 'SHORT'} ·{' '}
                    {positionAmount.toFixed(2)}
                    {lotCount > 1 ? (
                      <span className="text-white/40 font-bold"> · {lotCount}</span>
                    ) : null}
                    <span className="text-white/40 font-bold">
                      {' '}
                      @ {positionEntryPrice.toFixed(2)}x
                    </span>
                  </div>
                  <div className="text-[10px] text-white/45 mt-0.5 hidden sm:block">
                    {lotCount > 1 ? 'Σ ' : ''}ENTRY {positionEntryPrice.toFixed(3)}x
                    {phase === 'running' && ` · NOW ${mult.toFixed(3)}x`}
                  </div>
                  {lotBreakdown.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 border-t border-white/[0.06] pt-1.5 hidden sm:block">
                      {lotBreakdown.map((lot, i) => (
                        <div
                          key={`${lot.entry}-${i}`}
                          className="flex items-center justify-between gap-2 text-[10px] tabular-nums"
                        >
                          <span className="text-white/40">
                            {lot.amount.toFixed(3)} @ {lot.entry.toFixed(3)}x
                          </span>
                          <span
                            className={
                              lot.pnl >= 0 ? 'text-emerald-400/90 font-bold' : 'text-rose-400/90 font-bold'
                            }
                          >
                            {lot.pnl >= 0 ? '+' : ''}
                            {lot.pnl.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className={`text-right shrink-0 transition-colors duration-200 ${
                    positionPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  <div className="text-base sm:text-2xl font-black tabular-nums leading-none tracking-tight">
                    {pnlDisplay.text}
                  </div>
                  <div className="text-[10px] sm:text-xs font-extrabold tabular-nums opacity-85 mt-0.5 sm:mt-1">
                    {pnlDisplay.pct}%
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showCashoutPanel && (
          <div className="rounded-lg sm:rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-1 sm:px-2.5 sm:py-2">
            <div className="flex items-center gap-1 sm:gap-1.5">
              {CASH_OUT_PCTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCashOutPct(p)}
                  className={`flex-1 min-h-[28px] sm:min-h-[34px] rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-extrabold touch-manipulation ${
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
                className={`flex-[1.5] min-h-[28px] sm:min-h-[34px] rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-black touch-manipulation ${
                  canCashOut
                    ? 'bg-emerald-500 text-white border-b-2 border-emerald-700'
                    : 'bg-[#2a2c33] text-white/40 border border-white/10'
                }`}
              >
                {pendingAction === 'cashout' ? '…' : cashOutPct >= 1 ? 'CASH OUT' : `OUT ${cashOutPct * 100}%`}
              </button>
            </div>
            {cashOutError && (
              <div className="text-[10px] font-bold text-rose-200 mt-1">{cashOutError}</div>
            )}
          </div>
        )}

        {(entryNotice || cancelNotice || tradeError || (tradeBlockReason && !hasPosition && phase !== 'running')) &&
          walletConnected &&
          !pendingAction &&
          !cashoutFlash && (
            <div className="px-1 text-[10px] font-bold text-amber-200/90 leading-snug line-clamp-1 sm:line-clamp-none hidden sm:block">
              {tradeError ?? entryNotice ?? cancelNotice ?? tradeBlockReason}
            </div>
          )}

        <AnimatePresence>
          {cashoutFlash && (
            <motion.div
              key={`cashout-${cashoutFlash.exitMult}-${cashoutFlash.sold}`}
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="relative overflow-hidden rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-sky-500/15 px-2.5 py-2 sm:px-3 sm:py-3 shadow-[0_0_28px_rgba(16,185,129,0.28)] hidden sm:block"
            >
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                initial={{ x: '-120%' }}
                animate={{ x: '120%' }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-300/90">
                    {cashoutFlash.fullExit ? 'Position closed' : 'Partial cashout'}
                  </div>
                  <div className="mt-0.5 text-sm sm:text-base font-black text-white tracking-tight">
                    {cashoutFlash.fullExit
                      ? `Sold ${cashoutFlash.sold.toFixed(3)} ${CURRENCY_LABEL}`
                      : `Out ${Math.round(cashoutFlash.pct * 100)}% · ${cashoutFlash.sold.toFixed(3)} ${CURRENCY_LABEL}`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.08, type: 'spring', stiffness: 500, damping: 22 }}
                    className="text-xl sm:text-2xl font-black tabular-nums text-emerald-300"
                    style={{ textShadow: '0 0 18px rgba(52,211,153,0.45)' }}
                  >
                    {cashoutFlash.exitMult.toFixed(2)}x
                  </motion.div>
                  <div className="text-[10px] font-bold text-white/45 mt-0.5">exit price</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BUY / SELL */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
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
            className={`mx-2 mb-2 p-2 text-center text-xs font-extrabold rounded-xl hidden sm:block ${lastResult.won ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/25' : 'text-rose-300 bg-rose-500/15 border border-rose-500/25'}`}
          >
            {lastResult.won
              ? `+${lastResult.amount.toFixed(3)} ${CURRENCY_LABEL} @ ${lastResult.price.toFixed(2)}x${lastResult.bonusAmount ? ` (+${lastResult.bonusAmount.toFixed(3)} bonus)` : ''}`
              : `LOST ${Math.abs(lastResult.amount).toFixed(3)} ${CURRENCY_LABEL} — full stake @ rug`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
