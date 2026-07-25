'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useCrashStream } from '@/hooks/use-crash-stream';
import { useCompetitive } from '@/hooks/use-competitive';
import { useWallet } from '@/lib/wallet-context';
import { ChartCanvas } from '@/components/chart-canvas';
import { CrashControls } from '@/components/crash-controls';
import { HoldBonusBar } from '@/components/hold-bonus-bar';
import { LiveActivityFeed } from '@/components/LiveActivityFeed';
import { LastHundred } from '@/components/last-hundred';
import { MarketListings } from '@/components/market-listings';
import { isVaultConfigured } from '@/lib/chain/public-config';

const RUG_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  x: 50 + (((i * 17) % 100) - 50),
  y: 50 + (((i * 23) % 100) - 50),
}));

export function CrashView() {
  const { state, connected, trade, setAutoSell, walletConnected } = useCrashStream();
  const { wallet, connect, disconnect, holdBonuses } = useWallet();
  const { state: compState, recordCrashResult } = useCompetitive();
  const [mobileFull, setMobileFull] = useState(false);
  const processedResultRef = useRef<string | null>(null);
  const vaultEnabled = isVaultConfigured();

  const tryDemo = () => {
    disconnect();
    window.setTimeout(() => connect(), 0);
  };

  useEffect(() => {
    const lr = state?.lastResult;
    if (!lr || state.gameId == null) return;
    const fp = `${state.gameId}-${lr.won}-${lr.amount}-${lr.price}`;
    if (processedResultRef.current === fp) return;
    processedResultRef.current = fp;
    recordCrashResult(lr.won, lr.price);
  }, [state?.lastResult, state?.gameId, recordCrashResult]);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-arcade px-4">
        <div className="text-center">
          <div className="text-sm font-extrabold text-white/60">Connecting to arena…</div>
          <div className="text-xs text-white/35 mt-2">Provably fair · live stream</div>
        </div>
      </div>
    );
  }

  if (mobileFull) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#141518]/95 safe-bottom"
      >
        <div className="relative h-full w-full">
          <button
            onClick={() => setMobileFull(false)}
            className="absolute top-3 right-3 z-50 touch-target touch-manipulation px-4 py-2 text-sm font-extrabold bg-[#2a2c33] text-white rounded-xl border border-white/10"
          >
            Close
          </button>
          <ChartCanvas
            candles={state.candles}
            phase={state.phase}
            mult={state.mult}
            peakMult={state.peakMult}
            elapsed={state.elapsed}
            tradeTags={state.tradeTags}
            entryPrice={state.hasPosition ? state.positionEntryPrice : null}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 p-2 sm:p-3 max-w-[1700px] mx-auto w-full">
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-w-0">
        {/* mobile status bar */}
        <div className="sm:hidden cp-panel px-3 py-2.5 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="text-white/45 shrink-0">Round</span>
            <span className="text-sky-400 font-extrabold">#{state.currentRound.id}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/45 truncate">{state.buyersIn} in</span>
            <span className="text-white/25">·</span>
            <span className="text-emerald-400 shrink-0">↑{state.roundBuyVolume.toFixed(1)}</span>
            <span className="text-rose-400 shrink-0">↓{state.roundSellVolume.toFixed(1)}</span>
          </div>
          {state.currentRound.crashPoint != null && (
            <span className="text-rose-400 font-extrabold shrink-0">{state.currentRound.crashPoint.toFixed(2)}x</span>
          )}
        </div>

        {/* desktop status bar */}
        <div className="cp-panel px-4 py-2 items-center justify-between text-xs flex-wrap gap-2 hidden sm:flex">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="text-white/45">Round</span>
            <span className="text-sky-400 font-extrabold">#{state.currentRound.id}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/45">{state.buyersIn} in round</span>
            <span className="text-white/25">·</span>
            <span className="text-emerald-400">Buy {state.roundBuyVolume.toFixed(2)}</span>
            <span className="text-white/25">·</span>
            <span className="text-rose-400">Sell {state.roundSellVolume.toFixed(2)}</span>
            <span className="text-white/25">·</span>
            <span
              className={
                state.orderPressure > 0.02
                  ? 'text-emerald-400'
                  : state.orderPressure < -0.02
                    ? 'text-rose-400'
                    : 'text-white/45'
              }
            >
              Flow {state.orderPressure >= 0 ? '+' : ''}
              {(state.orderPressure * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <span>Seed:</span>
            <span className="text-amber-300/80 font-mono text-[11px]">{state.currentRound.serverSeedHash.slice(0, 16)}…</span>
            {state.currentRound.serverSeed && (
              <span className="text-emerald-400/80 font-mono text-[11px] ml-1">
                Revealed {state.currentRound.serverSeed.slice(0, 12)}…
              </span>
            )}
            {state.currentRound.crashPoint != null && (
              <span className="text-rose-400 font-extrabold ml-1">Crash {state.currentRound.crashPoint.toFixed(2)}x</span>
            )}
          </div>
        </div>

        {/* chart container — canvas untouched; HTML multiplier overlay only */}
        <div className="relative cp-panel overflow-hidden w-[100vw] max-w-none aspect-square shrink-0 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:w-full sm:aspect-auto sm:flex-1 sm:min-h-[480px] sm:h-[60vh]">
          <ChartCanvas
            candles={state.candles}
            phase={state.phase}
            mult={state.mult}
            peakMult={state.peakMult}
            elapsed={state.elapsed}
            tradeTags={state.tradeTags}
            entryPrice={state.hasPosition ? state.positionEntryPrice : null}
          />

          {(state.phase === 'running' || state.phase === 'crashed') && (
            <div
              className="pointer-events-none absolute inset-x-0 top-[12%] sm:top-[10%] flex justify-center z-[5]"
              aria-hidden
            >
              <div
                className={`font-extrabold tabular-nums text-center ${
                  state.phase === 'crashed' ? 'text-rose-400' : 'text-emerald-400'
                } text-5xl sm:text-6xl`}
                style={{ textShadow: '0 4px 24px rgba(0,0,0,0.55)' }}
              >
                {state.mult.toFixed(2)}x
              </div>
            </div>
          )}

          <button
            onClick={() => setMobileFull(true)}
            className="sm:hidden absolute top-3 right-3 z-20 touch-target touch-manipulation bg-[#2a2c33] border border-white/10 px-3 py-2 rounded-xl text-xs font-extrabold text-white"
          >
            Full
          </button>
          <AnimatePresence>
            {state.phase === 'waiting' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-[#141518]/60 backdrop-blur-sm z-10"
              >
                <div className="flex flex-col items-center gap-2 sm:gap-3 font-arcade">
                  <div className="text-sm font-extrabold text-white/60">Next round in</div>
                  <div className="text-5xl sm:text-6xl font-extrabold text-white tabular-nums" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                    {state.waitLeft.toFixed(1)}s
                  </div>
                  <div className="text-xs text-white/45">Seed committed · provably fair</div>
                </div>
              </motion.div>
            )}
            {state.phase === 'crashed' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-rose-950/50"
              >
                <motion.div
                  initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="absolute inset-0 flex flex-col items-center justify-center font-arcade px-4"
                >
                  <motion.div
                    className="text-5xl sm:text-7xl font-extrabold text-rose-400"
                    style={{ textShadow: '0 4px 24px rgba(0,0,0,0.55)' }}
                  >
                    RUGGED
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl sm:text-3xl font-extrabold text-white mt-3 sm:mt-4 tabular-nums"
                    style={{ textShadow: '0 4px 16px rgba(0,0,0,0.45)' }}
                  >
                    {state.peakMult.toFixed(2)}x
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-sm text-white/60 mt-2 font-bold"
                  >
                    {state.players} degens rekt
                  </motion.div>
                </motion.div>
                {RUG_PARTICLES.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: '50%', y: '50%', scale: 0, opacity: 1 }}
                    animate={{
                      x: `${p.x}%`,
                      y: `${p.y}%`,
                      scale: [0, 1, 0],
                      opacity: [1, 0.8, 0],
                    }}
                    transition={{ duration: 1, delay: i * 0.05 }}
                    className="absolute w-2 h-2 bg-rose-400 rounded-full"
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <HoldBonusBar active={holdBonuses.active} compact className="sm:hidden" />

        <CrashControls
          phase={state.phase}
          mult={state.mult}
          balance={walletConnected ? state.balance : wallet.blackballsBalance}
          hasPosition={state.hasPosition}
          positionSide={state.positionSide}
          positionAmount={state.positionAmount}
          positionLeverage={state.positionLeverage}
          positionEntryPrice={state.positionEntryPrice}
          waitLeft={state.waitLeft}
          autoSell={state.autoSell}
          lastResult={state.lastResult}
          holdBonuses={holdBonuses}
          walletConnected={walletConnected}
          isDemoWallet={wallet.connected && !wallet.isRealWallet}
          vaultEnabled={vaultEnabled}
          onConnect={connect}
          onTryDemo={vaultEnabled ? tryDemo : undefined}
          onTrade={trade}
          onSetAutoSell={setAutoSell}
        />
      </div>

      <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-2 sm:gap-3">
        <HoldBonusBar active={holdBonuses.active} className="hidden sm:block" />
        {compState.crashWinStreak >= 2 && (
          <div className="hidden sm:block cp-panel px-3 py-2 text-xs text-emerald-400 font-bold">
            📈 Crash win streak: <span className="font-extrabold">{compState.crashWinStreak}</span> — keep the momentum
          </div>
        )}
        <LastHundred history={state.history} />
        <div className="cp-panel min-h-[140px] sm:min-h-[180px] sm:flex-1 overflow-hidden">
          <LiveActivityFeed fallbackFeed={state.feed} />
        </div>
        <MarketListings />
      </div>
    </div>
  );
}
