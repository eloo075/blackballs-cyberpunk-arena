'use client';

import { useState, useEffect } from 'react';
import type { FlipSide } from '@/lib/flip-engine';
import { FLIP_CONFIG, rakeLabel } from '@/lib/flip-config';
import type { Flip1v1Match, FlipPlayerView } from '@/lib/flip-types';
import { WagerAmountPanel } from '@/components/wager-amount-panel';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { affordableBetAmount, clampBetToBalance, formatBetTokens, formatBetUsd, tokensToUsd } from '@/lib/bet-sizing';
import { useTokenUsd } from '@/hooks/use-token-usd';

interface FlipControlsProps {
  balance: number;
  player: FlipPlayerView | null;
  mode: '1v1' | 'dogpile';
  onModeChange: (m: '1v1' | 'dogpile') => void;
  openMatches: Flip1v1Match[];
  walletConnected: boolean;
  sessionReady?: boolean;
  streamConnected?: boolean;
  isDemoWallet?: boolean;
  flipInProgress?: boolean;
  onConnect: () => void;
  onFlip: (params: {
    mode: '1v1' | 'dogpile';
    side: FlipSide;
    amount: number;
    message?: string;
    matchId?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRevenge: () => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => Promise<{ ok: boolean }>;
}

export function FlipControls({
  balance = 0,
  player,
  mode,
  onModeChange,
  openMatches,
  walletConnected,
  sessionReady = true,
  streamConnected = true,
  isDemoWallet,
  flipInProgress = false,
  onConnect,
  onFlip,
  onRevenge,
  onCancel,
}: FlipControlsProps) {
  const { usdPerToken } = useTokenUsd();
  const [side, setSide] = useState<FlipSide>('heads');
  const [amount, setAmount] = useState(0.01);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBet = player?.maxBet ?? FLIP_CONFIG.MAX_BET;
  const rakeRate = player?.rakeRate ?? FLIP_CONFIG.BASE_RAKE;
  const maxAffordable = Math.min(balance, maxBet);
  const safeAmount =
    amount <= 0
      ? 0
      : Math.min(Math.max(clampBetToBalance(amount, maxAffordable), FLIP_CONFIG.MIN_BET), maxAffordable);

  useEffect(() => {
    if (maxAffordable <= 0) return;
    setAmount(prev => {
      if (prev <= 0 || prev > maxAffordable) {
        return affordableBetAmount(usdPerToken, maxAffordable);
      }
      return clampBetToBalance(prev, maxAffordable);
    });
  }, [usdPerToken, maxAffordable]);

  const handleFlip = async (matchId?: string) => {
    if (!walletConnected) {
      setError('Connect wallet to flip.');
      return;
    }
    if (!sessionReady) {
      setError('Syncing session — try again in a moment.');
      return;
    }
    if (busy) return;
    if (safeAmount <= 0) {
      setError(`Set a wager above 0 — balance ${balance.toFixed(3)} ${CURRENCY_LABEL}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onFlip({
        mode,
        side,
        amount: safeAmount,
        message: message.trim() || undefined,
        matchId,
      });
      if (!result.ok) setError(result.error ?? 'Flip failed');
    } finally {
      setBusy(false);
    }
  };

  const waitingOwn =
    !!player?.active1v1Id &&
    !flipInProgress &&
    openMatches.some(m => m.id === player.active1v1Id && m.status === 'waiting');
  const canFlip =
    walletConnected && sessionReady && streamConnected && !busy && !waitingOwn && !flipInProgress;

  return (
    <div className="cp-panel font-arcade overflow-hidden">
      {!walletConnected && (
        <div className="p-6 text-center space-y-3 bg-[#141518]/80">
          <p className="text-sm text-white/60 font-bold">Connect to flip for {CURRENCY_LABEL}</p>
          <button
            onClick={onConnect}
            className="px-6 py-3 text-sm font-black bg-orange-500 hover:bg-orange-400 text-white rounded-xl border-b-4 border-orange-700"
          >
            CONNECT · DEMO PLAY
          </button>
        </div>
      )}

      <div className="p-3 border-b border-white/5 bg-[#25262c]">
        <div className="flex gap-2 mb-3">
          {(['1v1', 'dogpile'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl border-b-3 transition-all ${
                mode === m
                  ? 'bg-orange-500 text-black border-orange-700'
                  : 'bg-[#2a2c33] text-white/50 border-white/10'
              }`}
            >
              {m === '1v1' ? '⚡ 1v1 INSTANT' : '🐕 DOGPILE POT'}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-white/45 font-bold mb-2">
          Balance <span className="text-orange-400">{balance.toFixed(3)}</span> {CURRENCY_LABEL} · Max bet{' '}
          <span className="text-amber-300">{maxBet}</span> {CURRENCY_LABEL} · Rake{' '}
          <span className="text-emerald-400">{rakeLabel(rakeRate)}</span>
        </div>
        {player?.holdsBlackballs && (
          <div className="text-[10px] font-extrabold text-amber-300 mb-2 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/25">
            You&apos;re paying only {rakeLabel(rakeRate)} rake because you hold {CURRENCY_LABEL} · +{maxBet - FLIP_CONFIG.MAX_BET} max bet
          </div>
        )}

        {/* Side selection */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['heads', 'tails'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              disabled={!walletConnected || busy}
              className={`touch-manipulation min-h-[64px] py-3 rounded-xl font-black text-sm border-b-4 transition-all disabled:opacity-40 ${
                side === s
                  ? s === 'heads'
                    ? 'bg-orange-500 text-black border-orange-700'
                    : 'bg-amber-400 text-black border-amber-600'
                  : 'bg-[#2a2c33] text-white/55 border-white/10'
              }`}
            >
              {s === 'heads' ? '🟠 HEADS' : '⚫ TAILS'}
            </button>
          ))}
        </div>

        {/* Bet amount — USD presets, stored as BlackBalls for server */}
        <WagerAmountPanel
          amount={clampBetToBalance(amount, maxAffordable)}
          onAmountChange={v => setAmount(clampBetToBalance(v, maxAffordable))}
          balance={maxAffordable}
          disabled={!walletConnected}
          inputClassName="flex-1 min-w-0 bg-transparent text-2xl font-extrabold text-white outline-none tabular-nums placeholder:text-white/20 disabled:opacity-50"
        />

        <input
          type="text"
          maxLength={80}
          placeholder="Taunt / message (optional)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={!walletConnected}
          className="w-full mb-3 px-3 py-2 text-xs bg-[#1f2025] border border-white/10 rounded-xl text-white/80 outline-none"
        />

        {error && (
          <div className="mb-2 px-3 py-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl font-bold">
            {error}
          </div>
        )}

        {waitingOwn ? (
          <button
            type="button"
            onClick={() => void onCancel()}
            className="w-full py-3 text-sm font-black bg-[#2a2c33] text-rose-300 rounded-xl border border-rose-500/30"
          >
            CANCEL WAITING MATCH
          </button>
        ) : (
          <button
            type="button"
            disabled={!canFlip || safeAmount <= 0}
            onClick={() => void handleFlip()}
            className="w-full touch-manipulation min-h-[52px] py-3 text-base font-black bg-orange-500 hover:bg-orange-400 text-black rounded-xl border-b-4 border-orange-700 active:border-b-0 disabled:opacity-40"
          >
            {busy
              ? 'FLIPPING…'
              : mode === '1v1'
                ? `FLIP ${side.toUpperCase()} · ${formatBetTokens(safeAmount)} ${CURRENCY_LABEL} (${formatBetUsd(tokensToUsd(safeAmount, usdPerToken))})`
                : `JOIN DOGPILE · ${side.toUpperCase()}`}
          </button>
        )}

        {player?.lastOpponent && (
          <button
            type="button"
            disabled={!walletConnected || busy}
            onClick={() => void onRevenge()}
            className="w-full mt-2 py-2 text-xs font-black text-rose-300 border border-rose-500/30 rounded-xl hover:bg-rose-500/10 disabled:opacity-40"
          >
            😈 REVENGE vs last opponent
          </button>
        )}

        {isDemoWallet && (
          <div className="mt-2 text-[10px] text-center text-emerald-300 font-bold">DEMO MODE · off-chain credits</div>
        )}
      </div>

      {/* Open 1v1 matches to join */}
      {mode === '1v1' && openMatches.length > 0 && (
        <div className="p-3 border-t border-white/5">
          <div className="text-xs font-extrabold text-white/70 mb-2">Open matches</div>
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
            {openMatches.map(m => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => void handleFlip(m.id)}
                className="w-full flex justify-between items-center px-3 py-2 text-[11px] font-bold rounded-xl bg-[#1f2025] border border-white/10 hover:border-orange-400/40 disabled:opacity-40"
              >
                <span>
                  {m.creator.display} · {m.creatorSide.toUpperCase()} · {m.wager} {CURRENCY_LABEL}
                </span>
                <span className="text-orange-400">JOIN →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(player?.winStreak ?? 0) >= 2 && (
        <div className="px-3 py-2 text-xs text-emerald-400 font-bold border-t border-white/5">
          🔥 {player!.winStreak}-win flip streak
        </div>
      )}
      {(player?.lossStreak ?? 0) >= 2 && (
        <div className="px-3 py-2 text-xs text-rose-400 font-bold border-t border-white/5">
          💀 {player!.lossStreak} losses — revenge time?
        </div>
      )}
    </div>
  );
}
