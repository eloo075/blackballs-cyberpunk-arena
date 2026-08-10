'use client';
import { useEffect, useRef } from 'react';
import type { Candle, PositionLot, TradeTag } from '@/lib/crash-types';
import {
  chartPriceRange,
  chartSlotOffset,
  chartVisibleCount,
  computeChartLayout,
  markerXForTrade,
  type ChartLayoutFrame,
} from '@/lib/chart-layout';
import {
  ChartTradeMarkers,
  ChartTradeOverlays,
} from '@/components/chart-trade-overlays';
import { usePageVisibility } from '@/hooks/use-page-visibility';

export interface EntryLevel {
  price: number;
  amount: number;
  /** Round elapsed when filled — line starts at this candle. */
  elapsed?: number;
}

interface ChartCanvasProps {
  candles: Candle[];
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  peakMult: number;
  elapsed: number;
  tradeTags: TradeTag[];
  /** @deprecated Prefer entryLevels — kept for single-line callers. */
  entryPrice?: number | null;
  /** Every buy lot (presale + live stacks) gets its own dashed entry line. */
  entryLevels?: EntryLevel[] | null;
  positionSide?: 'buy' | 'sell';
  /** When live: green entry marker if price ≥ entry, red if underwater. */
  entryInProfit?: boolean;
  /** Pause redraw loop when tab hidden or game not visible (mobile perf). */
  active?: boolean;
  /** Truncated viewer name — personal buy/sell markers get blue logo rings. */
  viewerName?: string | null;
}

const CANDLE_UP = '#22c55e';
const CANDLE_DOWN = '#ef4444';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function pickTimeTicks(elapsed: number): number[] {
  const end = Math.max(elapsed, 1);
  let step = 1;
  if (end > 24) step = 5;
  else if (end > 12) step = 2;

  const ticks: number[] = [];
  for (let t = 0; t <= end + 0.001; t += step) {
    ticks.push(Math.round(t * 10) / 10);
  }
  return ticks.length ? ticks : [0];
}

