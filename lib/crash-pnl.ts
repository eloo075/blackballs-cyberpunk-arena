/** Leverage & liquidation math for crash positions. */

export const MIN_LEVERAGE = 1;
/** Capped at 5x — higher leverage let early cash-outs print free profit off the opening wiggle. */
export const MAX_LEVERAGE = 5;
export const LEVERAGED_OPEN_FEE_RATE = 0.02;
export const MAX_STIMMY_RATE = 0.5;
export const MAX_FRENZY_RATE = 0.15;
/** Bonus only; total positive PnL can therefore never exceed 3x base profit. */
export const MAX_BONUS_TO_PROFIT = 2;
export const MAX_DEMO_BALANCE = 1_000_000;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function clampRate(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, max);
}

export function leveragedOpenFee(margin: number, leverage: number): number {
  if (
    !Number.isFinite(margin) ||
    !Number.isFinite(leverage) ||
    margin <= 0 ||
    leverage <= MIN_LEVERAGE
  ) {
    return 0;
  }
  return roundMoney(margin * leverage * LEVERAGED_OPEN_FEE_RATE);
}

export function maxAffordableMargin(balance: number, leverage: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  if (!Number.isFinite(leverage) || leverage <= MIN_LEVERAGE) return roundMoney(balance);
  return Math.floor((balance / (1 + leverage * LEVERAGED_OPEN_FEE_RATE)) * 1000) / 1000;
}

export function effectiveNotional(wager: number, leverage: number): number {
  return wager * leverage;
}

/**
 * Price at which a leveraged position loses 100% of margin.
 * Returns null for 1x — only full loss at rug / manual exit.
 *
 * Long:  margin * leverage * (exit/entry - 1) = -margin  →  exit = entry * (1 - 1/L)
 * Short: margin * leverage * (1 - exit/entry) = -margin  →  exit = entry * (1 + 1/L)
 */
export function liquidationPrice(
  side: 'buy' | 'sell',
  entry: number,
  leverage: number,
): number | null {
  if (entry <= 0 || leverage <= 1) return null;
  if (side === 'buy') {
    return entry * (1 - 1 / leverage);
  }
  /** Shorts get a softer liq buffer — 10x liq @ ~1.15x instead of 1.10x. */
  const shortBuffer = 0.005 * Math.min(leverage, 10);
  return entry * (1 + 1 / leverage + shortBuffer);
}

export function isLiquidated(
  side: 'buy' | 'sell',
  entry: number,
  leverage: number,
  current: number,
): boolean {
  const liq = liquidationPrice(side, entry, leverage);
  if (liq == null) return false;
  if (side === 'buy') return current <= liq;
  return current >= liq;
}

export function calcPositionPnl(
  side: 'buy' | 'sell',
  margin: number,
  leverage: number,
  entry: number,
  exit: number,
): number {
  if (!Number.isFinite(margin) || margin <= 0) return 0;
  if (
    !Number.isFinite(leverage) ||
    leverage <= 0 ||
    !Number.isFinite(entry) ||
    entry <= 0 ||
    !Number.isFinite(exit) ||
    exit <= 0
  ) {
    return -margin;
  }
  let pnl: number;
  if (side === 'buy') {
    pnl = margin * leverage * (exit / entry - 1);
  } else {
    pnl = margin * leverage * (1 - exit / entry);
  }
  if (!Number.isFinite(pnl)) return -margin;
  return roundMoney(Math.max(-margin, pnl));
}

export interface CrashSettlement {
  pnl: number;
  baseProfit: number;
  bonus: number;
  frenzyProc: boolean;
  returnAmount: number;
}

/**
 * The sole Crash payout formula. Bonuses are calculated from positive PnL only;
 * returned margin is never bonused and leverage is never applied twice.
 */
export function calcCrashSettlement(params: {
  side: 'buy' | 'sell';
  margin: number;
  leverage: number;
  entry: number;
  exit: number;
  stimmy?: number;
  frenzy?: number;
  random?: () => number;
}): CrashSettlement {
  const margin =
    Number.isFinite(params.margin) && params.margin > 0 ? roundMoney(params.margin) : 0;
  if (margin <= 0) {
    return { pnl: 0, baseProfit: 0, bonus: 0, frenzyProc: false, returnAmount: 0 };
  }

  const pnl = calcPositionPnl(
    params.side,
    margin,
    params.leverage,
    params.entry,
    params.exit,
  );
  const baseProfit = Math.max(0, pnl);
  const stimmy = clampRate(params.stimmy ?? 0, MAX_STIMMY_RATE);
  const frenzy = clampRate(params.frenzy ?? 0, MAX_FRENZY_RATE);
  const frenzyProc = frenzy > 0 && (params.random ?? Math.random)() < frenzy;
  const rawBonus = baseProfit * (stimmy + (frenzyProc ? frenzy : 0));
  const bonus = roundMoney(Math.min(rawBonus, baseProfit * MAX_BONUS_TO_PROFIT));
  const returnAmount = roundMoney(Math.max(0, margin + pnl) + bonus);

  if (![pnl, baseProfit, bonus, returnAmount].every(Number.isFinite)) {
    return {
      pnl: -margin,
      baseProfit: 0,
      bonus: 0,
      frenzyProc: false,
      returnAmount: 0,
    };
  }

  return { pnl, baseProfit, bonus, frenzyProc, returnAmount };
}

export function calcPositionPct(
  side: 'buy' | 'sell',
  leverage: number,
  entry: number,
  current: number,
): number {
  if (entry <= 0 || current <= 0) return 0;
  if (side === 'buy') return leverage * (current / entry - 1) * 100;
  return leverage * (1 - current / entry) * 100;
}

/** Live PnL display — avoid noisy -0.001 on tiny wagers. */
export function formatLivePnl(pnl: number, positionPct: number): { text: string; pct: string } {
  const abs = Math.abs(pnl);
  if (abs < 0.005) {
    return { text: '±0.00', pct: '0.0' };
  }
  if (abs < 0.01) {
    const rounded = 0.01;
    return {
      text: pnl >= 0 ? `+${rounded.toFixed(2)}` : `-${rounded.toFixed(2)}`,
      pct: pnl >= 0 ? '+0.0' : '-0.0',
    };
  }
  return {
    text: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
    pct: `${positionPct >= 0 ? '+' : ''}${positionPct.toFixed(1)}`,
  };
}
