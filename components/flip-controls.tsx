'use client';

import { useState } from 'react';
import type { FlipSide } from '@/lib/flip-engine';
import { FLIP_CONFIG, rakeLabel } from '@/lib/flip-config';
import type { Flip1v1Match, FlipPlayerView } from '@/lib/flip-types';
import { WagerAmountPanel } from '@/components/wager-amount-panel';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import {
  clampBetToBalance,
  formatBetTokens,
  formatBetUsd,
  tokensToUsd,
} from '@/lib/bet-sizing';
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
  const [amount, setAmount] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBet = player?.maxBet ?? FLIP_CONFIG.MAX_BET;
  const rakeRate = player?.rakeRate ?? FLIP_CONFIG.BASE_RAKE;
  const maxAffordable = Math.min(balance, maxBet);
  const requested =
    Number.isFinite(amount) && amount > 0 ? Math.floor(amount * 1000) / 1000 : 0;
  const safeAmount =
    requested <= 0
      ? 0
      : requested > maxAffordable + 0.0005
        ? 0
        : Math.max(requested, FLIP_CONFIG.MIN_BET);

  // Wager stays at the value the player sets — no auto clamp / refill on balance changes.

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
    <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] font-arcade overflow-hidden">
      {!walletConnected && (
        <div className="p-8 text-center space-y-3 bg-[#0c0e12]/90">
          <p className="text-sm text-white/55 font-bold">Connect to flip for {CURRENCY_LABEL}</p>
          <button
            onClick={onConnect}
            className="px-6 py-3 text-sm font-black bg-orange-500 hover:bg-orange-400 text-black rounded-xl border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 transition-all shadow-[0_0_24px_rgba(249,115,22,0.25)]"
          >
            CONNECT · DEMO PLAY
          </button>
        </div>
      )}

      <div className="p-3 sm:p-3.5 space-y-3">
        <div className="flex gap-1.5 p-1 rounded-xl bg-[#0e1015] border border-white/[0.06]">
          {(['1v1', 'dogpile'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`flex-1 py-2.5 text-[11px] font-extrabold rounded-lg transition-all ${
                mode === m
                  ? 'bg-orange-500 text-black shadow-[0_0_16px_rgba(249,115,22,0.25)]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {m === '1v1' ? '1v1 INSTANT' : 'DOGPILE POT'}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-white/40 font-bold px-0.5">
          <span>
            Balance{' '}
            <span className="text-orange-400 tabular-nums">{balance.toFixed(3)}</span> {CURRENCY_LABEL}
          </span>
          <span>
            Max <span className="text-amber-300/90">{maxBet}</span> · Rake{' '}
            <span className="text-emerald-400">{rakeLabel(rakeRate)}</span>
          </span>
        </div>
        {player?.holdsBlackballs && (
          <div className="text-[10px] font-extrabold text-amber-300/90 px-2.5 py-1.5 rounded-lg bg-amber-400/8 border border-amber-400/20">
            Holder rake {rakeLabel(rakeRate)} · +{maxBet - FLIP_CONFIG.MAX_BET} max bet
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(['heads', 'tails'] as const).map(s => {
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                disabled={!walletConnected || busy}
                className={`touch-manipulation min-h-[72px] py-3 rounded-xl font-black text-sm uppercase tracking-wider border-b-4 transition-all disabled:opacity-40 active:border-b-0 active:translate-y-1 ${
                  active
                    ? s === 'heads'
                      ? 'bg-orange-500 text-black border-orange-700 shadow-[0_0_28px_rgba(249,115,22,0.3)]'
                      : 'bg-amber-300 text-black border-amber-500 shadow-[0_0_28px_rgba(252,211,77,0.28)]'
                    : 'bg-[#0e1015] text-white/45 border-white/10 hover:bg-[#161920] hover:text-white/70'
                }`}
              >
                <span className="block text-lg leading-none mb-1">{s === 'heads' ? '🟠' : '⚫'}</span>
                {s}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#0e1015] px-3 py-2.5">
          <WagerAmountPanel
            amount={amount}
            onAmountChange={v => setAmount(Number.isFinite(v) && v > 0 ? v : 0)}
            balance={maxAffordable}
            disabled={!walletConnected}
            inputClassName="flex-1 min-w-0 bg-transparent text-2xl font-extrabold text-white outline-none tabular-nums placeholder:text-white/20 disabled:opacity-50"
          />
        </div>

        <input
          type="text"
          maxLength={80}
          placeholder="Taunt / message (optional)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={!walletConnected}
          className="w-full px-3 py-2.5 text-xs bg-[#0e1015] border border-white/[0.07] rounded-xl text-white/80 outline-none focus:border-orange-500/30 transition-colors"
        />

        {error && (
          <div className="px-3 py-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl font-bold">
            {error}
          </div>
        )}

        {waitingOwn ? (
          <button
            type="button"
            onClick={() => void onCancel()}
            className="w-full py-3.5 text-sm font-black bg-[#0e1015] text-rose-300 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
          >
            CANCEL WAITING MATCH
          </button>
        ) : (
          <button
            type="button"
            disabled={!canFlip || safeAmount <= 0}
            onClick={() => void handleFlip()}
            className="w-full touch-manipulation min-h-[56px] py-3.5 text-base font-black uppercase tracking-wide bg-orange-500 hover:bg-orange-400 text-black rounded-xl border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 disabled:opacity-40 transition-all shadow-[0_0_28px_rgba(249,115,22,0.22)]"
          >
            {busy
              ? 'FLIPPING…'
              : mode === '1v1'
                ? `Flip ${side} · ${formatBetTokens(safeAmount)} ${CURRENCY_LABEL}`
                : `Join dogpile · ${side}`}
            {!busy && (
              <span className="block text-[11px] font-bold normal-case tracking-normal opacity-70 mt-0.5">
                {formatBetUsd(tokensToUsd(safeAmount, usdPerToken))}
              </span>
            )}
          </button>
        )}

        {player?.lastOpponent && (
          <button
            type="button"
            disabled={!walletConnected || busy}
            onClick={() => void onRevenge()}
            className="w-full py-2.5 text-xs font-black text-rose-300 border border-rose-500/25 rounded-xl hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
          >
            Revenge vs last opponent
          </button>
        )}

        {isDemoWallet && (
          <div className="text-[10px] text-center text-emerald-300/80 font-bold">
            DEMO MODE · off-chain credits
          </div>
        )}
      </div>

      {mode === '1v1' && openMatches.length > 0 && (
        <div className="px-3 pb-3 border-t border-white/[0.05] pt-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/45 mb-2">
            Open matches
          </div>
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
            {openMatches.map(m => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => void handleFlip(m.id)}
                className="w-full flex justify-between items-center px-3 py-2.5 text-[11px] font-bold rounded-xl bg-[#0e1015] border border-white/[0.06] hover:border-orange-400/35 disabled:opacity-40 transition-colors"
              >
                <span className="text-white/70">
                  {m.creator.display} · {m.creatorSide.toUpperCase()} · {m.wager} {CURRENCY_LABEL}
                </span>
                <span className="text-orange-400 font-extrabold">JOIN</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(player?.winStreak ?? 0) >= 2 && (
        <div className="px-3 py-2 text-xs text-emerald-400 font-bold border-t border-white/[0.05]">
          {player!.winStreak}-win flip streak
        </div>
      )}
      {(player?.lossStreak ?? 0) >= 2 && (
        <div className="px-3 py-2 text-xs text-rose-400 font-bold border-t border-white/[0.05]">
          {player!.lossStreak} losses — revenge time?
        </div>
      )}
    </div>
  );
}
