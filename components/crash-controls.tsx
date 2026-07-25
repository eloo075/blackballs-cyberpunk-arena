'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HoldBonuses } from '@/lib/hold-bonuses';
import { calcPositionPct, calcPositionPnl } from '@/lib/crash-pnl';

interface CrashControlsProps {
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  balance: number;
  hasPosition: boolean;
  positionSide: 'buy' | 'sell';
  positionAmount: number;
  positionLeverage: number;
  positionEntryPrice: number;
  waitLeft: number;
  autoSell: number | null;
  lastResult: { won: boolean; amount: number; price: number; bonusAmount?: number; frenzyProc?: boolean } | null;
  holdBonuses: HoldBonuses;
  walletConnected: boolean;
  isDemoWallet?: boolean;
  vaultEnabled?: boolean;
  onConnect: () => void;
  onTryDemo?: () => void;
  onTrade: (side: 'buy' | 'sell', amount: number, leverage: number) => Promise<{ ok: boolean; error?: string }>;
  onSetAutoSell: (v: number | null) => Promise<void>;
}

const PERCENTS = [10, 25, 50, 100];
const QUICK_ADD = [0.001, 0.01, 0.1, 1] as const;
const LEVERAGE_PRESETS = [1, 1.5, 2, 5, 10, 25, 50] as const;
const WAIT_FOR_ROUND_MSG = 'Wait for the next round — BUY/SELL open during the countdown.';

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
  'bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all';
const ARCADE_BTN_SELL =
  'bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl border-b-4 border-rose-700 active:border-b-0 active:translate-y-1 transition-all';

