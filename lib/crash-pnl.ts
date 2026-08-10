/** Leverage & liquidation math for crash positions. */

export const MIN_LEVERAGE = 1;
/** Capped at 5x — higher leverage let early cash-outs print free profit off the opening wiggle. */
export const MAX_LEVERAGE = 5;
/** 2% of leveraged notional — charged once at open. */
export const LEVERAGED_OPEN_FEE_RATE = 0.02;
/**
 * Minimum exit / entry ratio for leveraged longs (shorts use the inverse drop).
 * Scales with leverage so 5x cannot scalp at 1.05–1.15x:
 *   1.5x → 1.05 · 2x → 1.06 · 3x → 1.10 · 5x → 1.18 (capped 1.20)
 */
export const MIN_LEVERAGED_EXIT_FLOOR = 1.05;
export const MIN_LEVERAGED_EXIT_CEIL = 1.2;
export const MAX_STIMMY_RATE = 0.5;
export const MAX_FRENZY_RATE = 0.15;
/** Bonus only; total positive PnL can therefore never exceed 3x base profit. */
export const MAX_BONUS_TO_PROFIT = 2;
/** Leveraged bonuses only apply after a meaningful move past the anti-scalp floor. */
export const MIN_LEVERAGED_BONUS_MULT = 1.25;
export const MAX_DEMO_BALANCE = 1_000_000;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function clampRate(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, max);
}

export function clampLeverage(leverage: number): number {
  if (!Number.isFinite(leverage)) return MIN_LEVERAGE;
  return Math.min(MAX_LEVERAGE, Math.max(MIN_LEVERAGE, leverage));
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

/**
 * Minimum allowed exit/entry ratio for leveraged positions.
 * 1x returns 1 (no floor).
 */
export function minExitMultiplierRatio(leverage: number): number {
  const lev = clampLeverage(leverage);
  if (lev <= MIN_LEVERAGE) return 1;
  // Fee break-even is +2% of price; add 4% per extra leverage step → 5x ≈ 1.18x
  const raw = 1 + LEVERAGED_OPEN_FEE_RATE + 0.04 * (lev - 1);
  return Math.min(MIN_LEVERAGED_EXIT_CEIL, Math.max(MIN_LEVERAGED_EXIT_FLOOR, raw));
}

export function minExitPrice(
  side: 'buy' | 'sell',
  entry: number,
  leverage: number,
): number | null {
  if (!Number.isFinite(entry) || entry <= 0) return null;
  const ratio = minExitMultiplierRatio(leverage);
  if (ratio <= 1) return null;
  if (side === 'buy') return Math.round(entry * ratio * 1000) / 1000;
  // Short must fall by the same relative distance
  return Math.round(entry * (2 - ratio) * 1000) / 1000;
}

/** True when a leveraged cash-out at `exit` is allowed (anti-scalp). */
export function isLeveragedExitAllowed(
  side: 'buy' | 'sell',
  leverage: number,
  entry: number,
  exit: number,
): boolean {
  if (!Number.isFinite(leverage) || leverage <= MIN_LEVERAGE) return true;
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(exit) || exit <= 0) return false;
  const bound = minExitPrice(side, entry, leverage);
  if (bound == null) return true;
  if (side === 'buy') return exit + 1e-9 >= bound;
  return exit - 1e-9 <= bound;
}

/**
 * Economic net profit after the prepaid opening fee:
 *   margin × leverage × (exit/entry − 1) − openFee   (longs)
 */
export function netLeveragedProfit(
  side: 'buy' | 'sell',
  margin: number,
  leverage: number,
  entry: number,
  exit: number,
): number {
  const pnl = calcPositionPnl(side, margin, leverage, entry, exit);
  const fee = leveragedOpenFee(margin, leverage);
  return roundMoney(pnl - fee);
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
  return roundMoney(rawPositionPnl(side, margin, leverage, entry, exit));
}

/** Unrounded lot PnL — prefer summing these then rounding once for multi-entry precision. */
export function rawPositionPnl(
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
  return Math.max(-margin, pnl);
}

/** Sum PnL across stacked entry lots (round once — avoids multi-lot rounding drift). */
export function calcLotsPnl(
  side: 'buy' | 'sell',
  lots: { amount: number; entry: number; leverage: number }[] | undefined,
  exit: number,
  fallback?: {
    margin: number;
    leverage: number;
    entry: number;
  },
): number {
  if (lots && lots.length > 0) {
    let total = 0;
    for (const lot of lots) {
      total += rawPositionPnl(side, lot.amount, lot.leverage, lot.entry, exit);
    }
    return roundMoney(total);
  }
  if (fallback) {
    return calcPositionPnl(
      side,
      fallback.margin,
      fallback.leverage,
      fallback.entry,
      exit,
    );
  }
  return 0;
}

