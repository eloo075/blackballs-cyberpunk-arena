'use client';

import { useEffect, useRef, useState } from 'react';
import { useFlipStream } from '@/hooks/use-flip-stream';
import { useWallet } from '@/lib/wallet-context';
import { FlipCoin } from '@/components/flip-coin';
import { FlipControls } from '@/components/flip-controls';
import { FLIP_CONFIG } from '@/lib/flip-config';
import { isVaultConfigured } from '@/lib/chain/public-config';
import { ResultFeedback } from '@/components/result-feedback';
import { useResultFeedback } from '@/hooks/use-result-feedback';
import {
  playFlipLandSound,
} from '@/lib/game-sfx';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { resolvePlayableBalance, resolveClientSyncBalance } from '@/lib/session-balance';
import { useGameTabFocus } from '@/lib/use-game-tab-focus';
import type { FlipSide } from '@/lib/flip-engine';
import type { FlipHistoryEntry } from '@/lib/flip-types';
import type { FlipFullState } from '@/lib/flip-types';

function isPlayerInActiveFlip(state: FlipFullState, address: string): boolean {
  const match = state.active1v1;
  if (match && (match.creator.address === address || match.opponent?.address === address)) {
    return true;
  }
  return [...state.dogpile.heads, ...state.dogpile.tails].some(p => p.address === address);
}

/** Your in-flight 1v1 — keyed by participation, not active1v1Id (cleared before anim ends). */
function resolvePlayer1v1Match(
  state: FlipFullState | null | undefined,
  address: string | null,
) {
  if (!state || !address) return null;
  const match = state.active1v1;
  if (!match?.flipStartedAt) return null;
  if (match.status !== 'flipping' && match.status !== 'done') return null;
  if (match.creator.address !== address && match.opponent?.address !== address) return null;
  return match;
}