export function CrashControls({
  phase,
  mult,
  balance,
  hasPosition,
  positionSide,
  positionAmount,
  positionLeverage,
  positionEntryPrice,
  waitLeft,
  lastResult,
  holdBonuses,
  walletConnected,
  isDemoWallet = false,
  vaultEnabled = false,
  onConnect,
  onTryDemo,
  onTrade,
  onSetAutoSell,
}: CrashControlsProps) {
  const [amount, setAmount] = useState(0.01);
  const [percent, setPercent] = useState(0);
  const [leverage, setLeverage] = useState(1);
  const [autoVal, setAutoVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const entriesOpen = phase === 'waiting';
  const safeAmount = clampWager(
    percent > 0 ? parseFloat((balance * percent / 100).toFixed(4)) : amount,
    balance,
  );
  const notionalExposure = parseFloat((safeAmount * leverage).toFixed(4));

  const liveMult = hasPosition && phase === 'waiting' ? 1.0 : mult;
  const positionPct = hasPosition
    ? calcPositionPct(positionSide, positionLeverage, positionEntryPrice, liveMult)
    : 0;
  const positionPnl = hasPosition
    ? calcPositionPnl(positionSide, positionAmount, positionLeverage, positionEntryPrice, liveMult)
    : 0;

  useEffect(() => {
    if (balance > 0 && amount > balance) {
      setAmount(clampWager(amount, balance));
    }
    if (balance > 0 && balance < 0.01 && amount > balance) {
      setAmount(clampWager(balance, balance));
    }
  }, [balance, amount]);

  const canOpenBuy =
    walletConnected &&
    entriesOpen &&
    !busy &&
    !hasPosition &&
    safeAmount > 0 &&
    safeAmount <= balance + 0.0005;
  const canOpenSell = canOpenBuy;

  const canCloseBuy = walletConnected && entriesOpen && !busy && hasPosition && positionSide === 'sell';
  const canCloseSell = walletConnected && entriesOpen && !busy && hasPosition && positionSide === 'buy';

  const buyLooksActive = hasPosition ? canCloseBuy : canOpenBuy;
  const sellLooksActive = hasPosition ? canCloseSell : canOpenSell;

  const tradeBlockReason = (() => {
    if (!walletConnected) return null;
    if (phase === 'running' || phase === 'crashed') {
      return hasPosition
        ? `${WAIT_FOR_ROUND_MSG} Your position settles when the round crashes.`
        : WAIT_FOR_ROUND_MSG;
    }
    if (busy) return 'Processing trade…';
    if (!hasPosition && balance <= 0 && vaultEnabled && !isDemoWallet) {
      return 'Vault balance is 0 — deposit $BlackBalls via VAULT (top bar) to trade for real.';
    }
    if (!hasPosition && balance <= 0) {
      return 'Balance is 0 — connect with demo credits or deposit to play.';
    }
    if (!hasPosition && safeAmount > balance + 0.0005) {
      return `Wager (${safeAmount.toFixed(3)}) exceeds balance (${balance.toFixed(3)}). Lower amount or use MAX.`;
    }
    if (!hasPosition && safeAmount <= 0) {
      return 'Set a wager amount above 0.';
    }
    if (entriesOpen && !hasPosition) {
      return `${waitLeft.toFixed(1)}s left to enter before round starts @ 1.00x`;
    }
    return null;
  })();

  const bumpAmount = (delta: number) => {
    setAmount(parseFloat(Math.max(0, amount + delta).toFixed(4)));
    setPercent(0);
  };

  const handleTrade = async (side: 'buy' | 'sell') => {
    if (!walletConnected || busy) return;

    if (phase === 'running' || phase === 'crashed') {
      setTradeError(WAIT_FOR_ROUND_MSG);
      return;
    }

    const closing = hasPosition && positionSide !== side;
    if (closing) {
      if (!canCloseBuy && side === 'buy') return;
      if (!canCloseSell && side === 'sell') return;
    } else if (side === 'buy' ? !canOpenBuy : !canOpenSell) {
      if (safeAmount <= 0) setTradeError('Set a wager amount above 0.');
      else if (safeAmount > balance) setTradeError(`Insufficient balance (${balance.toFixed(3)} available).`);
      return;
    }

    setBusy(true);
    setTradeError(null);
    const wager = closing ? positionAmount : safeAmount;
    const result = await onTrade(side, wager, closing ? positionLeverage : leverage);
    setBusy(false);
    if (!result.ok) {
      const msg = result.error ?? 'Trade failed — check balance or try again.';
      setTradeError(msg === 'invalid amount' ? `Insufficient balance (${balance.toFixed(3)} available).` : msg);
    }
    if (!closing) setPercent(0);
  };

  const buyLabel = hasPosition
    ? positionSide === 'sell'
      ? 'CLOSE SHORT'
      : 'LONG LOCKED'
    : 'BUY LONG';

  const sellLabel = hasPosition
    ? positionSide === 'buy'
      ? 'CLOSE LONG'
      : 'SHORT LOCKED'
    : 'SELL SHORT';

  return (
    <div className="cp-panel p-0 font-arcade relative safe-bottom overflow-hidden">
      {!walletConnected && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#141518]/90 backdrop-blur-sm px-4 rounded-2xl">
          <span className="text-sm font-extrabold text-white/70 text-center">
            Connect to trade
          </span>
          <p className="text-xs text-white/45 text-center max-w-[260px] leading-relaxed">
            {vaultEnabled
              ? 'Real play: connect wallet + deposit in VAULT. Or try demo mode with free credits.'
              : 'Demo mode — connect for free $BlackBalls credits to practice.'}
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
          className={`relative px-4 py-3 border-b border-white/5 bg-[#25262c] ${
            hasPosition ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-extrabold text-white/80">
              💰 Wager Amount
            </span>
            <span className="text-[11px] text-white/45">
              Balance{' '}
              <span className="text-sky-400 font-extrabold">{balance.toFixed(3)}</span> $BlackBalls
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border border-white/10 bg-[#1f2025]">
            <input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={percent > 0 ? safeAmount : amount}
              onChange={e => {
                setAmount(parseFloat(e.target.value) || 0);
                setPercent(0);
              }}
              disabled={hasPosition}
              placeholder="0.00"
              aria-label="Wager amount in BlackBalls"
              className="flex-1 min-w-0 bg-transparent text-2xl sm:text-3xl font-extrabold text-white outline-none disabled:opacity-50 tabular-nums placeholder:text-white/20"
            />
            <span className="text-xs font-extrabold text-white/50 shrink-0">$BlackBalls</span>
          </div>

          {percent > 0 && (
            <div className="text-[11px] text-sky-400 mb-2 text-center font-bold">
              Using {percent}% of balance = {safeAmount.toFixed(4)} $BlackBalls
            </div>
          )}

          <div className="text-[10px] text-white/40 font-bold mb-1">Quick add</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_ADD.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => bumpAmount(v)}
                disabled={hasPosition}
                className="flex-1 min-w-[52px] min-h-[32px] rounded-lg text-xs font-bold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-white/60 border border-white/10 hover:bg-[#353842]"
              >
                +{v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAmount(parseFloat((amount / 2).toFixed(4)));
                setPercent(0);
              }}
              disabled={hasPosition}
              className="min-w-[40px] min-h-[32px] rounded-lg text-xs font-bold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-white/60 border border-white/10 hover:bg-[#353842]"
            >
              ½
            </button>
            <button
              type="button"
              onClick={() => {
                setAmount(parseFloat((amount * 2).toFixed(4)));
                setPercent(0);
              }}
              disabled={hasPosition}
              className="min-w-[40px] min-h-[32px] rounded-lg text-xs font-bold touch-manipulation disabled:opacity-30 bg-[#2a2c33] text-white/60 border border-white/10 hover:bg-[#353842]"
            >
              2×
            </button>
            <button
              type="button"
              onClick={() => {
                setAmount(parseFloat(balance.toFixed(4)));
                setPercent(0);
              }}
              disabled={hasPosition}
              className="min-w-[48px] min-h-[32px] rounded-lg text-xs font-extrabold touch-manipulation disabled:opacity-30 bg-amber-400 text-black border-b-2 border-amber-600 hover:bg-amber-300"
            >
              MAX
            </button>
          </div>

          <div className="text-[10px] text-white/40 font-bold mb-1">% of balance</div>
          <div className="flex gap-1.5">
            {PERCENTS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPercent(p)}
                disabled={hasPosition}
                className={`flex-1 min-h-[36px] rounded-lg text-xs font-extrabold touch-manipulation disabled:opacity-30 ${
                  percent === p
                    ? 'bg-sky-500 text-white border-b-[3px] border-sky-700'
                    : 'bg-[#2a2c33] text-white/55 border border-white/10 hover:bg-[#353842]'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* leverage */}
        <div
          className={`relative px-4 py-3 border-b border-white/5 bg-[#25262c] ${
            hasPosition ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-amber-300">
                ⚡ Leverage
              </span>
              {leverage > 1 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  DEGEN MODE
                </span>
              )}
            </div>
            <span className="text-[11px] text-white/45">
              Exposure{' '}
              <span className="text-sky-400 font-extrabold">{notionalExposure.toFixed(3)}</span> $BlackBalls
            </span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="shrink-0 min-w-[72px] text-center px-3 py-1.5 rounded-full bg-amber-400 text-black border-b-[3px] border-amber-600">
              <div className="text-2xl sm:text-3xl font-extrabold leading-none tabular-nums">
                {leverage % 1 === 0 ? `${leverage}x` : `${leverage.toFixed(1)}x`}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <input
                type="range"
                min="1"
                max="50"
                step="0.5"
                value={leverage}
                onChange={e => setLeverage(parseFloat(e.target.value))}
                disabled={hasPosition}
                className="leverage-slider w-full h-2.5 cursor-pointer touch-manipulation disabled:opacity-30"
                style={{
                  ['--lev-pct' as string]: `${((leverage - 1) / 49) * 100}%`,
                }}
              />
              <div className="flex justify-between text-[10px] text-white/40 font-bold">
                <span>1x safe</span>
                <span className="text-rose-400">50x max</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {LEVERAGE_PRESETS.map(preset => {
              const active = leverage === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLeverage(preset)}
                  disabled={hasPosition}
                  className={`flex-1 min-w-[40px] min-h-[36px] rounded-full text-xs font-extrabold touch-manipulation transition-all disabled:opacity-30 ${leveragePillClass(preset, active)}`}
                >
                  {preset}x
                </button>
              );
            })}
          </div>
        </div>

        {/* auto take-profit */}
        <div className="flex items-center justify-between px-4 py-2.5 text-xs border-b border-white/5 bg-[#1f2025]">
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
        <AnimatePresence>
          {hasPosition && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-2 border-b border-white/5 bg-[#25262c] overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <span className={positionSide === 'buy' ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold'}>
                  {positionSide === 'buy' ? 'LONG' : 'SHORT'} · {positionAmount.toFixed(3)} $BlackBalls
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
                  {positionPnl >= 0 ? '+' : ''}
                  {positionPnl.toFixed(3)} ({positionPct >= 0 ? '+' : ''}
                  {positionPct.toFixed(1)}%)
                </span>
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                ENTRY {positionEntryPrice.toFixed(4)}x
                {phase === 'waiting' && ' · LIVE @ ROUND START'}
                {phase === 'running' && ` · NOW ${mult.toFixed(4)}x`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BUY / SELL */}
        {(tradeBlockReason || tradeError) && walletConnected && (
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
        {walletConnected && isDemoWallet && (
          <div className="mx-3 mt-2 px-3 py-1.5 text-[11px] text-center text-emerald-300 border border-emerald-500/20 bg-emerald-500/10 rounded-xl font-bold">
            DEMO MODE · off-chain credits · no real tokens at risk
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 p-3">
          <button
            onClick={() => handleTrade('buy')}
            disabled={busy}
            className={`touch-manipulation min-h-[56px] py-3 px-4 text-sm sm:text-base ${ARCADE_BTN_BUY} ${
              busy || !buyLooksActive ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {buyLabel}
            {!hasPosition && (
              <span className="block text-xs font-bold opacity-90 mt-0.5">
                {safeAmount.toFixed(3)} $BlackBalls
                {leverage > 1 ? ` · ${leverage}x` : ''}
              </span>
            )}
            {!hasPosition && entriesOpen && (
              <span className="block text-[11px] font-bold opacity-70">{waitLeft.toFixed(1)}s to enter @ 1.00x</span>
            )}
            {!entriesOpen && !hasPosition && (
              <span className="block text-[11px] font-bold opacity-70">ROUND LIVE</span>
            )}
          </button>
          <button
            onClick={() => handleTrade('sell')}
            disabled={busy}
            className={`touch-manipulation min-h-[56px] py-3 px-4 text-sm sm:text-base ${ARCADE_BTN_SELL} ${
              busy || !sellLooksActive ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {sellLabel}
            {!hasPosition && (
              <span className="block text-xs font-bold opacity-90 mt-0.5">
                {safeAmount.toFixed(3)} $BlackBalls
                {leverage > 1 ? ` · ${leverage}x` : ''}
              </span>
            )}
            {!hasPosition && entriesOpen && (
              <span className="block text-[11px] font-bold opacity-70">{waitLeft.toFixed(1)}s to enter @ 1.00x</span>
            )}
            {!entriesOpen && !hasPosition && (
              <span className="block text-[11px] font-bold opacity-70">ROUND LIVE</span>
            )}
          </button>
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
              ? `+${lastResult.amount.toFixed(3)} $BlackBalls @ ${lastResult.price.toFixed(2)}x${lastResult.bonusAmount ? ` (+${lastResult.bonusAmount.toFixed(3)} bonus)` : ''}${lastResult.frenzyProc ? ' · FRENZY!' : ''}`
              : `${lastResult.amount >= 0 ? '+' : ''}${lastResult.amount.toFixed(3)} $BlackBalls @ ${lastResult.price.toFixed(2)}x`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