/** Per-lot live PnL rows for UI breakdown. */
export function calcLotsPnlBreakdown(
  side: 'buy' | 'sell',
  lots: { amount: number; entry: number; leverage: number }[] | undefined,
  exit: number,
): { entry: number; amount: number; leverage: number; pnl: number }[] {
  if (!lots?.length) return [];
  return lots.map(lot => ({
    entry: lot.entry,
    amount: lot.amount,
    leverage: lot.leverage,
    pnl: calcPositionPnl(side, lot.amount, lot.leverage, lot.entry, exit),
  }));
}

/** ROI % on total margin from lot-accurate PnL. */
export function calcLotsPositionPct(
  side: 'buy' | 'sell',
  lots: { amount: number; entry: number; leverage: number }[] | undefined,
  exit: number,
  fallback?: {
    margin: number;
    leverage: number;
    entry: number;
  },
): number {
  const margin =
    lots && lots.length > 0
      ? lots.reduce((sum, lot) => sum + lot.amount, 0)
      : fallback?.margin ?? 0;
  if (margin <= 0) return 0;
  const pnl = calcLotsPnl(side, lots, exit, fallback);
  return (pnl / margin) * 100;
}

export interface CrashSettlement {
  pnl: number;
  baseProfit: number;
  bonus: number;
  frenzyProc: boolean;
  returnAmount: number;
  openFee: number;
  /** pnl − openFee (economic net after the prepaid fee). */
  netProfit: number;
}

/**
 * The sole Crash payout formula.
 * Gross PnL = margin × leverage × (exit/entry − 1)  [longs]
 * Opening fee is prepaid at entry (not deducted again from returnAmount).
 * Bonuses never apply on early leveraged scalps.
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
  const openFee = leveragedOpenFee(margin, params.leverage);
  if (margin <= 0) {
    return {
      pnl: 0,
      baseProfit: 0,
      bonus: 0,
      frenzyProc: false,
      returnAmount: 0,
      openFee: 0,
      netProfit: 0,
    };
  }

  const pnl = calcPositionPnl(
    params.side,
    margin,
    params.leverage,
    params.entry,
    params.exit,
  );
  const netProfit = roundMoney(pnl - openFee);
  const baseProfit = Math.max(0, pnl);

  const rel =
    Number.isFinite(params.entry) && params.entry > 0 && Number.isFinite(params.exit)
      ? params.side === 'buy'
        ? params.exit / params.entry
        : params.entry / Math.max(params.exit, 1e-9)
      : 0;
  const allowBonus =
    params.leverage <= MIN_LEVERAGE || rel + 1e-9 >= MIN_LEVERAGED_BONUS_MULT;

  const stimmy = allowBonus ? clampRate(params.stimmy ?? 0, MAX_STIMMY_RATE) : 0;
  const frenzy = allowBonus ? clampRate(params.frenzy ?? 0, MAX_FRENZY_RATE) : 0;
  const frenzyProc = frenzy > 0 && (params.random ?? Math.random)() < frenzy;
  const rawBonus = baseProfit * (stimmy + (frenzyProc ? frenzy : 0));
  const bonus = roundMoney(Math.min(rawBonus, baseProfit * MAX_BONUS_TO_PROFIT));
  // Fee already taken at open — do not subtract again from returned margin.
  const returnAmount = roundMoney(Math.max(0, margin + pnl) + bonus);

  if (![pnl, baseProfit, bonus, returnAmount, netProfit].every(Number.isFinite)) {
    return {
      pnl: -margin,
      baseProfit: 0,
      bonus: 0,
      frenzyProc: false,
      returnAmount: 0,
      openFee,
      netProfit: roundMoney(-margin - openFee),
    };
  }

  return { pnl, baseProfit, bonus, frenzyProc, returnAmount, openFee, netProfit };
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
  if (abs < 0.0005) {
    return { text: '±0.000', pct: '0.0' };
  }
  if (abs < 0.01) {
    return {
      text: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(3)}`,
      pct: `${positionPct >= 0 ? '+' : ''}${positionPct.toFixed(1)}`,
    };
  }
  return {
    text: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(3)}`,
    pct: `${positionPct >= 0 ? '+' : ''}${positionPct.toFixed(1)}`,
  };
}
