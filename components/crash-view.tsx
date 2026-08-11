'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useCrashStream } from '@/hooks/use-crash-stream';
import { useCompetitive } from '@/hooks/use-competitive';
import { useWallet } from '@/lib/wallet-context';
import { ChartCanvas, buildEntryLevels } from '@/components/chart-canvas';
import { CrashControls } from '@/components/crash-controls';
import { LiveActivityFeed } from '@/components/LiveActivityFeed';
import { LastHundred } from '@/components/last-hundred';
import { MarketListings } from '@/components/market-listings';
import { CrashStatsPanel } from '@/components/crash-stats-panel';
import { VerifyRoundButton } from '@/components/verify-round-button';
import { HallOfFameToday } from '@/components/hall-of-fame-today';
import { ResultFeedback } from '@/components/result-feedback';
import { useResultFeedback } from '@/hooks/use-result-feedback';
import { recordHallOfFame } from '@/lib/player-retention';
import { isVaultConfigured } from '@/lib/chain/public-config';
import { resolvePlayableBalance, resolveClientSyncBalance } from '@/lib/session-balance';
import { CrashMobileHeader } from '@/components/crash-mobile-header';
import { CrashMobileHistoryReel } from '@/components/crash-mobile-history-reel';
import { CrashMobileLowerPanel } from '@/components/crash-mobile-lower-panel';
import { syncGameSessionBalances } from '@/lib/sync-game-sessions';
import { useGameTabFocus } from '@/lib/use-game-tab-focus';
import { useExtrapolatedCrashDisplay } from '@/hooks/use-extrapolated-crash-display';
import { playerMarkerName } from '@/lib/player-marker-name';

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
  /** Last round with a revealed seed — stream history strips seeds, so cache on rug. */
  const [lastFinishedRound, setLastFinishedRound] = useState<{
    id: number;
    serverSeedHash: string;
    serverSeed: string | null;
    clientSeed: string;
    nonce: number;
    crashPoint: number | null;
    mode?: 'classic' | 'continuous';
    rugTick?: number | null;
  } | null>(null);
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
    if (!state) return;
    if (
      state.phase === 'crashed' &&
      state.currentRound.serverSeed &&
      state.currentRound.crashPoint != null
    ) {
      setLastFinishedRound({
        id: state.currentRound.id,
        serverSeedHash: state.currentRound.serverSeedHash,
        serverSeed: state.currentRound.serverSeed,
        clientSeed: state.currentRound.clientSeed,
        nonce: state.currentRound.nonce,
        crashPoint: state.currentRound.crashPoint,
        mode: state.currentRound.mode,
        rugTick: state.currentRound.rugTick ?? null,
      });
    }
  }, [
    state?.phase,
    state?.currentRound.id,
    state?.currentRound.serverSeed,
    state?.currentRound.crashPoint,
    state?.currentRound.serverSeedHash,
    state?.currentRound.clientSeed,
    state?.currentRound.nonce,
    state?.currentRound.mode,
    state?.currentRound.rugTick,
  ]);

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
  const showEntryLines = showLivePosition && state.phase === 'running';
  const continuousRound = state.currentRound.mode === 'continuous';
  // After rug: lock chart multiplier at 0x (no continued counting / lerp chase).
  const chartMult = state.phase === 'crashed' ? 0 : display.mult;
  const chartPeak =
    state.phase === 'crashed' && state.currentRound.crashPoint != null
      ? Math.max(state.peakMult, state.currentRound.crashPoint)
      : display.peakMult;
  const entryLevels = showEntryLines ? buildEntryLevels(state.positionLots) : [];
  const entryPrice =
    entryLevels.length === 1
      ? entryLevels[0].price
      : showEntryLines
        ? state.positionEntryPrice
        : null;
  const viewerName = wallet.connected && wallet.address ? playerMarkerName(wallet.address) : null;
  // Hide buy/sell logos after the round ends (rug / waiting).
  const publicTradeTags =
    state.phase === 'running' ? (state.tradeTags ?? []) : [];

  // Cadre uses the live display mult (updates ~10Hz) vs average entry while in a live position.
  const inLiveTrade =
    state.phase === 'running' &&
    (state.hasLivePosition || (state.hasPosition && !state.entryPending));
  const liveEntry =
    inLiveTrade && Number.isFinite(state.positionEntryPrice) && state.positionEntryPrice > 0
      ? state.positionEntryPrice
      : null;
  const liveMult = display.mult;
  const cadreInProfit =
    liveEntry != null
      ? state.positionSide === 'sell'
        ? liveMult <= liveEntry + 1e-9
        : liveMult >= liveEntry - 1e-9
      : true;
  const entryInProfit = liveEntry != null ? cadreInProfit : true;
  const chartCadreClass = liveEntry != null
    ? cadreInProfit
      ? 'border-emerald-500/70 ring-2 ring-inset ring-emerald-500 shadow-[inset_0_0_32px_rgba(16,185,129,0.28)]'
      : 'border-rose-500/70 ring-2 ring-inset ring-rose-500 shadow-[inset_0_0_32px_rgba(239,68,68,0.3)]'
    : 'border-white/[0.06]';

  // Seed verify for the last finished round (revealed on rug; stream keeps seed on history[0]).
  const lastHistory = state.history[0];
  const verifyRound =
    state.phase === 'crashed' &&
    state.currentRound.crashPoint != null &&
    state.currentRound.serverSeed
      ? state.currentRound
      : lastFinishedRound?.serverSeed
        ? lastFinishedRound
        : lastHistory &&
            lastHistory.serverSeed &&
            Number.isFinite(lastHistory.crashPoint)
          ? {
              id: lastHistory.id,
              serverSeedHash: lastHistory.serverSeedHash,
              serverSeed: lastHistory.serverSeed,
              clientSeed: lastHistory.clientSeed ?? state.currentRound.clientSeed,
              nonce: lastHistory.nonce ?? state.currentRound.nonce,
              crashPoint: lastHistory.crashPoint,
              mode: lastHistory.mode,
              rugTick: lastHistory.rugTick ?? null,
            }
          : null;

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
        <div className={`relative h-full w-full border bg-[#06070a] transition-[box-shadow,border-color] duration-200 ${chartCadreClass}`}>
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
            tradeTags={publicTradeTags}
            entryPrice={entryPrice}
            entryLevels={entryLevels}
            positionSide={state.positionSide}
            entryInProfit={entryInProfit}
            viewerName={viewerName}
          />
        </div>
      </motion.div>
      </>
    );
  }

  return (
    <>
      <ResultFeedback event={resultEvent} onComplete={dismissResult} />
    <div className="flex flex-col lg:flex-row gap-1 sm:gap-3 p-1 sm:p-3 max-w-[1700px] mx-auto w-full max-md:min-h-0">
      {/* Mobile: primary trade frame + scrollable lower activity. Desktop unchanged. */}
      <div className="flex flex-col gap-1 sm:gap-3 min-w-0 flex-1 max-md:min-h-0">
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

        <CrashMobileHistoryReel history={state.history} />

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

        {/* Primary mobile cadre: chart + BUY/SELL stay in first viewport (non-scrolling frame). */}
        <div className="flex flex-col gap-1 sm:gap-2 min-w-0 shrink-0 max-md:max-h-[85vh] md:flex-none">
        <div
          className={`relative overflow-hidden w-full h-[37vh] min-h-[200px] max-h-[38vh] md:min-h-[440px] md:h-[54vh] md:max-h-none rounded-lg sm:rounded-2xl border bg-[#06070a] transition-[box-shadow,border-color] duration-200 ${chartCadreClass}`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(16,185,129,0.07), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(56,189,248,0.04), transparent 50%)',
            }}
            aria-hidden
          />
          <ChartCanvas
            key={`crash-chart-${state.gameId}`}
            active={visible}
            candles={state.candles}
            phase={state.phase}
            mult={chartMult}
            peakMult={chartPeak}
            elapsed={display.elapsed}
            tradeTags={publicTradeTags}
            entryPrice={entryPrice}
            entryLevels={entryLevels}
            positionSide={state.positionSide}
            entryInProfit={entryInProfit}
            viewerName={viewerName}
          />

          {(reconnecting && !connected) && (
            <div className="absolute inset-0 z-[15] flex items-center justify-center bg-[#0c0e12]/75 backdrop-blur-[2px] pointer-events-none">
              <div className="text-center px-4">
                <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wider">
                  Reconnecting…
                </div>
                <div className="text-[11px] text-white/40 mt-1">Syncing round state</div>
              </div>
            </div>
          )}

          <button
            onClick={() => setMobileFull(true)}
            className="sm:hidden absolute top-1.5 right-1.5 z-20 touch-manipulation bg-[#2a2c33]/85 border border-white/10 px-2 py-1 rounded-md text-[9px] font-extrabold text-white/80"
          >
            Full
          </button>
          <AnimatePresence>
            {state.phase === 'waiting' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 z-10 ${
                  continuousRound
                    ? 'bg-[#111518]/95 ring-2 ring-inset ring-emerald-500'
                    : 'flex items-center justify-center bg-[#141518]/75 backdrop-blur-sm'
                }`}
              >
                {continuousRound ? (
                  <>
                    <div className="absolute left-5 top-5 sm:left-8 sm:top-7 font-arcade">
                      <div className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                        PRESALE
                      </div>
                      <div className="mt-2 max-w-[250px] text-xs sm:text-sm font-bold text-white/60">
                        Buy a guaranteed position at <span className="text-emerald-400">1.00x</span>
                        <br />
                        before the round starts
                      </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center font-arcade pointer-events-none">
                      <div className="text-sm sm:text-xl font-extrabold text-white/70">Next round in…</div>
                      <div
                        className="mt-2 text-5xl sm:text-7xl font-black text-white tabular-nums leading-none"
                        style={{ textShadow: '0 4px 28px rgba(0,0,0,0.55)' }}
                      >
                        {display.waitLeft.toFixed(1)}s
                      </div>
                    </div>
                    <div className="absolute bottom-5 inset-x-0 text-center text-[10px] sm:text-xs font-bold text-emerald-300/70">
                      Seed committed · provably fair
                    </div>
                  </>
                ) : (
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
                )}
              </motion.div>
            )}
            {state.phase === 'crashed' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-rose-950/50 crash-rug-flash"
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

        <div className="shrink-0">
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
          positionLots={state.positionLots}
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
          continuousMode={continuousRound}
          vaultEnabled={vaultEnabled}
          onConnect={connect}
          onTryDemo={vaultEnabled ? tryDemo : undefined}
          onTrade={trade}
          onCancelEntry={cancelActivePosition}
          onCashOut={cashOut}
          onSetAutoSell={setAutoSell}
        />
        </div>
        </div>

        <CrashMobileLowerPanel
          history={state.history}
          feed={state.feed}
          tradeTags={publicTradeTags}
          mult={display.mult}
          phase={state.phase}
          buyersIn={state.buyersIn}
        />

        {verifyRound && (
          <div className="shrink-0 px-1 sm:px-0">
            <VerifyRoundButton round={verifyRound} />
          </div>
        )}
      </div>

      <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-2.5 max-sm:hidden">
        <MarketListings />
        <CrashStatsPanel history={state.history} />
        {compState.crashWinStreak >= 2 && (
          <div className="hidden sm:block rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400 font-bold">
            Win streak <span className="font-extrabold">{compState.crashWinStreak}</span>
          </div>
        )}
        <LastHundred history={state.history.slice(0, 100)} />
        <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] min-h-[140px] sm:min-h-[200px] sm:flex-1 overflow-hidden">
          <LiveActivityFeed fallbackFeed={state.feed} />
        </div>
        <HallOfFameToday />
      </div>
    </div>
    </>
  );
}
