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
    return <div className="text-xs text-white/35 font-bold">No flips yet — be first.</div>;
  }
  return (
    <div className="space-y-1 max-h-[160px] overflow-y-auto">
      {history.slice(0, 20).map(h => (
        <div key={h.id} className="flex justify-between text-[11px] font-bold px-2 py-1 rounded-lg bg-[#1f2025]">
          <span className={h.result === 'heads' ? 'text-orange-400' : 'text-amber-200'}>{h.result.toUpperCase()}</span>
          <span className="text-white/50">{h.mode}</span>
          <span className="text-emerald-400">{h.winnerDisplay}</span>
          <span className="text-white/40 tabular-nums">{h.totalPot.toFixed(1)} {CURRENCY_LABEL}</span>
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
    <div className="flex flex-col lg:flex-row gap-3 p-2 sm:p-3 max-w-[1700px] mx-auto w-full font-arcade">
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="cp-panel px-4 py-2 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="text-lg font-extrabold text-orange-400">Black Flip</span>
            <span className="text-white/35">· pure 50/50 PvP</span>
          </div>
          <span className="text-white/40 font-mono text-[10px]">
            Hash: {state.dogpile.serverSeedHash.slice(0, 14)}…
          </span>
        </div>

        <div className="cp-panel relative overflow-hidden min-h-[280px] flex flex-col items-center justify-center bg-gradient-to-b from-orange-500/5 to-transparent">
          <FlipCoin
            flipKey={flipKey}
            targetSide={targetSide}
            bigWin={state.player?.lastResult?.profit != null && state.player.lastResult.profit >= FLIP_CONFIG.HOF_MIN_PROFIT}
            onLand={handleCoinLand}
          />

          {waitingForOpponent && (
            <div className="text-xs text-amber-300 font-bold animate-pulse mt-2">
              Match queued — opponent joining…
            </div>
          )}
          {activeFlip?.status === 'waiting' && (
            <div className="text-xs text-amber-300 font-bold animate-pulse mt-2">Waiting for opponent…</div>
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
          isDemoWallet={wallet.connected && !wallet.isRealWallet}
          onConnect={vaultEnabled ? tryDemo : connect}
          onFlip={flip}
          onRevenge={revenge}
          onCancel={cancelWaiting}
          flipInProgress={isFlipping || coinAnimating}
        />
      </div>

      <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-3">
        {/* Dogpile pot */}
        <div className="cp-panel p-3">
          <div className="text-sm font-extrabold text-white/80 mb-2">🐕 Dogpile Pot #{state.dogpile.round}</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/25 p-2">
              <div className="text-orange-400 font-extrabold">HEADS</div>
              <div className="text-white/60">{state.dogpile.heads.length} players</div>
              <div className="text-white font-bold tabular-nums">{state.dogpile.headsTotal.toFixed(2)} {CURRENCY_LABEL}</div>
            </div>
            <div className="rounded-xl bg-amber-400/10 border border-amber-400/25 p-2">
              <div className="text-amber-200 font-extrabold">TAILS</div>
              <div className="text-white/60">{state.dogpile.tails.length} players</div>
              <div className="text-white font-bold tabular-nums">{state.dogpile.tailsTotal.toFixed(2)} {CURRENCY_LABEL}</div>
            </div>
          </div>
          <div className="text-[10px] text-white/45 font-bold">
            Total pot {potTotal.toFixed(2)} {CURRENCY_LABEL} · {state.dogpile.status === 'waiting' ? `Flips in ${dogpileLeft}s` : state.dogpile.status}
          </div>
        </div>

        {/* Live feed */}
        <div className="cp-panel p-3 min-h-[140px] max-h-[220px] overflow-y-auto">
          <div className="text-sm font-extrabold text-white/80 mb-2">Live Flips</div>
          <div className="space-y-1">
            {state.feed.length === 0 && <div className="text-xs text-white/35">Quiet… for now.</div>}
            {state.feed.slice(0, 15).map(e => (
              <div
                key={e.id}
                className={`text-[10px] font-bold py-1 border-b border-white/5 ${
                  e.highlight ? 'text-amber-300 bg-amber-400/5 -mx-1 px-1 rounded' : 'text-white/60'
                }`}
              >
                <span className="text-orange-400/80">{e.player}</span> {e.text}
              </div>
            ))}
          </div>
        </div>

        {/* Hall of Fame */}
        {state.hallOfFame.length > 0 && (
          <div className="cp-panel p-3">
            <div className="text-sm font-extrabold text-amber-300 mb-2">🏆 Hall of Fame</div>
            {state.hallOfFame.slice(0, 5).map(h => (
              <div key={h.id} className="flex justify-between text-[10px] font-bold py-0.5">
                <span className="text-white/60">{h.winnerDisplay}</span>
                <span className="text-emerald-400">+{h.profit.toFixed(1)} {CURRENCY_LABEL}</span>
              </div>
            ))}
          </div>
        )}

        <div className="cp-panel p-3">
          <div className="text-sm font-extrabold text-white/80 mb-2">Recent Flips</div>
          <FlipHistory history={state.history} />
        </div>

        {holdBonuses.active.length > 0 && (
          <div className="cp-panel px-3 py-2 text-[10px] text-amber-300 font-bold">
            Hold perks active: {holdBonuses.active.map(b => b.label).join(' · ')}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
