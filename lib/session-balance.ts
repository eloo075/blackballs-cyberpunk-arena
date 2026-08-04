import { DEMO_MIN_BALANCE, DEMO_REFILL_BB } from '@/lib/demo-credits';
import type { FullState } from '@/lib/crash-types';
import type { FlipFullState } from '@/lib/flip-types';

/** Demo wallets (non-0x) never sync below refill amount on session boot. */
export function normalizeDemoSessionBalance(
  address: string,
  balance: number,
  isRealWallet = false,
): number {
  const n = parseFloat(Math.max(0, balance).toFixed(3));
  if (isRealWallet || address.startsWith('0x')) return n;
  if (n < DEMO_MIN_BALANCE) return DEMO_REFILL_BB;
  return n;
}

/** Client-side balance to push into game servers before betting. */
export function resolveClientSyncBalance(
  wallet: { connected: boolean; blackballsBalance: number; isRealWallet: boolean },
): number {
  if (!wallet.connected) return 0;
  const n = parseFloat(Math.max(0, wallet.blackballsBalance).toFixed(3));
  if (!wallet.isRealWallet && n < DEMO_MIN_BALANCE) return DEMO_REFILL_BB;
  return n;
}

/** Balance shown in bet controls — never flash 0 for demo when wallet has credits. */
export function resolvePlayableBalance(
  wallet: { connected: boolean; blackballsBalance: number; isRealWallet: boolean },
  serverBalance?: number,
): number {
  const walletBal = resolveClientSyncBalance(wallet);
  if (!wallet.connected) return walletBal;
  if (serverBalance == null || Number.isNaN(serverBalance)) return walletBal;
  const s = parseFloat(Math.max(0, serverBalance).toFixed(3));
  if (!wallet.isRealWallet && s < DEMO_MIN_BALANCE && walletBal >= DEMO_MIN_BALANCE) {
    return walletBal;
  }
  return s;
}

/** Ensure SSE payloads always expose a numeric balance and position flags. */
export function normalizeCrashStreamState(
  raw: FullState,
  prev: FullState | null,
  walletFallback = 0,
): FullState {
  const walletBal = parseFloat(Math.max(0, walletFallback).toFixed(3));
  let balance = typeof raw.balance === 'number' && !Number.isNaN(raw.balance) ? raw.balance : NaN;
  if (Number.isNaN(balance)) {
    balance = typeof prev?.balance === 'number' ? prev.balance : walletBal;
  }
  const hasLivePosition =
    raw.hasLivePosition ??
    (Boolean(raw.hasPosition) && raw.phase === 'running');
  const entryPending =
    raw.entryPending ??
    (Boolean(raw.hasPosition) && raw.phase === 'waiting' && !hasLivePosition);
  return {
    ...raw,
    balance,
    hasLivePosition,
    entryPending,
  };
}

/**
 * At round boundaries the SSE snapshot is authoritative — drop inferred/stale position flags.
 */
export function resetPlayerViewForNewRound(next: FullState): FullState {
  const hasPosition = Boolean(next.hasPosition);
  const entryPending = Boolean(next.entryPending);
  const active = hasPosition || entryPending;
  return {
    ...next,
    hasPosition,
    hasLivePosition: Boolean(next.hasLivePosition),
    entryPending,
    positionAmount: active ? next.positionAmount : 0,
    positionLeverage: active ? next.positionLeverage : 1,
    positionEntryPrice: active ? next.positionEntryPrice : 1.0,
  };
}

export function isNewRoundTransition(prev: FullState | null, next: FullState): boolean {
  if (!prev) return false;
  if (next.gameId !== prev.gameId) return true;
  return prev.phase === 'crashed' && next.phase === 'waiting';
}

/**
 * Prevent SSE from briefly clearing a countdown entry while margin is still locked
 * (shows "no position" at 74 BB balance until refund arrives).
 */
export function guardPendingEntryOnStream(prev: FullState | null, next: FullState): FullState {
  if (!prev) return next;
  // New round or post-crash countdown — always trust the server snapshot.
  if (isNewRoundTransition(prev, next)) return next;
  if (prev.gameId !== next.gameId) return next;
  if (prev.phase === 'crashed' || prev.phase === 'running') return next;
  if (!prev || prev.phase !== 'waiting' || next.phase !== 'waiting') return next;
  if (!prev.hasPosition || !prev.entryPending) return next;
  if (next.hasPosition && next.entryPending) return next;
  // Server explicitly cleared the countdown entry — trust it (cancel/refund path).
  if (next.entryPending === false && next.hasPosition === false) return next;

  const refund = next.balance - prev.balance;
  if (refund >= prev.positionAmount * 0.85) return next;

  return {
    ...next,
    hasPosition: prev.hasPosition,
    hasLivePosition: false,
    entryPending: prev.entryPending,
    positionSide: prev.positionSide,
    positionAmount: prev.positionAmount,
    positionLeverage: prev.positionLeverage,
    positionEntryPrice: prev.positionEntryPrice,
  };
}

/**
 * Prevent stale SSE snapshots from clearing an open live position mid-round
 * (multi-instance / reconnect race on serverless).
 */
