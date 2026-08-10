import { DEMO_MIN_BALANCE, DEMO_REFILL_BB } from '@/lib/demo-credits';
import { MAX_DEMO_BALANCE, roundMoney } from '@/lib/crash-pnl';
import type { FullState } from '@/lib/crash-types';
import type { FlipFullState } from '@/lib/flip-types';

/**
 * Normalize a balance for session boot / explicit demo refill.
 * Does NOT rewrite a true 0 mid-round — callers that sync enter/cashout must pass
 * the real liquid balance (0 after all-in is valid).
 */
export function normalizeDemoSessionBalance(
  address: string,
  balance: number,
  isRealWallet = false,
  opts?: { allowRefill?: boolean },
): number {
  const n = Number.isFinite(balance)
    ? roundMoney(Math.min(MAX_DEMO_BALANCE, Math.max(0, balance)))
    : 0;
  if (isRealWallet || address.startsWith('0x')) return n;
  if (opts?.allowRefill !== false && n < DEMO_MIN_BALANCE) return DEMO_REFILL_BB;
  return n;
}

/** Client-side balance to push into game servers. Preserves 0 (all-in / rug loss). */
export function resolveClientSyncBalance(
  wallet: { connected: boolean; blackballsBalance: number; isRealWallet: boolean },
  opts?: { allowRefill?: boolean },
): number {
  if (!wallet.connected) return 0;
  const n = Number.isFinite(wallet.blackballsBalance)
    ? roundMoney(Math.min(MAX_DEMO_BALANCE, Math.max(0, wallet.blackballsBalance)))
    : 0;
  // Only bump empty demo wallets when explicitly allowed (boot / manual refill path).
  if (!wallet.isRealWallet && opts?.allowRefill && n < DEMO_MIN_BALANCE) return DEMO_REFILL_BB;
  return n;
}

/**
 * Balance shown in bet controls.
 * While connected, server liquid is authoritative — including 0 after open/rug.
 */
export function resolvePlayableBalance(
  wallet: { connected: boolean; blackballsBalance: number; isRealWallet: boolean },
  serverBalance?: number,
): number {
  const walletBal = resolveClientSyncBalance(wallet);
  if (!wallet.connected) return walletBal;
  if (serverBalance == null || !Number.isFinite(serverBalance)) return walletBal;
  return roundMoney(
    Math.min(wallet.isRealWallet ? Number.MAX_SAFE_INTEGER : MAX_DEMO_BALANCE, Math.max(0, serverBalance)),
  );
}

/** Ensure SSE payloads always expose a numeric balance and position flags. */
export function normalizeCrashStreamState(
  raw: FullState,
  prev: FullState | null,
  walletFallback = 0,
): FullState {
  const walletBal = Number.isFinite(walletFallback)
    ? roundMoney(Math.min(MAX_DEMO_BALANCE, Math.max(0, walletFallback)))
    : 0;
  let balance = typeof raw.balance === 'number' && Number.isFinite(raw.balance) ? raw.balance : NaN;
  if (!Number.isFinite(balance)) {
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
    positionLots: active ? next.positionLots ?? [] : [],
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
    positionLots: prev.positionLots ?? [],
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

  // Server still shows an open live position — always trust it (incl. stacks / lots / debits).
  if (next.hasPosition) {
    return {
      ...next,
      hasLivePosition: true,
      entryPending: false,
      positionLots: Array.isArray(next.positionLots) ? next.positionLots : prev.positionLots ?? [],
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
    positionLots: prev.positionLots ?? [],
    // Keep the lower liquid balance if server already deducted (stack buy).
    balance: Math.min(next.balance, prev.balance),
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
    positionLots: [],
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
    positionLots: prev.positionLots ?? next.positionLots ?? [],
  };
}

/**
 * After cashout succeeds, ignore stale SSE that restores a closed position briefly.
 * Never Math.max balance — that undid BUY debits and stack opens during suppress.
 */
export function guardCashoutOnStream(
  prev: FullState | null,
  next: FullState,
  suppressUntilMs: number,
  lastCashoutWasFull = false,
): FullState {
  if (Date.now() > suppressUntilMs) return next;
  if (!prev) return next;
  if (isNewRoundTransition(prev, next)) return next;

  // After a FULL cash-out: drop stale frames that still show the closed position.
  if (lastCashoutWasFull && !prev.hasPosition && !prev.entryPending && next.hasPosition) {
    return {
      ...next,
      hasPosition: false,
      hasLivePosition: false,
      entryPending: false,
      positionAmount: 0,
      positionLeverage: 1,
      positionEntryPrice: 1.0,
      positionLots: [],
      // Keep the cashed balance (higher after win) if stale frame is lower.
      balance: Math.max(next.balance, prev.balance),
    };
  }

  const hadLive = prev.hasLivePosition || (prev.hasPosition && !prev.entryPending);
  if (!hadLive) return next;

  const balanceUp = next.balance > prev.balance + 0.0005;
  const sizeDown = next.positionAmount < prev.positionAmount - 0.0005;
  const sizeUp = next.positionAmount > prev.positionAmount + 0.001;
  const balanceDown = next.balance < prev.balance - 0.0005;

  // Stack buy during/after cashout suppress — trust server debit + larger size.
  if (next.hasPosition && !next.entryPending && sizeUp && balanceDown) {
    return {
      ...next,
      hasLivePosition: true,
      entryPending: false,
      positionLots: Array.isArray(next.positionLots) ? next.positionLots : prev.positionLots ?? [],
    };
  }

  // Partial cash-out — position stays open with smaller size / higher balance.
  if (next.hasPosition && !next.entryPending && (balanceUp || sizeDown)) {
    return {
      ...next,
      hasLivePosition: true,
      entryPending: false,
      positionAmount: sizeDown ? Math.min(prev.positionAmount, next.positionAmount) : next.positionAmount,
      positionLots: Array.isArray(next.positionLots) ? next.positionLots : prev.positionLots ?? [],
      // Trust server balance (may be higher after sell). Do not Math.max over a later BUY debit.
      balance: next.balance,
    };
  }

  // Stale SSE with full size after client already reduced — keep smaller amount
  if (next.hasPosition && !next.entryPending && sizeUp) {
    return {
      ...next,
      hasLivePosition: true,
      entryPending: false,
      positionAmount: prev.positionAmount,
      positionSide: prev.positionSide,
      positionLeverage: prev.positionLeverage,
      positionEntryPrice: prev.positionEntryPrice,
      positionLots: prev.positionLots ?? [],
      // Prefer lower liquid if client already spent on another buy.
      balance: Math.min(next.balance, prev.balance),
    };
  }

  // Stale SSE clearing position during suppress window (partial still open on client)
  if (!next.hasPosition && !next.entryPending) {
    const refund = next.balance - prev.balance;
    if (refund >= prev.positionAmount * 0.85) return next;
    return {
      ...next,
      hasPosition: true,
      hasLivePosition: true,
      entryPending: false,
      positionSide: prev.positionSide,
      positionAmount: prev.positionAmount,
      positionLeverage: prev.positionLeverage,
      positionEntryPrice: prev.positionEntryPrice,
      positionLots: prev.positionLots ?? [],
      balance: prev.balance,
    };
  }

  // Steady state — trust the server frame completely (incl. balance decreases).
  return next;
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

/**
 * Apply authoritative server balance to the wallet.
 * Always accept server liquid — including 0 after open / rug / all-in.
 */
export function shouldApplyServerBalance(
  serverBalance: number,
  _walletBalance: number,
  _isDemo = false,
): boolean {
  return Number.isFinite(serverBalance);
}
