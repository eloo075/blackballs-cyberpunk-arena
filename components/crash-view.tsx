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
import { CrashStatsPanel } from '@/components/crash-stats-panel';
import { VerifyRoundButton } from '@/components/verify-round-button';
import { HallOfFameToday } from '@/components/hall-of-fame-today';
import { LoginStreakBanner } from '@/components/login-streak-banner';
import { ResultFeedback } from '@/components/result-feedback';
import { useResultFeedback } from '@/hooks/use-result-feedback';
import { recordHallOfFame } from '@/lib/player-retention';
import { isVaultConfigured } from '@/lib/chain/public-config';
import { resolvePlayableBalance, resolveClientSyncBalance } from '@/lib/session-balance';
import { CrashMobileHeader } from '@/components/crash-mobile-header';
import { syncGameSessionBalances } from '@/lib/sync-game-sessions';
import { useGameTabFocus } from '@/lib/use-game-tab-focus';
import { useExtrapolatedCrashDisplay } from '@/hooks/use-extrapolated-crash-display';
import { SmoothMultiplier } from '@/components/smooth-multiplier';

const RUG_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  x: 50 + (((i * 17) % 100) - 50),
  y: 50 + (((i * 23) % 100) - 50),
}));

export function CrashView({ visible = true }: { visible?: boolean }) {
  const { state, connected, reconnecting, sessionReady, roundEpoch, streamEpoch, trade, cancelActivePosition, cashOut, setAutoSell, refreshGameState, walletConnected } = useCrashStream();
  const { wallet, connect, disconnect, holdBonuses, displayAddress, refillDemoCredits } = useWallet();
  const { state: compState, recordCrashResult } = useCompetitive();
  const { event: resultEvent, trigger: triggerResult, dismiss: dismissResult } = useResultFeedback();
  const display = useExtrapolatedCrashDisplay(state, visible);
  const [mobileFull, setMobileFull] = useState(false);
  const processedResultRef = useRef<string | null>(null);
  const vaultEnabled = isVaultConfigured();

  useGameTabFocus(
    visible,
    {
      address: wallet.connected ? wallet.address : null,
      connected: wallet.connected,
      balance: resolveClientSyncBalance(wallet),
      stimmy: holdBonuses.stimmy,
      frenzy: holdBonuses.frenzy,
      holdsBlackballs: holdBonuses.active.some(b => b.token === 'BLACKBALLS'),
      isRealWallet: wallet.isRealWallet,
    },
    refreshGameState,
  );

  const tryDemo = () => {
    disconnect();
    window.setTimeout(() => connect(), 0);
  };

  const handleDemoRefill = async () => {
    if (!wallet.connected || wallet.isRealWallet || !wallet.address) return;
    const balance = refillDemoCredits();
    const holdsBb = holdBonuses.active.some(b => b.token === 'BLACKBALLS');
    await syncGameSessionBalances(
      wallet.address,
      balance,
      holdBonuses.stimmy,
      holdBonuses.frenzy,
      holdsBb,
      wallet.isRealWallet,
    );
  };

  useEffect(() => {
    const lr = state?.lastResult;
    if (!lr || state.phase !== 'crashed' || state.currentRound.crashPoint == null) return;
    const fp = `${state.currentRound.id}-${lr.won}-${lr.amount}-${lr.price}`;
    if (processedResultRef.current === fp) return;
    processedResultRef.current = fp;
    recordCrashResult(lr.won, lr.price);

    const totalProfit = lr.amount + (lr.bonusAmount ?? 0);
    const isWin = totalProfit > 0.0001;
    const crashAt =
      state.currentRound.mode === 'continuous' ? 0.01 : state.currentRound.crashPoint;
    if (isWin) {
      triggerResult({
        won: true,
        amount: totalProfit,
        subtitle: `@ ${lr.price.toFixed(2)}x${lr.bonusAmount ? ` · +${lr.bonusAmount.toFixed(2)} bonus` : ''}${lr.frenzyProc ? ' · FRENZY' : ''}`,
        multiplier: lr.price,
      });
      if (lr.price >= 8 && wallet.address) {
        recordHallOfFame({
          player: displayAddress?.slice(0, 8) ?? 'YOU',
          multiplier: lr.price,
          profit: totalProfit,
        });
      }
    } else {
      const lossAmount = totalProfit < 0 ? totalProfit : -Math.abs(lr.amount);
      triggerResult({
        won: false,
        amount: lossAmount,
        subtitle:
          lr.price <= 1.01
            ? `Rugged @ ${crashAt.toFixed(2)}x`
            : `@ ${lr.price.toFixed(2)}x`,
        multiplier: crashAt,
      });
    }
  }, [state?.lastResult, state?.phase, state?.currentRound.id, state?.currentRound.crashPoint, state?.currentRound.mode, recordCrashResult, wallet.address, displayAddress, triggerResult]);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-arcade px-4">
        <div className="text-center">
          <div className="text-sm font-extrabold text-white/60">
            {connected ? 'Loading game state…' : 'Connecting to Crash…'}
          </div>
          <div className="text-xs text-white/35 mt-2">Provably fair · live stream</div>
        </div>
      </div>
    );
  }

  const playableBalance = resolvePlayableBalance(
    wallet,
    walletConnected ? state.balance : undefined,
  );
  const showPosition = state.hasPosition && state.phase !== 'crashed';
  const showLivePosition = state.hasLivePosition && state.phase === 'running';
  const liveMult = showPosition && state.phase === 'waiting' ? 1.0 : display.mult;
  const continuousRound = state.currentRound.mode === 'continuous';
  const chartMult =
    state.phase === 'crashed' && state.currentRound.crashPoint != null && !continuousRound
      ? state.currentRound.crashPoint
      : display.mult;
  const chartPeak =
    state.phase === 'crashed' && state.currentRound.crashPoint != null
      ? Math.max(state.peakMult, state.currentRound.crashPoint)
      : display.peakMult;

  if (mobileFull) {
    return (
      <>
        <ResultFeedback event={resultEvent} onComplete={dismissResult} />
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
            key={`crash-chart-mobile-${state.gameId}`}
            active={visible}
            candles={state.candles}
            phase={state.phase}
            mult={chartMult}
            peakMult={chartPeak}
            elapsed={display.elapsed}
            tradeTags={state.tradeTags}
            entryPrice={showLivePosition ? state.positionEntryPrice : null}
          />
        </div>
      </motion.div>
      </>
    );
  }

  return (
    <>
      <ResultFeedback event={resultEvent} onComplete={dismissResult} />
    <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 p-2 sm:p-3 max-w-[1700px] mx-auto w-full">
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-w-0">
        <CrashMobileHeader
          blackballsBalance={playableBalance}
          solBalance={wallet.solBalance}
          phase={state.phase}
          mult={display.mult}
          waitLeft={display.waitLeft}
          roundId={state.currentRound.id}
          isDemoWallet={wallet.connected && !wallet.isRealWallet}
          onDemoRefill={handleDemoRefill}
        />

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
              <span className="text-rose-400 font-extrabold ml-1">
                {continuousRound ? 'Peak' : 'Crash'} {state.currentRound.crashPoint.toFixed(2)}x
              </span>
            )}
          </div>
        </div>

        {/* chart + cash-out dock — fixed block; controls scroll below without shrinking chart */}
        <div className="flex flex-col gap-2 shrink-0 flex-none min-w-0">
        <div className="relative cp-panel overflow-visible w-full min-h-[min(42vh,340px)] h-[min(42vh,340px)] sm:min-h-[480px] sm:h-[60vh] sm:max-h-none">
          <ChartCanvas
            key={`crash-chart-${state.gameId}`}
            active={visible}
            candles={state.candles}
            phase={state.phase}
            mult={chartMult}
            peakMult={chartPeak}
            elapsed={display.elapsed}
            tradeTags={state.tradeTags}
            entryPrice={showLivePosition ? state.positionEntryPrice : null}
          />

          {(reconnecting && !connected) && (
            <div className="absolute inset-0 z-[15] flex items-center justify-center bg-[#141518]/70 backdrop-blur-[2px] pointer-events-none">
              <div className="text-center px-4">
                <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wider">
                  Reconnecting to Crash…
                </div>
                <div className="text-[11px] text-white/45 mt-1">Syncing latest round state</div>
              </div>
            </div>
          )}

          {(state.phase === 'running' ||
            (state.phase === 'crashed' && state.currentRound.crashPoint == null)) && (
            <div
              className="pointer-events-none absolute inset-x-0 top-[12%] sm:top-[10%] flex justify-center z-[5]"
              aria-hidden
            >
              <SmoothMultiplier
                value={display.mult}
                running={state.phase === 'running'}
                active={visible}
                className={`font-extrabold tabular-nums text-center ${
                  state.phase === 'crashed' ? 'text-rose-400' : 'text-emerald-400'
                } text-5xl sm:text-6xl`}
                style={{ textShadow: '0 4px 24px rgba(0,0,0,0.55)' }}
              />
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
                className="absolute inset-0 flex items-center justify-center bg-[#141518]/75 backdrop-blur-sm z-10"
              >
                <div className="flex flex-col items-center justify-center gap-2 sm:gap-6 font-arcade px-4 py-6 sm:px-6 sm:py-14 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#141518]/90 shadow-2xl min-w-[min(88vw,420px)]">
                  <div className="text-sm sm:text-lg font-extrabold text-white/70 uppercase tracking-wide">
                    Place your entry
                  </div>
                  <div className="text-5xl sm:text-8xl md:text-9xl font-extrabold text-white tabular-nums leading-none" style={{ textShadow: '0 4px 28px rgba(0,0,0,0.55)' }}>
                    {display.waitLeft.toFixed(1)}s
                  </div>
                  <div className="text-xs sm:text-base text-emerald-300/90 font-bold text-center max-w-[280px]">
                    BUY or SELL @ 1.00x
                  </div>
                  <div className="text-xs text-white/40">Seed committed · provably fair</div>
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
                    {state.currentRound.crashPoint != null
                      ? continuousRound
                        ? `0.01x · peak ${state.currentRound.crashPoint.toFixed(2)}x`
                        : `${state.currentRound.crashPoint.toFixed(2)}x`
                      : `${state.peakMult.toFixed(2)}x`}
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-sm text-white/60 mt-2 font-bold"
                  >
                    {state.players} degens rekt
                  </motion.div>
                  {!continuousRound &&
                    (state.currentRound.crashPoint ?? 0) >= 1.85 &&
                    (state.currentRound.crashPoint ?? 0) <= 1.97 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-amber-300 mt-2 font-extrabold"
                      >
                        SO CLOSE — near-miss rug 😭
                      </motion.div>
                    )}
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
        </div>

        <CrashControls
          phase={state.phase}
          mult={display.mult}
          balance={playableBalance}
          sessionReady={sessionReady}
          hasPosition={showPosition}
          hasLivePosition={state.hasLivePosition}
          entryPending={state.entryPending}
          positionSide={state.positionSide}
          positionAmount={state.positionAmount}
          positionLeverage={state.positionLeverage}
          positionEntryPrice={state.positionEntryPrice}
          waitLeft={display.waitLeft}
          gameId={state.gameId}
          roundEpoch={roundEpoch}
          streamConnected={connected}
          streamEpoch={streamEpoch}
          autoSell={state.autoSell}
          lastResult={state.lastResult}
          holdBonuses={holdBonuses}
          walletConnected={walletConnected}
          isDemoWallet={wallet.connected && !wallet.isRealWallet}
          vaultEnabled={vaultEnabled}
          onConnect={connect}
          onTryDemo={vaultEnabled ? tryDemo : undefined}
          onTrade={trade}
          onCancelEntry={cancelActivePosition}
          onCashOut={cashOut}
          onSetAutoSell={setAutoSell}
        />

        {holdBonuses.active.length > 0 && (
          <HoldBonusBar active={holdBonuses.active} compact className="sm:hidden" />
        )}

        {state.phase === 'crashed' && (
          <VerifyRoundButton round={state.currentRound} />
        )}
      </div>

      <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-2 sm:gap-3">
        <LoginStreakBanner />
        <HoldBonusBar active={holdBonuses.active} className="hidden sm:block" />
        {compState.crashWinStreak >= 2 && (
          <div className="hidden sm:block cp-panel px-3 py-2 text-xs text-emerald-400 font-bold">
            📈 Crash win streak: <span className="font-extrabold">{compState.crashWinStreak}</span> — keep the momentum
          </div>
        )}
        <CrashStatsPanel history={state.history} />
        <HallOfFameToday />
        <LastHundred history={state.history.slice(0, 100)} />
        <div className="cp-panel min-h-[140px] sm:min-h-[180px] sm:flex-1 overflow-hidden">
          <LiveActivityFeed fallbackFeed={state.feed} />
        </div>
        <MarketListings />
      </div>
    </div>
    </>
  );
}
