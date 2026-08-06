import type { Candle } from '@/lib/crash-types';

export function chartVisibleCount(cssW: number): number {
  return cssW < 640 ? 18 : 24;
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

/** Resolve which visible candle slot a trade belongs to. */
export function resolveCandleIndex(
  candles: Candle[],
  visibleStartIdx: number,
  candleT: number | undefined,
  price: number,
): number {
  const slice = candles.slice(visibleStartIdx);
  if (slice.length === 0) return 0;

  if (candleT != null) {
    const byTime = slice.findIndex(c => c.t === candleT);
    if (byTime >= 0) return byTime;
  }

  let best = slice.length - 1;
  let bestDist = Infinity;
  slice.forEach((c, i) => {
    if (price + 0.02 >= c.l && price - 0.02 <= c.h) {
      const dist = Math.min(Math.abs(c.c - price), Math.abs(c.o - price));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
  });
  return best;
}

export function markerXForCandle(layout: ChartLayoutFrame, candleIndexInSlice: number): number {
  return (
    layout.padLeft +
    (layout.slotOffset + candleIndexInSlice + 0.5) * layout.slotW +
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
  const padLeft = 12;
  const padRight = 58;
  const padTop = 24;
  const padBottom = 22;
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
