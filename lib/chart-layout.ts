import type { Candle } from '@/lib/crash-types';

export function chartVisibleCount(cssW: number): number {
  // Mobile: fewer candles → thicker, clearer bodies (rugs.fun-like).
  if (cssW < 420) return 10;
  if (cssW < 640) return 12;
  return 24;
}

export function chartSlotOffset(visibleCount: number, sliceLength: number): number {
  if (sliceLength >= visibleCount * 0.55) return 0;
  return Math.max(0, Math.floor(visibleCount * 0.55) - sliceLength);
}

export function chartPriceRange(
  candles: Candle[],
  mult: number,
  visibleCount: number,
): { minPrice: number; maxPrice: number } {
  const slice = candles.slice(Math.max(0, candles.length - visibleCount));
  let low = Number.isFinite(mult) && mult > 0 ? mult : 1;
  let high = low;
  for (const candle of slice) {
    low = Math.min(low, candle.l, candle.o, candle.c);
    high = Math.max(high, candle.h, candle.o, candle.c);
  }

  const observed = Math.max(0, high - low);
  const minWindow = Math.max(0.38, mult * 0.42);
  const window = Math.max(observed * 1.35, minWindow);
  const center = (high + low) / 2;
  let minPrice = Math.max(0, center - window / 2);
  let maxPrice = minPrice + window;
  if (maxPrice < high + window * 0.1) {
    maxPrice = high + window * 0.1;
    minPrice = Math.max(0, maxPrice - window);
  }
  return { minPrice, maxPrice };
}

export interface ChartLayoutFrame {
  cssW: number;
  cssH: number;
  padLeft: number;
  padTop: number;
  chartW: number;
  chartH: number;
  minPrice: number;
  maxPrice: number;
  tagX: number;
  shiftPx: number;
  slotW: number;
  visibleStartIdx: number;
  visibleCount: number;
  slotOffset: number;
}

export function priceToY(price: number, layout: ChartLayoutFrame): number {
  const { padTop, chartH, minPrice, maxPrice } = layout;
  return padTop + chartH - ((price - minPrice) / (maxPrice - minPrice)) * chartH;
}

/** Resolve which visible candle slot a trade belongs to. -1 = scrolled off left. */
export function resolveCandleIndex(
  candles: Candle[],
  visibleStartIdx: number,
  candleT: number | undefined,
  price: number,
): number {
  const slice = candles.slice(visibleStartIdx);
  if (slice.length === 0) return 0;

  const lastGlobal = candles.length - 1;
  const last = candles[lastGlobal];

  if (candleT != null && last != null) {
    // Exact / near-exact match on candle open time
    const globalIdx = candles.findIndex(c => Math.abs(c.t - candleT) < 1e-4);
    if (globalIdx >= 0) {
      if (globalIdx < visibleStartIdx) return -1;
      return globalIdx - visibleStartIdx;
    }

    // Tag belongs to the still-forming live bar (open time >= last open)
    if (candleT + 1e-9 >= last.t) {
      if (lastGlobal < visibleStartIdx) return -1;
      return lastGlobal - visibleStartIdx;
    }

    // Nearest prior candle by open time (float drift / pruned history)
    let nearestGlobal = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].t > candleT + 1e-9) break;
      const dist = Math.abs(candles[i].t - candleT);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestGlobal = i;
      }
    }
    if (nearestGlobal < visibleStartIdx) return -1;
    return nearestGlobal - visibleStartIdx;
  }

  // No candleT — prefer live candle, else nearest body by price
  if (last) {
    if (lastGlobal < visibleStartIdx) return -1;
    return lastGlobal - visibleStartIdx;
  }

  void price;
  return Math.max(0, slice.length - 1);
}

export function markerXForCandle(layout: ChartLayoutFrame, candleIndexInSlice: number): number {
  return (
    layout.padLeft +
    (layout.slotOffset + candleIndexInSlice + 0.5) * layout.slotW +
    layout.shiftPx
  );
}

/**
 * X inside the candle body at the moment of the trade.
 * `frac` 0 = left of slot, 1 = right; live trades sit near the growing edge.
 */
export function markerXForTrade(
  layout: ChartLayoutFrame,
  candleIndexInSlice: number,
  candleT: number | undefined,
  tradeElapsed: number | undefined,
  candleDurationSec: number,
): number {
  const slotCenterFrac = 0.5;
  let frac = slotCenterFrac;
  if (
    candleT != null &&
    tradeElapsed != null &&
    Number.isFinite(candleDurationSec) &&
    candleDurationSec > 0
  ) {
    frac = Math.min(0.92, Math.max(0.08, (tradeElapsed - candleT) / candleDurationSec));
  }
  return (
    layout.padLeft +
    (layout.slotOffset + candleIndexInSlice + frac) * layout.slotW +
    layout.shiftPx
  );
}

export function computeChartLayout(
  cssW: number,
  cssH: number,
  candles: Candle[],
  _phase: 'waiting' | 'running' | 'crashed',
  mult: number,
  peakMult: number,
  _elapsed: number,
  shiftOffset: number,
  minPriceOverride?: number,
  maxPriceOverride?: number,
): ChartLayoutFrame {
  const isMobile = cssW < 640;
  const padLeft = isMobile ? 26 : 12;
  const padRight = isMobile ? 8 : 58;
  const padTop = isMobile ? 8 : 24;
  const padBottom = isMobile ? 4 : 22;
  const chartW = cssW - padLeft - padRight;
  const chartH = cssH - padTop - padBottom;

  void peakMult;
  const visibleCount = chartVisibleCount(cssW);
  const computedRange = chartPriceRange(candles, mult, visibleCount);
  const minPrice = minPriceOverride ?? computedRange.minPrice;
  const maxPrice = maxPriceOverride ?? computedRange.maxPrice;
  const startIdx = Math.max(0, candles.length - visibleCount);
  const slice = candles.slice(startIdx);
  const slotW = chartW / visibleCount;
  const shiftPx = shiftOffset * slotW;
  const slotOffset = chartSlotOffset(visibleCount, slice.length);
  const tagX =
    slice.length > 0
      ? padLeft + (slotOffset + slice.length - 0.5) * slotW + shiftPx
      : padLeft + slotW * 0.5;

  return {
    cssW,
    cssH,
    padLeft,
    padTop,
    chartW,
    chartH,
    minPrice,
    maxPrice,
    tagX,
    shiftPx,
    slotW,
    visibleStartIdx: startIdx,
    visibleCount,
    slotOffset,
  };
}
