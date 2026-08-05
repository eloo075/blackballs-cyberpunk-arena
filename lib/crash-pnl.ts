/** Leverage & liquidation math for crash positions. */

export const MIN_LEVERAGE = 1;
/** Capped at 5x — higher leverage let early cash-outs print free profit off the opening wiggle. */
export const MAX_LEVERAGE = 5;

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