/** Whole-number left axis (1x, 2x, 3x…) — mobile only, sparse & quiet. */
function pickMultAxisTicks(minPrice: number, maxPrice: number, chartH: number): number[] {
  const span = Math.max(0.01, maxPrice - minPrice);
  const minGapPx = 44;
  let step = Math.max(1, Math.ceil((minGapPx * span) / Math.max(chartH, 1)));
  if (step > 2 && step < 5) step = 5;
  else if (step > 5 && step < 10) step = 10;
  else if (step > 10) step = Math.ceil(step / 5) * 5;

  const start = Math.ceil(Math.max(minPrice, 1) / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= maxPrice + 1e-9; v += step) {
    ticks.push(v);
  }
  // Always try to show 1x when it’s in view (common anchor).
  if (minPrice <= 1 && maxPrice >= 1 && !ticks.includes(1)) {
    ticks.push(1);
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

function formatMultAxisLabel(v: number): string {
  return `${Math.round(v)}x`;
}

function formatLiveMultLabel(v: number): string {
  if (!Number.isFinite(v)) return '0x';
  if (Math.abs(v - Math.round(v)) < 1e-6) return `${Math.round(v)}x`;
  if (v >= 10) return `${v.toFixed(1)}x`;
  return `${v.toFixed(2)}x`;
}

/** Collapse near-identical entries so stacked same-price buys share one line. */
export function buildEntryLevels(lots: PositionLot[] | undefined | null): EntryLevel[] {
  if (!lots?.length) return [];
  const buckets = new Map<number, EntryLevel>();
  for (const lot of lots) {
    if (!Number.isFinite(lot.entry) || lot.entry <= 0) continue;
    const key = Math.round(lot.entry * 1e6) / 1e6;
    const prev = buckets.get(key);
    if (prev) {
      prev.amount += lot.amount;
      if (lot.elapsed != null && (prev.elapsed == null || lot.elapsed < prev.elapsed)) {
        prev.elapsed = lot.elapsed;
      }
    } else {
      buckets.set(key, {
        price: key,
        amount: lot.amount,
        elapsed: lot.elapsed,
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.price - b.price);
}

function xForEntryElapsed(
  layout: ChartLayoutFrame,
  candles: Candle[],
  entryElapsed: number | undefined,
): number {
  if (entryElapsed == null || !Number.isFinite(entryElapsed) || candles.length === 0) {
    return layout.padLeft;
  }
  let globalIdx = 0;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].t <= entryElapsed + 1e-9) globalIdx = i;
    else break;
  }
  if (globalIdx < layout.visibleStartIdx) return layout.padLeft;
  const sliceIdx = globalIdx - layout.visibleStartIdx;
  const cur = candles[globalIdx];
  const next = candles[globalIdx + 1];
  const prev = candles[globalIdx - 1];
  const dur =
    next && next.t > cur.t
      ? next.t - cur.t
      : prev && cur.t > prev.t
        ? cur.t - prev.t
        : 4;
  return markerXForTrade(layout, sliceIdx, cur.t, entryElapsed, dur);
}

export function ChartCanvas({
  candles,
  phase,
  mult,
  peakMult,
  elapsed,
  tradeTags,
  entryPrice,
  entryLevels = null,
  positionSide = 'buy',
  entryInProfit = true,
  active = true,
  viewerName = null,
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<ChartLayoutFrame | null>(null);
  const propsRef = useRef({
    candles,
    phase,
    mult,
    peakMult,
    elapsed,
    tradeTags,
    entryPrice,
    entryLevels,
    positionSide,
    entryInProfit,
  });
  propsRef.current = {
    candles,
    phase,
    mult,
    peakMult,
    elapsed,
    tradeTags,
    entryPrice,
    entryLevels,
    positionSide,
    entryInProfit,
  };
  const pageActive = usePageVisibility(active);

  const shiftOffsetRef = useRef(0);
  const prevCandleCountRef = useRef(0);

  useEffect(() => {
    if (!pageActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrame = performance.now();
    const SHIFT_LERP_PER_SEC = 8;

    const render = (frameMs: number) => {
      const p = propsRef.current;
      const dt = Math.min(0.05, Math.max(0, (frameMs - lastFrame) / 1000));
      lastFrame = frameMs;
      shiftOffsetRef.current += (0 - shiftOffsetRef.current) * Math.min(1, SHIFT_LERP_PER_SEC * dt);
      if (Math.abs(shiftOffsetRef.current) < 0.001) shiftOffsetRef.current = 0;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW < 2 || cssH < 2) return;

      const bw = Math.floor(cssW * dpr);
      const bh = Math.floor(cssH * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const isMobile = cssW < 640;
      // Mobile: slim left gutter for quiet 1x/2x/3x labels. Desktop pads unchanged.
      const padLeft = isMobile ? 26 : 12;
      const padRight = isMobile ? 8 : 58;
      const padTop = isMobile ? 8 : 24;
      const padBottom = isMobile ? 4 : 22;
      const chartW = cssW - padLeft - padRight;
      const chartH = cssH - padTop - padBottom;
      const visibleCount = chartVisibleCount(cssW);
      const visible = p.candles;
      const startIdx = Math.max(0, visible.length - visibleCount);
      const slice = visible.slice(startIdx).map(c => ({ ...c }));

      const dispMult = p.mult;
      if (p.phase === 'running' && slice.length > 0) {
        const last = slice[slice.length - 1];
        slice[slice.length - 1] = {
          ...last,
          c: dispMult,
          h: Math.max(last.h, dispMult),
          l: Math.min(last.l, dispMult),
        };
      }

      if (visible.length > prevCandleCountRef.current) {
        shiftOffsetRef.current = 1;
      }
      prevCandleCountRef.current = visible.length;

      const { minPrice, maxPrice } = chartPriceRange(
        slice.length ? slice : visible,
        p.mult,
        visibleCount,
      );

      layoutRef.current = computeChartLayout(
        cssW,
        cssH,
        visible,
        p.phase,
        p.mult,
        p.peakMult,
        p.elapsed,
        shiftOffsetRef.current,
        minPrice,
        maxPrice,
      );

      const slotW = chartW / visibleCount;
      const shiftPx = shiftOffsetRef.current * slotW;
      const slotOffset = chartSlotOffset(visibleCount, slice.length);
      const bodyRatio = isMobile ? 0.62 : 0.55;
      const maxBodyW = (isMobile ? 34 : 28) * dpr;

      const yFor = (price: number) =>
        padTop + chartH - ((price - minPrice) / (maxPrice - minPrice)) * chartH;

      if (isMobile) {
        const axisTicks = pickMultAxisTicks(minPrice, maxPrice, chartH);
        ctx.font = `500 ${8 * dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (const tick of axisTicks) {
          const gy = yFor(tick);
          if (gy < padTop - 2 || gy > padTop + chartH + 2) continue;
          ctx.strokeStyle = 'rgba(255,255,255,0.035)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2 * dpr, 6 * dpr]);
          ctx.beginPath();
          ctx.moveTo(padLeft, gy);
          ctx.lineTo(padLeft + chartW, gy);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillText(formatMultAxisLabel(tick), padLeft - 4, gy);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let g = 0; g < 4; g++) {
          const gy = padTop + (chartH * g) / 3;
          ctx.beginPath();
          ctx.moveTo(padLeft, gy);
          ctx.lineTo(padLeft + chartW, gy);
          ctx.stroke();
        }
      }

      // Desktop only — mobile time labels overlap and clutter the chart.
      if (!isMobile) {
        const timeTicks = pickTimeTicks(p.elapsed);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = `${9 * dpr}px JetBrains Mono`;
        ctx.textAlign = 'center';
        for (const t of timeTicks) {
          const ratio = p.elapsed > 0 ? t / Math.max(p.elapsed, 0.001) : 0;
          const tx = padLeft + ratio * chartW;
          ctx.fillText(`${t.toFixed(t % 1 === 0 ? 0 : 1)}s`, tx, cssH - 6);
        }
        ctx.textAlign = 'left';
      }

      slice.forEach((c, i) => {
        const cx = padLeft + (slotOffset + i + 0.5) * slotW + shiftPx;
        if (cx < padLeft - slotW || cx > padLeft + chartW + slotW) return;

        const isLast = i === slice.length - 1;
        const up = c.c >= c.o;
        const isCrashCandle = p.phase === 'crashed' && isLast && c.c < c.o;
        const color = isCrashCandle ? CANDLE_DOWN : up ? CANDLE_UP : CANDLE_DOWN;

        const yH = yFor(c.h);
        const yL = yFor(c.l);
        const yO = yFor(c.o);
        const yC = yFor(c.c);

        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = Math.max(isMobile ? 1.15 : 1.1, (isMobile ? 1.1 : 1) * dpr);
        ctx.beginPath();
        ctx.moveTo(cx, yH);
        ctx.lineTo(cx, yL);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const bodyW = Math.max((isMobile ? 5 : 4.5) * dpr, Math.min(maxBodyW, slotW * bodyRatio));
        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(Math.abs(yC - yO), (isMobile ? 2.4 : 2.2) * dpr);
        const bodyX = cx - bodyW / 2;

        roundRectPath(ctx, bodyX, bodyTop, bodyW, bodyH, 2 * dpr);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = up ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)';
        ctx.lineWidth = Math.max(1, 0.75 * dpr);
        ctx.beginPath();
        ctx.moveTo(bodyX + 1 * dpr, bodyTop + 1 * dpr);
        ctx.lineTo(bodyX + bodyW - 1 * dpr, bodyTop + 1 * dpr);
        ctx.stroke();

        if (isLast && (p.phase === 'running' || p.phase === 'crashed')) {
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = isCrashCandle ? 16 * dpr : 10 * dpr;
          roundRectPath(ctx, bodyX, bodyTop, bodyW, bodyH, 2 * dpr);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();
          ctx.restore();
        }
      });

      if (p.phase === 'running' || p.phase === 'crashed') {
        const y = yFor(dispMult);
        const rising = p.phase === 'running';
        const col = rising ? CANDLE_UP : CANDLE_DOWN;

        ctx.strokeStyle = col + (isMobile ? '88' : '55');
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.lineWidth = (isMobile ? 1.25 : 1) * dpr;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // White neon live mult pill — just above the candle tip (only live read-out).
        const liveLabel = formatLiveMultLabel(dispMult);
        const liveFont = (isMobile ? 8 : 10) * dpr;
        ctx.font = `bold ${liveFont}px JetBrains Mono, monospace`;
        const tw = ctx.measureText(liveLabel).width;
        const tagW = tw + (isMobile ? 8 : 10) * dpr;
        const tagH = (isMobile ? 12 : 15) * dpr;
        const lastCx =
          slice.length > 0
            ? padLeft + (slotOffset + slice.length - 0.5) * slotW + shiftPx
            : padLeft + chartW * 0.5;
        const tagX = Math.min(
          Math.max(padLeft + 2 * dpr, lastCx - tagW / 2),
          padLeft + chartW - tagW - 2 * dpr,
        );
        const tagY = y - tagH - (isMobile ? 5 : 6) * dpr;
        roundRectPath(ctx, tagX, tagY, tagW, tagH, 3 * dpr);
        ctx.fillStyle = 'rgba(10,12,16,0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = Math.max(1, 0.75 * dpr);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255,255,255,0.95)';
        ctx.shadowBlur = 6 * dpr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(liveLabel, tagX + tagW / 2, tagY + tagH / 2);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      const levels: EntryLevel[] =
        p.entryLevels && p.entryLevels.length > 0
          ? p.entryLevels
          : p.entryPrice && p.entryPrice > 0
            ? [{ price: p.entryPrice, amount: 0, elapsed: 0 }]
            : [];

      const layout = layoutRef.current;
      levels.forEach((level, li) => {
        if (!level.price || level.price <= 0 || !layout) return;
        const ey = yFor(level.price);
        const inProfit =
          p.positionSide === 'sell'
            ? dispMult <= level.price + 1e-9
            : dispMult >= level.price - 1e-9;
        const entryCol = inProfit ? 'rgba(34,197,94,0.78)' : 'rgba(239,68,68,0.78)';
        const entryFill = inProfit ? '#22c55e' : '#ef4444';
        const x0 = Math.min(
          padLeft + chartW - 4,
          Math.max(padLeft, xForEntryElapsed(layout, visible, level.elapsed)),
        );
        const x1 = padLeft + chartW;

        ctx.strokeStyle = entryCol;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(x0, ey);
        ctx.lineTo(x1, ey);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(x0, ey, 3.2 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = entryFill;
        ctx.fill();

        const label = `ENTRY ${level.price.toFixed(2)}x`;
        const entryFont = (isMobile ? 7 : 8) * dpr;
        ctx.font = `bold ${entryFont}px JetBrains Mono`;
        const tw = ctx.measureText(label).width;
        const bh = (isMobile ? 10 : 12) * dpr;
        const bw = tw + (isMobile ? 7 : 9) * dpr;
        const stack = Math.min(li, 4);
        // Always ABOVE the entry line (Buy sits beside the logo) — no overlap.
        let bx = x0 - bw * 0.35;
        bx = Math.max(padLeft + 2 * dpr, Math.min(bx, padLeft + chartW - bw - 2 * dpr));
        const by = ey - bh - (isMobile ? 12 : 14) * dpr - stack * (bh + 3 * dpr);
        roundRectPath(ctx, bx, by, bw, bh, 3 * dpr);
        ctx.fillStyle = 'rgba(8,10,14,0.82)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.38)';
        ctx.lineWidth = Math.max(1, 0.75 * dpr);
        ctx.stroke();
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = 5 * dpr;
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + (isMobile ? 3.5 : 4.5) * dpr, by + bh / 2);
        ctx.shadowBlur = 0;
        ctx.textBaseline = 'alphabetic';
      });

      if (p.peakMult > 1.15 && p.phase !== 'waiting') {
        const py = yFor(p.peakMult);
        ctx.strokeStyle = 'rgba(157,0,255,0.28)';
        ctx.setLineDash([2 * dpr, 4 * dpr]);
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(padLeft, py);
        ctx.lineTo(padLeft + chartW, py);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (slice.length === 0 && p.phase === 'waiting') {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.font = `${12 * dpr}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.fillText('// AWAITING_ROUND', padLeft + chartW / 2, padTop + chartH / 2);
        ctx.textAlign = 'left';
      }
    };

    let raf = 0;
    const loop = (frameMs: number) => {
      render(frameMs);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pageActive]);

  return (
    <div className="relative w-full h-full overflow-visible">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <ChartTradeMarkers
        tradeTags={tradeTags}
        candles={candles}
        layoutRef={layoutRef}
        viewerName={viewerName}
      />
      <ChartTradeOverlays
        tradeTags={tradeTags}
        candles={candles}
        layoutRef={layoutRef}
        viewerName={viewerName}
      />
    </div>
  );
}