export function guardLivePositionOnStream(prev: FullState | null, next: FullState): FullState {
  if (!prev) return next;
  if (isNewRoundTransition(prev, next)) return next;
  if (prev.gameId !== next.gameId) return next;
  if (prev.phase !== 'running' || next.phase !== 'running') return next;

  const hadLive = prev.hasLivePosition || (prev.hasPosition && !prev.entryPending);
  if (!hadLive || !prev.hasPosition) return next;

  if (next.hasPosition) {
    if (next.positionAmount <= prev.positionAmount + 0.001) return next;
    return {
      ...next,
      positionAmount: prev.positionAmount,
      positionSide: prev.positionSide,
      positionLeverage: prev.positionLeverage,
      positionEntryPrice: prev.positionEntryPrice,
      hasLivePosition: true,
      entryPending: false,
    };
  }

  if (next.entryPending) return next;

  const refund = next.balance - prev.balance;
  if (refund >= prev.positionAmount * 0.05) return next;

  return {
    ...next,
    hasPosition: true,
    hasLivePosition: true,
    entryPending: false,
    positionSide: prev.positionSide,
    positionAmount: prev.positionAmount,
    positionLeverage: prev.positionLeverage,
    positionEntryPrice: prev.positionEntryPrice,
  };
}

/**
 * After a successful cancel, ignore stale SSE from another serverless instance
 * that still thinks the countdown entry exists.
 */
export function guardCancelledPositionOnStream(
  prev: FullState | null,
  next: FullState,
  suppressUntilMs: number,
): FullState {
  if (Date.now() > suppressUntilMs) return next;
  if (!prev) return next;
  if (isNewRoundTransition(prev, next)) return next;

  const active = next.hasPosition || next.entryPending;
  if (!active) return next;

  const refund = next.balance - prev.balance;
  if (refund >= (prev.positionAmount || 0) * 0.85) return next;

  return {
    ...next,
    hasPosition: false,
    hasLivePosition: false,
    entryPending: false,
    positionAmount: 0,
    positionLeverage: 1,
    positionEntryPrice: 1.0,
  };
}

/**
 * After a successful countdown entry, ignore stale SSE that drops the pending bet
 * before the round starts (multi-instance race).
 */
export function guardRecentEntryOnStream(
  prev: FullState | null,
  next: FullState,
  suppressUntilMs: number,
): FullState {
  if (Date.now() > suppressUntilMs) return next;
  if (!prev) return next;
  if (isNewRoundTransition(prev, next)) return next;
  if (!prev.hasPosition || !prev.entryPending) return next;
  if (next.hasPosition && next.entryPending) return next;

  const refund = next.balance - prev.balance;
  if (refund >= prev.positionAmount * 0.85) return next;

  return {
    ...next,
    hasPosition: true,
    hasLivePosition: next.phase === 'running',
    entryPending: next.phase === 'waiting',
    positionSide: prev.positionSide,
    positionAmount: prev.positionAmount,
    positionLeverage: prev.positionLeverage,
    positionEntryPrice: prev.positionEntryPrice,
  };
}

/** After cashout succeeds, ignore stale SSE that restores a closed position briefly. */
export function guardCashoutOnStream(
  prev: FullState | null,
  next: FullState,
  suppressUntilMs: number,
): FullState {
  if (Date.now() > suppressUntilMs) return next;
  if (!prev) return next;
  if (isNewRoundTransition(prev, next)) return next;

  const hadLive = prev.hasLivePosition || (prev.hasPosition && !prev.entryPending);
  if (!hadLive) return next;

  const balanceUp = next.balance > prev.balance + 0.0005;
  const sizeDown = next.positionAmount < prev.positionAmount - 0.0005;

  // Partial cash-out — position stays open with smaller (or same) size
  if (next.hasPosition && !next.entryPending && (balanceUp || sizeDown)) {
    return {
      ...next,
      hasLivePosition: true,
      entryPending: false,
      positionAmount: sizeDown ? Math.min(prev.positionAmount, next.positionAmount) : next.positionAmount,
    };
  }

  // Stale SSE with full size after client already reduced — keep smaller amount
  if (
    next.hasPosition &&
    !next.entryPending &&
    next.positionAmount > prev.positionAmount + 0.001
  ) {
    return {
      ...next,
      hasLivePosition: true,
      entryPending: false,
      positionAmount: prev.positionAmount,
      positionSide: prev.positionSide,
      positionLeverage: prev.positionLeverage,
      positionEntryPrice: prev.positionEntryPrice,
    };
  }

  // Server acknowledged full close
  if (!next.hasPosition && !next.entryPending) return next;

  const refund = next.balance - prev.balance;
  if (refund >= prev.positionAmount * 0.05) return next;

  // Stale SSE restoring a position that was fully cashed out
  return {
    ...next,
    hasPosition: false,
    hasLivePosition: false,
    entryPending: false,
    positionAmount: 0,
    positionLeverage: 1,
    positionEntryPrice: 1.0,
    balance: Math.max(next.balance, prev.balance),
  };
}

/** Ensure flip SSE player view always has a numeric balance. */
export function normalizeFlipStreamState(
  raw: FlipFullState,
  prev: FlipFullState | null,
  walletFallback = 0,
): FlipFullState {
  if (!raw.player) return raw;
  const walletBal = parseFloat(Math.max(0, walletFallback).toFixed(3));
  let balance =
    typeof raw.player.balance === 'number' && !Number.isNaN(raw.player.balance)
      ? raw.player.balance
      : NaN;
  if (Number.isNaN(balance)) {
    balance =
      typeof prev?.player?.balance === 'number' ? prev.player.balance : walletBal;
  }
  return {
    ...raw,
    player: { ...raw.player, balance },
  };
}

/** Never let SSE overwrite a higher known wallet balance (prevents 0-balance race). */
export function shouldApplyServerBalance(
  serverBalance: number,
  walletBalance: number,
  isDemo = false,
): boolean {
  if (isDemo && serverBalance < DEMO_MIN_BALANCE && walletBalance >= DEMO_MIN_BALANCE) {
    return false;
  }
  if (serverBalance >= walletBalance - 0.001) return true;
  // Server may legitimately be lower when margin is reserved — allow small gaps only.
  return serverBalance > 0 && walletBalance - serverBalance < 50;
}
