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
      <div className="flex items-center justify-center min-h-[50vh] font-mono px-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] neon-cyan cp-pulse">// CONNECTING_TO_ARENA</div>
          <div className="text-[9px] text-white/30 mt-2">PROVABLY_FAIR · SSE_STREAM</div>
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
        className="fixed inset-0 z-50 bg-black/95 safe-bottom"
      >
        <div className="relative h-full w-full">
          <button
            onClick={() => setMobileFull(false)}
            className="absolute top-3 right-3 z-50 cp-btn touch-target touch-manipulation px-4 py-2 text-xs font-black bg-black/80 border border-cp-cyan/40"
          >
            CLOSE
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
        {/* compact mobile status bar */}
        <div className="sm:hidden cp-panel px-2.5 py-2 flex items-center justify-between font-mono text-[9px] gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-cp-green cp-pulse' : 'bg-cp-magenta'}`} />
            <span className="text-white/40 shrink-0">ROUND</span>
            <span className="neon-cyan font-bold">#{state.currentRound.id}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/40 truncate">{state.buyersIn} IN</span>
            <span className="text-white/25">·</span>
            <span className="text-cp-green shrink-0">↑{state.roundBuyVolume.toFixed(1)}</span>
            <span className="text-cp-magenta shrink-0">↓{state.roundSellVolume.toFixed(1)}</span>
          </div>
          {state.currentRound.crashPoint != null && (
            <span className="text-cp-magenta font-bold shrink-0">{state.currentRound.crashPoint.toFixed(2)}x</span>
          )}
        </div>

        {/* desktop provably fair bar */}
        <div className="cp-panel px-3 py-1.5 items-center justify-between font-mono text-[9px] flex-wrap gap-1 hidden sm:flex">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-cp-green cp-pulse' : 'bg-cp-magenta'}`} />
            <span className="text-white/40">ROUND</span>
            <span className="neon-cyan font-bold">#{state.currentRound.id}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/40">{state.buyersIn} IN ROUND</span>
            <span className="text-white/30">·</span>
            <span className="text-cp-green">BUY {state.roundBuyVolume.toFixed(2)}</span>
            <span className="text-white/30">·</span>
            <span className="text-cp-magenta">SELL {state.roundSellVolume.toFixed(2)}</span>
            <span className="text-white/30">·</span>
            <span
              className={
                state.orderPressure > 0.02
                  ? 'text-cp-green'
                  : state.orderPressure < -0.02
                    ? 'text-cp-magenta'
                    : 'text-white/40'
              }
            >
              FLOW {state.orderPressure >= 0 ? '+' : ''}
              {(state.orderPressure * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/30">SEED:</span>
            <span className="text-cp-yellow/70 font-mono">{state.currentRound.serverSeedHash.slice(0, 16)}...</span>
            {state.currentRound.serverSeed && (
              <span className="text-cp-green/70 font-mono ml-1">
                REVEALED {state.currentRound.serverSeed.slice(0, 12)}...
              </span>
            )}
            {state.currentRound.crashPoint != null && (
              <span className="text-cp-magenta font-bold ml-1">CRASH {state.currentRound.crashPoint.toFixed(2)}x</span>
            )}
          </div>
        </div>

        {/* chart — full-bleed square on mobile */}
        <div className="relative cp-panel overflow-hidden scanlines hud-corners w-[100vw] max-w-none aspect-square shrink-0 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:w-full sm:aspect-auto sm:flex-1 sm:min-h-[480px] sm:h-[60vh]">
          <ChartCanvas
            candles={state.candles}
            phase={state.phase}
            mult={state.mult}
            peakMult={state.peakMult}
            elapsed={state.elapsed}
            tradeTags={state.tradeTags}
            entryPrice={state.hasPosition ? state.positionEntryPrice : null}
          />
          <button
            onClick={() => setMobileFull(true)}
            className="sm:hidden absolute top-3 right-3 z-20 cp-btn touch-target touch-manipulation bg-black/70 border border-cp-cyan/30 px-3 py-2 rounded font-mono text-[11px] font-bold"
          >
            FULL
          </button>
          <AnimatePresence>
            {state.phase === 'waiting' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10"
              >
                <div className="flex flex-col items-center gap-2 sm:gap-3 font-mono">
                  <div className="text-[10px] uppercase tracking-[0.3em] neon-cyan">// NEXT_ROUND</div>
                  <div
                    className="text-4xl sm:text-5xl font-black neon-cyan"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    {state.waitLeft.toFixed(1)}s
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-white/40">SEED_COMMITTED · PROVABLY_FAIR</div>
                </div>
              </motion.div>
            )}
            {state.phase === 'crashed' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10"
                style={{ background: 'linear-gradient(180deg, rgba(255,0,60,0.4), rgba(60,0,20,0.7))' }}
              >
                <motion.div
                  initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="absolute inset-0 flex flex-col items-center justify-center font-mono px-4"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      textShadow: [
                        '0 0 20px rgba(255,0,60,0.8)',
                        '0 0 40px rgba(255,0,60,1)',
                        '0 0 20px rgba(255,0,60,0.8)',
                      ],
                    }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-5xl sm:text-7xl font-black neon-magenta glitch-text"
                    data-text="RUGGED"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    RUGGED
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl sm:text-2xl font-bold text-white mt-3 sm:mt-4"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    {state.peakMult.toFixed(2)}x
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-xs sm:text-sm text-white/60 mt-2"
                  >
                    {state.players} DEGENS REKT
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
                    className="absolute w-2 h-2 bg-cp-magenta rounded-full"
                    style={{ boxShadow: '0 0 10px rgba(255,0,60,0.8)' }}
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
          <div className="hidden sm:block cp-panel px-3 py-1.5 text-[9px] text-cp-green border border-cp-green/30">
            📈 Crash win streak: <span className="font-black">{compState.crashWinStreak}</span> — keep the momentum
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
