import type { Candle } from '@/lib/crash-types';

const MAX_VISIBLE = 56;

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
  return layout.padLeft + (candleIndexInSlice + 0.5) * layout.slotW + layout.shiftPx;
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
): ChartLayoutFrame {
  const padLeft = 12;
  const padRight = 58;
  const padTop = 24;
  const padBottom = 22;
  const chartW = cssW - padLeft - padRight;
  const chartH = cssH - padTop - padBottom;

  let maxPrice = Math.max(peakMult * 1.08, mult * 1.06, 1.35);
  let minPrice = 0;
  candles.forEach(c => {
    maxPrice = Math.max(maxPrice, c.h);
    minPrice = Math.min(minPrice, c.l);
  });
  minPrice = Math.max(0, minPrice);
  const range = Math.max(maxPrice - minPrice, 0.35);
  maxPrice = minPrice + range * 1.12;
  minPrice = Math.max(0, minPrice - range * 0.04);

  const visibleCount = MAX_VISIBLE;
  const startIdx = Math.max(0, candles.length - visibleCount);
  const slice = candles.slice(startIdx);
  const slotW = chartW / visibleCount;
  const shiftPx = shiftOffset * slotW;
  const tagX =
    slice.length > 0 ? padLeft + (slice.length - 0.5) * slotW + shiftPx : padLeft + slotW * 0.5;

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
  };
}
