'use client';
import { useEffect, useRef } from 'react';
import type { Candle, TradeTag } from '@/lib/crash-types';
import { computeChartLayout, type ChartLayoutFrame } from '@/lib/chart-layout';
import { ChartTradeOverlays } from '@/components/chart-trade-overlays';

interface ChartCanvasProps {
  candles: Candle[];
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  peakMult: number;
  elapsed: number;
  tradeTags: TradeTag[];
  entryPrice?: number | null;
}

const MAX_VISIBLE = 56;

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

export function ChartCanvas({ candles, phase, mult, peakMult, elapsed, tradeTags, entryPrice }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<ChartLayoutFrame | null>(null);
  const propsRef = useRef({ candles, phase, mult, peakMult, elapsed, tradeTags, entryPrice });
  propsRef.current = { candles, phase, mult, peakMult, elapsed, tradeTags, entryPrice };

  const shiftOffsetRef = useRef(0);
  const prevCandleCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const render = () => {
      const p = propsRef.current;
      const dpr = devicePixelRatio || 1;
      const cssW = canvas.offsetWidth;
      const cssH = canvas.offsetHeight;
      const w = (canvas.width = cssW * dpr);
      const h = (canvas.height = cssH * dpr);
      ctx.clearRect(0, 0, w, h);

      const visible = p.candles;
      const aspect = cssW / Math.max(cssH, 1);
      const isSquare = cssW < 768 && aspect > 0.82 && aspect < 1.18;
      const isNarrow = cssW < 420 || isSquare;
      const isDesktop = cssW >= 768 && !isSquare;

      const padLeft = (isDesktop ? 12 : 6) * dpr;
      const padRight = (isNarrow ? 44 : isDesktop ? 58 : 52) * dpr;
      const padTop = isSquare ? 8 * dpr : cssH < 360 && !isSquare ? 12 * dpr : 24 * dpr;
      const padBottom = isSquare ? 12 * dpr : cssH < 360 && !isSquare ? 14 * dpr : 22 * dpr;
      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;

      let maxPrice = Math.max(p.peakMult * 1.08, p.mult * 1.06, 1.35);
      let minPrice = 0;
      visible.forEach(c => {
        maxPrice = Math.max(maxPrice, c.h);
        minPrice = Math.min(minPrice, c.l);
      });
      minPrice = Math.max(0, minPrice);
      const range = Math.max(maxPrice - minPrice, 0.35);
      maxPrice = minPrice + range * 1.12;
      minPrice = Math.max(0, minPrice - range * 0.04);

      const yFor = (price: number) => padTop + chartH - ((price - minPrice) / (maxPrice - minPrice)) * chartH;

      const baseFont = isNarrow ? 11 * dpr : isDesktop ? 10 * dpr : 9 * dpr;
      ctx.font = `${baseFont}px JetBrains Mono`;

      const gridSteps = isNarrow ? 4 : isDesktop ? 5 : 6;
      for (let i = 0; i <= gridSteps; i++) {
        const price = minPrice + (i / gridSteps) * (maxPrice - minPrice);
        const y = yFor(price);
        ctx.strokeStyle = 'rgba(0,240,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + chartW, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.textAlign = 'left';
        ctx.fillText(price.toFixed(2), padLeft + chartW + 5 * dpr, y + 3 * dpr);
      }

      const timeTicks = pickTimeTicks(p.elapsed);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.textAlign = 'center';
      for (const t of timeTicks) {
        const ratio = p.elapsed > 0 ? t / Math.max(p.elapsed, 0.001) : 0;
        const x = padLeft + ratio * chartW;
        ctx.fillText(`${Math.round(t)}s`, x, h - 5 * dpr);
      }
      ctx.textAlign = 'left';

      const visibleCount = isSquare ? 28 : isNarrow ? 36 : MAX_VISIBLE;
      const startIdx = Math.max(0, visible.length - visibleCount);
      const slice = visible.slice(startIdx);

      if (visible.length > prevCandleCountRef.current) {
        shiftOffsetRef.current = 1;
      }
      prevCandleCountRef.current = visible.length;
      shiftOffsetRef.current += (0 - shiftOffsetRef.current) * 0.12;
      if (Math.abs(shiftOffsetRef.current) < 0.001) shiftOffsetRef.current = 0;

      layoutRef.current = computeChartLayout(
        cssW,
        cssH,
        visible,
        p.phase,
        p.mult,
        p.peakMult,
        p.elapsed,
        shiftOffsetRef.current,
      );

      const slotW = chartW / visibleCount;
      const shiftPx = shiftOffsetRef.current * slotW;
      const bodyRatio = isDesktop ? 0.88 : isSquare ? 0.92 : 0.9;
      const maxBodyW = isDesktop ? 22 * dpr : 18 * dpr;

      slice.forEach((c, i) => {
        const cx = padLeft + (i + 0.5) * slotW + shiftPx;
        if (cx < padLeft - slotW || cx > padLeft + chartW + slotW) return;

        const isLast = i === slice.length - 1;
        const up = c.c >= c.o;
        const isCrashCandle = p.phase === 'crashed' && isLast && c.c < c.o;
        const color = isCrashCandle ? CANDLE_DOWN : up ? CANDLE_UP : CANDLE_DOWN;

        const yH = yFor(c.h);
        const yL = yFor(c.l);

        const pillW = Math.max(4 * dpr, Math.min(maxBodyW, slotW * bodyRatio));
        const pillTop = Math.min(yH, yL);
        const pillH = Math.max(Math.abs(yL - yH), 4 * dpr);
        const pillX = cx - pillW / 2;

        roundRectPath(ctx, pillX, pillTop, pillW, pillH, pillW / 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isLast && (p.phase === 'running' || p.phase === 'crashed')) {
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = isCrashCandle ? 14 * dpr : 8 * dpr;
          roundRectPath(ctx, pillX, pillTop, pillW, pillH, pillW / 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();
          ctx.restore();
        }
      });

      if (p.phase === 'running' || p.phase === 'crashed') {
        const y = yFor(p.mult);
        const rising = p.phase === 'running';
        const col = rising ? CANDLE_UP : CANDLE_DOWN;

        ctx.strokeStyle = col + '55';
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = col;
        ctx.fillRect(padLeft + chartW, y - 9 * dpr, padRight, 18 * dpr);
        ctx.fillStyle = '#000';
        ctx.font = `bold ${isDesktop ? 11 : 10}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.fillText(`${p.mult.toFixed(2)}x`, padLeft + chartW + padRight / 2, y + 3.5 * dpr);
        ctx.textAlign = 'left';
      }

      if (entryPrice && entryPrice > 0) {
        const ey = yFor(entryPrice);
        ctx.strokeStyle = 'rgba(252,238,10,0.55)';
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(padLeft, ey);
        ctx.lineTo(padLeft + chartW, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fcee0a';
        ctx.font = `${9 * dpr}px JetBrains Mono`;
        ctx.fillText(`ENTRY ${entryPrice.toFixed(2)}`, padLeft + 6 * dpr, ey - 5 * dpr);
      }

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

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative w-full h-full overflow-visible">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <ChartTradeOverlays tradeTags={tradeTags} candles={candles} layoutRef={layoutRef} />
    </div>
  );
}
