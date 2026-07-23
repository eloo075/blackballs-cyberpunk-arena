'use client';
import { useState } from 'react';
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
  onConnect: () => void;
  onTrade: (side: 'buy' | 'sell', amount: number, leverage: number) => Promise<boolean>;
  onSetAutoSell: (v: number | null) => Promise<void>;
}

const PERCENTS = [10, 25, 50, 100];
const QUICK_ADD = [0.001, 0.01, 0.1, 1] as const;
const LEVERAGE_PRESETS = [1, 2, 5, 10, 25, 50] as const;

function leverageGlow(level: number): string {
  if (level >= 25) return 'rgba(255,0,60,0.55)';
  if (level >= 10) return 'rgba(252,238,10,0.55)';
  if (level >= 5) return 'rgba(157,0,255,0.45)';
  return 'rgba(0,240,255,0.35)';
}

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
  onConnect,
  onTrade,
  onSetAutoSell,
}: CrashControlsProps) {
  const [amount, setAmount] = useState(0.01);
  const [percent, setPercent] = useState(0);
  const [leverage, setLeverage] = useState(1);
  const [autoVal, setAutoVal] = useState('');
  const [busy, setBusy] = useState(false);

  const effectiveAmount = percent > 0 ? parseFloat((balance * percent / 100).toFixed(4)) : amount;
  const notionalExposure = parseFloat((effectiveAmount * leverage).toFixed(4));
  const canTrade = walletConnected && phase !== 'crashed' && !busy;
  const entryMult = phase === 'waiting' ? 1.0 : mult;

  const liveMult = hasPosition && phase === 'waiting' ? 1.0 : mult;
  const positionPct = hasPosition
    ? calcPositionPct(positionSide, positionLeverage, positionEntryPrice, liveMult)
    : 0;
  const positionPnl = hasPosition
    ? calcPositionPnl(positionSide, positionAmount, positionLeverage, positionEntryPrice, liveMult)
    : 0;

  const canOpenBuy =
    canTrade && (!hasPosition || positionSide === 'sell') && effectiveAmount > 0 && effectiveAmount <= balance;
  const canOpenSell =
    canTrade && (!hasPosition || positionSide === 'buy') && effectiveAmount > 0 && effectiveAmount <= balance;

  const bumpAmount = (delta: number) => {
    setAmount(parseFloat(Math.max(0, amount + delta).toFixed(4)));
    setPercent(0);
  };

  const handleTrade = async (side: 'buy' | 'sell') => {
    const closing = hasPosition && positionSide !== side;
    if (closing) {
      if (!canTrade) return;
    } else if (side === 'buy' ? !canOpenBuy : !canOpenSell) {
      return;
    }
    setBusy(true);
    await onTrade(side, closing ? positionAmount : effectiveAmount, closing ? positionLeverage : leverage);
    setBusy(false);
    if (!closing) setPercent(0);
  };

  const buyLabel = hasPosition
    ? positionSide === 'sell'
      ? 'CLOSE SHORT'
      : 'LONG OPEN'
    : phase === 'waiting'
      ? 'BUY LONG'
      : 'BUY';

  const sellLabel = hasPosition
    ? positionSide === 'buy'
      ? 'CLOSE LONG'
      : 'SHORT OPEN'
    : phase === 'waiting'
      ? 'SELL SHORT'
      : 'SELL';

  return (
    <div className="cp-panel p-0 font-mono relative safe-bottom overflow-hidden bg-[#0a0a0c] border border-white/10">
      {!walletConnected && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm px-4">
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/50 text-center">
            Connect to trade
          </span>
          <button
            onClick={onConnect}
            className="touch-target touch-manipulation px-6 py-3 text-xs font-black bg-gradient-to-r from-cp-cyan to-cp-purple text-white w-full max-w-[240px] rounded-lg"
          >
            CONNECT WALLET
          </button>
        </div>
      )}

      <div className="flex flex-col">
        {/* wager amount — dedicated neon panel */}
        <div
          className={`relative px-3 py-3 border-b border-cp-cyan/35 bg-gradient-to-r from-cp-cyan/5 via-cp-purple/5 to-cp-cyan/5 ${
            hasPosition ? 'opacity-50 pointer-events-none' : ''
          }`}
          style={{ boxShadow: 'inset 0 0 16px rgba(0,240,255,0.08), 0 0 8px rgba(0,240,255,0.12)' }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] neon-cyan">
              💰 WAGER AMOUNT
            </span>
            <span className="text-[9px] text-white/40">
              BALANCE{' '}
              <span className="neon-cyan font-bold">{balance.toFixed(3)}</span> $BlackBalls
            </span>
          </div>

          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border-2 border-cp-cyan/50 bg-black/60"
            style={{ boxShadow: '0 0 14px rgba(0,240,255,0.25), inset 0 0 10px rgba(0,240,255,0.06)' }}
          >
            <input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={percent > 0 ? effectiveAmount : amount}
              onChange={e => {
                setAmount(parseFloat(e.target.value) || 0);
                setPercent(0);
              }}
              disabled={hasPosition}
              placeholder="0.00"
              aria-label="Wager amount in BlackBalls"
              className="flex-1 min-w-0 bg-transparent text-2xl sm:text-3xl font-black text-white outline-none disabled:opacity-50 tabular-nums neon-cyan placeholder:text-white/20"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            />
            <span className="text-[11px] font-black neon-purple shrink-0">$BlackBalls</span>
          </div>

          {percent > 0 && (
            <div className="text-[9px] neon-cyan mb-2 text-center font-bold">
              Using {percent}% of balance = {effectiveAmount.toFixed(4)} $BlackBalls
            </div>
          )}

          <div className="text-[8px] text-white/35 uppercase tracking-wider mb-1">Quick add</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_ADD.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => bumpAmount(v)}
                disabled={hasPosition}
                className="flex-1 min-w-[52px] min-h-[32px] rounded-md text-[10px] font-bold touch-manipulation disabled:opacity-30 border border-white/10 bg-black/40 text-white/50 hover:border-cp-cyan/50 hover:text-cp-cyan hover:bg-cp-cyan/10"
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
              className="min-w-[40px] min-h-[32px] rounded-md text-[10px] font-bold touch-manipulation disabled:opacity-30 border border-white/10 bg-black/40 text-white/50 hover:border-cp-cyan/50 hover:text-cp-cyan"
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
              className="min-w-[40px] min-h-[32px] rounded-md text-[10px] font-bold touch-manipulation disabled:opacity-30 border border-white/10 bg-black/40 text-white/50 hover:border-cp-cyan/50 hover:text-cp-cyan"
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
              className="min-w-[48px] min-h-[32px] rounded-md text-[10px] font-black touch-manipulation disabled:opacity-30 border-2 border-cp-yellow/60 bg-cp-yellow/10 neon-yellow hover:bg-cp-yellow/20"
            >
              MAX
            </button>
          </div>

          <div className="text-[8px] text-white/35 uppercase tracking-wider mb-1">% of balance</div>
          <div className="flex gap-1.5">
            {PERCENTS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPercent(p)}
                disabled={hasPosition}
                className={`flex-1 min-h-[34px] rounded-md text-[11px] font-black touch-manipulation disabled:opacity-30 ${
                  percent === p
                    ? 'neon-cyan bg-cp-cyan/15 border-2 border-cp-cyan'
                    : 'text-white/45 bg-black/40 border border-white/10 hover:border-cp-cyan/40 hover:text-cp-cyan'
                }`}
                style={percent === p ? { boxShadow: '0 0 12px rgba(0,240,255,0.35)' } : undefined}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* leverage — dedicated neon panel */}
        <div
          className={`relative px-3 py-3 border-b border-cp-yellow/30 bg-gradient-to-r from-cp-yellow/5 via-cp-purple/5 to-cp-yellow/5 ${
            hasPosition ? 'opacity-50 pointer-events-none' : ''
          }`}
          style={{
            boxShadow:
              leverage > 1
                ? `inset 0 0 24px ${leverageGlow(leverage)}, 0 0 12px ${leverageGlow(leverage)}`
                : 'inset 0 0 12px rgba(252,238,10,0.08)',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] neon-yellow">
                ⚡ LEVERAGE
              </span>
              {leverage > 1 && (
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-cp-magenta/50 text-cp-magenta bg-cp-magenta/10 cp-pulse">
                  DEGEN MODE
                </span>
              )}
            </div>
            <span className="text-[9px] text-white/40">
              EXPOSURE{' '}
              <span className="neon-cyan font-bold">{notionalExposure.toFixed(3)}</span> $BlackBalls
            </span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <motion.div
              key={leverage}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              className="shrink-0 min-w-[72px] text-center px-2 py-1 rounded-lg border border-cp-yellow/50 bg-black/60"
              style={{
                boxShadow: `0 0 16px ${leverageGlow(leverage)}, inset 0 0 12px ${leverageGlow(leverage)}`,
              }}
            >
              <div
                className="text-2xl sm:text-3xl font-black leading-none neon-yellow tabular-nums"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {leverage}x
              </div>
            </motion.div>

            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={leverage}
                onChange={e => setLeverage(parseInt(e.target.value))}
                disabled={hasPosition}
                className="leverage-slider w-full h-2.5 cursor-pointer touch-manipulation disabled:opacity-30"
                style={{
                  ['--lev-pct' as string]: `${((leverage - 1) / 49) * 100}%`,
                  ['--lev-glow' as string]: leverageGlow(leverage),
                }}
              />
              <div className="flex justify-between text-[8px] text-white/35 uppercase tracking-wider">
                <span>1x safe</span>
                <span className="neon-magenta">50x max</span>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5">
            {LEVERAGE_PRESETS.map(preset => {
              const active = leverage === preset;
              const hot = preset >= 10;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLeverage(preset)}
                  disabled={hasPosition}
                  className={`flex-1 min-h-[34px] rounded-md text-[11px] font-black touch-manipulation transition-all disabled:opacity-30 ${
                    active
                      ? hot
                        ? 'neon-magenta bg-cp-magenta/20 border-2 border-cp-magenta'
                        : 'neon-yellow bg-cp-yellow/15 border-2 border-cp-yellow'
                      : 'text-white/45 bg-black/40 border border-white/10 hover:border-cp-yellow/40 hover:text-cp-yellow'
                  }`}
                  style={
                    active
                      ? {
                          boxShadow: hot
                            ? '0 0 14px rgba(255,0,60,0.45)'
                            : '0 0 14px rgba(252,238,10,0.35)',
                        }
                      : undefined
                  }
                >
                  {preset}x
                </button>
              );
            })}
          </div>
        </div>

        {/* auto take-profit */}
        <div className="flex items-center justify-between px-3 py-2 text-[10px] border-b border-white/10 bg-black/30">
          <span className="text-white/35 text-[9px] uppercase tracking-wider">
            {holdBonuses.stimmy > 0
              ? `+${Math.round(holdBonuses.stimmy * 100)}% stimmy active`
              : 'Wager → leverage → BUY / SELL'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-white/30 uppercase text-[9px] tracking-wider">Auto TP</span>
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
              className="w-16 bg-black/50 border border-cp-yellow/30 px-2 py-1 text-[10px] text-cp-yellow text-right outline-none focus:border-cp-yellow/60 focus:shadow-[0_0_8px_rgba(252,238,10,0.3)]"
            />
            <span className="text-white/30">x</span>
          </div>
        </div>

        {/* open position panel */}
        <AnimatePresence>
          {hasPosition && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-2 border-b border-white/10 bg-black/40 overflow-hidden"
            >
              <div className="flex items-center justify-between text-[11px] gap-2">
                <span className={positionSide === 'buy' ? 'text-cp-green font-bold' : 'text-cp-magenta font-bold'}>
                  {positionSide === 'buy' ? 'LONG' : 'SHORT'} · {positionAmount.toFixed(3)} $BlackBalls
                </span>
                <span
                  className={`font-black px-2 py-0.5 rounded border text-[11px] shrink-0 ${
                    positionLeverage >= 10
                      ? 'neon-magenta border-cp-magenta/60 bg-cp-magenta/15'
                      : positionLeverage > 1
                        ? 'neon-yellow border-cp-yellow/60 bg-cp-yellow/10'
                        : 'text-white/50 border-white/20'
                  }`}
                  style={
                    positionLeverage > 1
                      ? { boxShadow: `0 0 10px ${leverageGlow(positionLeverage)}` }
                      : undefined
                  }
                >
                  {positionLeverage}x LEV
                </span>
                <span className={positionPnl >= 0 ? 'text-cp-green font-bold' : 'text-cp-magenta font-bold'}>
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
        <div className="grid grid-cols-2 gap-0 p-2 bg-[#0d0d10]">
          <button
            onClick={() => handleTrade('buy')}
            disabled={hasPosition ? positionSide !== 'sell' || !canTrade : !canOpenBuy}
            className="touch-manipulation min-h-[56px] sm:min-h-[52px] mx-1 rounded-xl font-black text-base sm:text-sm tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(180deg, #1a4d2e 0%, #0d2818 100%)',
              color: '#4ade80',
              boxShadow: canOpenBuy || (hasPosition && positionSide === 'sell')
                ? '0 0 20px rgba(74,222,128,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                : undefined,
              border: '1px solid rgba(74,222,128,0.3)',
            }}
          >
            {buyLabel}
            {!hasPosition && (
              <span className="block text-[10px] font-bold neon-cyan mt-0.5">
                {effectiveAmount.toFixed(3)} $BlackBalls
                {leverage > 1 ? ` · ${leverage}x` : ''}
              </span>
            )}
            {!hasPosition && phase === 'waiting' && leverage <= 1 && (
              <span className="block text-[9px] font-normal opacity-50">{waitLeft.toFixed(1)}s to round</span>
            )}
          </button>
          <button
            onClick={() => handleTrade('sell')}
            disabled={hasPosition ? positionSide !== 'buy' || !canTrade : !canOpenSell}
            className="touch-manipulation min-h-[56px] sm:min-h-[52px] mx-1 rounded-xl font-black text-base sm:text-sm tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(180deg, #4d1a1a 0%, #280d0d 100%)',
              color: '#f87171',
              boxShadow: canOpenSell || (hasPosition && positionSide === 'buy')
                ? '0 0 20px rgba(248,113,113,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                : undefined,
              border: '1px solid rgba(248,113,113,0.3)',
            }}
          >
            {sellLabel}
            {!hasPosition && (
              <span className="block text-[10px] font-bold neon-cyan mt-0.5">
                {effectiveAmount.toFixed(3)} $BlackBalls
                {leverage > 1 ? ` · ${leverage}x` : ''}
              </span>
            )}
            {!hasPosition && phase === 'waiting' && leverage <= 1 && (
              <span className="block text-[9px] font-normal opacity-50">@ {entryMult.toFixed(2)}x entry</span>
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
            className={`mx-2 mb-2 p-2 text-center text-xs font-bold rounded-lg ${lastResult.won ? 'text-cp-green bg-cp-green/10 border border-cp-green/30' : 'text-cp-magenta bg-cp-magenta/10 border border-cp-magenta/30'}`}
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