function FlipHistory({ history }: { history: FlipHistoryEntry[] }) {
  if (!history?.length) {
    return <div className="text-xs text-white/35 font-bold py-4 text-center">No flips yet — be first.</div>;
  }
  return (
    <div className="space-y-1 max-h-[160px] overflow-y-auto">
      {history.slice(0, 20).map(h => (
        <div
          key={h.id}
          className="flex justify-between items-center gap-2 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#0e1015] border border-white/[0.04]"
        >
          <span className={h.result === 'heads' ? 'text-orange-400' : 'text-amber-200'}>
            {h.result.toUpperCase()}
          </span>
          <span className="text-white/35 uppercase text-[9px]">{h.mode}</span>
          <span className="text-emerald-400 truncate">{h.winnerDisplay}</span>
          <span className="text-white/40 tabular-nums shrink-0">
            {h.totalPot.toFixed(1)} {CURRENCY_LABEL}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FlipView({ visible = true }: { visible?: boolean }) {
  const { state, connected, sessionReady, flip, revenge, cancelWaiting, setBalanceHold, refreshFlipState, walletConnected, holdsBlackballs } =
    useFlipStream();
  const { wallet, connect, disconnect, holdBonuses } = useWallet();
  const { event: resultEvent, trigger: triggerResult, dismiss: dismissResult } = useResultFeedback();
  const [mode, setMode] = useState<'1v1' | 'dogpile'>('1v1');
  const [flipKey, setFlipKey] = useState<string | null>(null);
  const [targetSide, setTargetSide] = useState<FlipSide | null>(null);
  const [frozenBalance, setFrozenBalance] = useState<number | null>(null);
  const [coinAnimating, setCoinAnimating] = useState(false);
  const lastFlipRef = useRef<string | null>(null);
  const landHandledRef = useRef<string | null>(null);
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
    refreshFlipState,
  );

  const tryDemo = () => {
    disconnect();
    window.setTimeout(() => connect(), 0);
  };

  const addr = wallet.connected ? wallet.address : null;
  const activeFlip = state?.active1v1;
  const dogpileFlipping = state?.dogpile.status === 'flipping';
  const playerFlip = resolvePlayer1v1Match(state, addr);
  const inActive1v1Flip = !!playerFlip;
  const inDogpileFlip =
    dogpileFlipping && !!state && !!addr && isPlayerInActiveFlip(state, addr);
  const isFlipping = inActive1v1Flip || inDogpileFlip;
  const revealedSide =
    playerFlip?.result ?? (inDogpileFlip ? state?.dogpile.result : null) ?? null;

  // Start coin spin when a new flip begins
  useEffect(() => {
    const key = playerFlip?.flipStartedAt
      ? `1v1-${playerFlip.id}-${playerFlip.flipStartedAt}`
      : inDogpileFlip && state?.dogpile.flipStartedAt
        ? `dp-${state.dogpile.id}-${state.dogpile.flipStartedAt}`
        : null;

    if (!key || !isFlipping) return;
    if (lastFlipRef.current === key) return;

    lastFlipRef.current = key;
    landHandledRef.current = null;
    setFlipKey(key);
    setTargetSide(null);
    setCoinAnimating(true);
  }, [isFlipping, playerFlip?.id, playerFlip?.flipStartedAt, inDogpileFlip, state?.dogpile.id, state?.dogpile.flipStartedAt]);

  // Feed provably-fair result into coin for landing
  useEffect(() => {
    if (revealedSide && flipKey) {
      setTargetSide(revealedSide);
    }
  }, [revealedSide, flipKey]);

  // Freeze balance for the player until the coin lands — settlement waits for dopamine timing.
  useEffect(() => {
    const addr = wallet.address;
    if (!flipKey || !state || !wallet.connected || !addr) return;
    if (!isPlayerInActiveFlip(state, addr)) return;

    setFrozenBalance(prev => {
      if (prev != null) return prev;
      return resolvePlayableBalance(wallet, state.player?.balance);
    });
    setBalanceHold(true);
  }, [flipKey, state, wallet, setBalanceHold]);

  useEffect(() => {
    return () => setBalanceHold(false);
  }, [setBalanceHold]);

  useEffect(() => {
    if (!addr || !state) return;
    if (!isPlayerInActiveFlip(state, addr) && frozenBalance != null) {
      setFrozenBalance(null);
      setBalanceHold(false);
    }
  }, [addr, state, frozenBalance, setBalanceHold]);

  const handleCoinLand = () => {
    if (!flipKey || landHandledRef.current === flipKey) return;
    landHandledRef.current = flipKey;
    setFrozenBalance(null);
    setBalanceHold(false);
    setCoinAnimating(false);
    playFlipLandSound();
    const lr = state?.player?.lastResult;
    if (lr) {
      triggerResult({
        won: lr.won,
        amount: lr.profit,
        subtitle: lr.won
          ? `${lr.result.toUpperCase()} wins`
          : `${lr.result.toUpperCase()} · you had ${lr.side.toUpperCase()}`,
        intensity:
          lr.won && lr.profit >= FLIP_CONFIG.HOF_MIN_PROFIT ? 'mega' : undefined,
      });
    }
  };

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-arcade">
        <div className="text-sm font-extrabold text-white/60">Loading Black Flip…</div>
      </div>
    );
  }

  const balance =
    frozenBalance ??
    resolvePlayableBalance(wallet, walletConnected ? state.player?.balance : undefined);
  const potTotal = state.dogpile.headsTotal + state.dogpile.tailsTotal;
  const dogpileLeft = Math.max(0, Math.ceil((state.dogpile.endsAt - Date.now()) / 1000));
  const ownWaitingMatch = state.player?.active1v1Id
    ? state.open1v1.find(m => m.id === state.player!.active1v1Id && m.status === 'waiting')
    : null;
  const waitingForOpponent = !!ownWaitingMatch && !isFlipping;

  return (
    <>
      <ResultFeedback event={resultEvent} onComplete={dismissResult} />
    <div className="flex flex-col lg:flex-row gap-2.5 p-2 sm:p-3 max-w-[1700px] mx-auto w-full font-arcade">
      <div className="flex-1 flex flex-col gap-2.5 min-w-0">
        <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] px-4 py-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-base font-extrabold text-white tracking-tight">Black Flip</span>
            <span className="text-white/30 hidden sm:inline">·</span>
            <span className="text-white/40 font-bold hidden sm:inline">Pure 50/50 PvP</span>
          </div>
          <span className="text-white/30 font-mono text-[10px]">
            Hash {state.dogpile.serverSeedHash.slice(0, 14)}…
          </span>
        </div>

        <div className="relative overflow-hidden min-h-[300px] sm:min-h-[360px] flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0c0e12]">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(249,115,22,0.12), transparent 60%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(251,191,36,0.06), transparent 50%)',
            }}
            aria-hidden
          />
          <FlipCoin
            flipKey={flipKey}
            targetSide={targetSide}
            bigWin={state.player?.lastResult?.profit != null && state.player.lastResult.profit >= FLIP_CONFIG.HOF_MIN_PROFIT}
            onLand={handleCoinLand}
          />

          {waitingForOpponent && (
            <div className="relative z-[1] text-xs text-amber-300 font-bold animate-pulse mt-1 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              Match queued — opponent joining…
            </div>
          )}
          {activeFlip?.status === 'waiting' && (
            <div className="relative z-[1] text-xs text-amber-300 font-bold animate-pulse mt-1 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              Waiting for opponent…
            </div>
          )}
        </div>

        <FlipControls
          balance={balance}
          player={state.player}
          mode={mode}
          onModeChange={setMode}
          openMatches={state.open1v1}
          walletConnected={walletConnected}
          sessionReady={sessionReady}
          streamConnected={connected}
          isDemoWallet={wallet.connected && !wallet.isRealWallet}
          onConnect={vaultEnabled ? tryDemo : connect}
          onFlip={flip}
          onRevenge={revenge}
          onCancel={cancelWaiting}
          flipInProgress={isFlipping || coinAnimating}
        />
      </div>

      <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-2.5">
        <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] p-3.5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/70">
              Dogpile Pot
            </div>
            <span className="text-[10px] font-bold text-white/30">#{state.dogpile.round}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-2.5">
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-2.5">
              <div className="text-orange-400 font-extrabold tracking-wide">HEADS</div>
              <div className="text-white/40 mt-0.5">{state.dogpile.heads.length} players</div>
              <div className="text-white font-extrabold tabular-nums mt-1">
                {state.dogpile.headsTotal.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl bg-amber-400/10 border border-amber-400/20 p-2.5">
              <div className="text-amber-200 font-extrabold tracking-wide">TAILS</div>
              <div className="text-white/40 mt-0.5">{state.dogpile.tails.length} players</div>
              <div className="text-white font-extrabold tabular-nums mt-1">
                {state.dogpile.tailsTotal.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-white/40 font-bold">
            Total {potTotal.toFixed(2)} {CURRENCY_LABEL}
            {' · '}
            {state.dogpile.status === 'waiting' ? `Flips in ${dogpileLeft}s` : state.dogpile.status}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] p-3.5 min-h-[140px] max-h-[220px] overflow-y-auto">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/70 mb-2.5">
            Live Flips
          </div>
          <div className="space-y-1">
            {state.feed.length === 0 && (
              <div className="text-xs text-white/35 py-4 text-center">Quiet… for now.</div>
            )}
            {state.feed.slice(0, 15).map(e => (
              <div
                key={e.id}
                className={`text-[10px] font-bold py-1.5 px-1 border-b border-white/[0.04] ${
                  e.highlight ? 'text-amber-300 bg-amber-400/5 rounded' : 'text-white/55'
                }`}
              >
                <span className="text-orange-400/90">{e.player}</span> {e.text}
              </div>
            ))}
          </div>
        </div>

        {state.hallOfFame.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] p-3.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300/90 mb-2.5">
              Hall of Fame
            </div>
            {state.hallOfFame.slice(0, 5).map(h => (
              <div key={h.id} className="flex justify-between text-[10px] font-bold py-1 border-b border-white/[0.04] last:border-0">
                <span className="text-white/55 truncate">{h.winnerDisplay}</span>
                <span className="text-emerald-400 tabular-nums shrink-0">
                  +{h.profit.toFixed(1)} {CURRENCY_LABEL}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] p-3.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/70 mb-2.5">
            Recent Flips
          </div>
          <FlipHistory history={state.history} />
        </div>
      </div>
    </div>
    </>
  );
}
