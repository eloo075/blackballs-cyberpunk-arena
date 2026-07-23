/** Leverage & liquidation math for crash positions. */

export const MIN_LEVERAGE = 1;
export const MAX_LEVERAGE = 50;

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
  return entry * (1 + 1 / leverage);
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
  if (entry <= 0 || exit <= 0) return -margin;
  if (side === 'buy') {
    return Math.max(-margin, margin * leverage * (exit / entry - 1));
  }
  return Math.max(-margin, margin * leverage * (1 - exit / entry));
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
