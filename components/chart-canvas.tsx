'use client';
import { useEffect, useRef } from 'react';
import type { Candle, TradeTag } from '@/lib/crash-types';

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

      const slotW = chartW / visibleCount;
      const shiftPx = shiftOffsetRef.current * slotW;
      const bodyRatio = isDesktop ? 0.72 : isSquare ? 0.78 : 0.75;
      const maxBodyW = isDesktop ? 14 * dpr : 12 * dpr;

      slice.forEach((c, i) => {
        const cx = padLeft + (i + 0.5) * slotW + shiftPx;
        if (cx < padLeft - slotW || cx > padLeft + chartW + slotW) return;

        const isLast = i === slice.length - 1;
        const up = c.c >= c.o;
        const isCrashCandle = p.phase === 'crashed' && isLast && c.c < c.o;
        const color = isCrashCandle ? '#ff003c' : up ? '#00ff9c' : '#ff003c';
        const fillColor = isCrashCandle ? 'rgba(255,0,60,0.45)' : up ? 'rgba(0,255,156,0.14)' : 'rgba(255,0,60,0.14)';

        const yH = yFor(c.h);
        const yL = yFor(c.l);
        const yO = yFor(c.o);
        const yC = yFor(c.c);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx, yH);
        ctx.lineTo(cx, yL);
        ctx.stroke();

        const bodyW = Math.max(2 * dpr, Math.min(maxBodyW, slotW * bodyRatio));
        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(Math.abs(yO - yC), 1.5 * dpr);
        ctx.fillStyle = fillColor;
        ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 * dpr;
        ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);

        if (isLast && (p.phase === 'running' || p.phase === 'crashed')) {
          ctx.shadowColor = color;
          ctx.shadowBlur = isCrashCandle ? 20 : 10;
          ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);
          ctx.shadowBlur = 0;
        }
      });

      if (p.phase === 'running' || p.phase === 'crashed') {
        const y = yFor(p.mult);
        const rising = p.phase === 'running';
        const col = rising ? '#00ff9c' : '#ff003c';

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

        if (isDesktop) {
          ctx.font = `bold ${22 * dpr}px JetBrains Mono`;
          ctx.fillStyle = col;
          ctx.shadowColor = col;
          ctx.shadowBlur = 14;
          ctx.fillText(`${p.mult.toFixed(2)}x`, padLeft + 8 * dpr, padTop + 22 * dpr);
          ctx.shadowBlur = 0;
        } else if (isNarrow) {
          ctx.font = `bold ${(isSquare ? 34 : 26) * dpr}px JetBrains Mono`;
          ctx.fillStyle = col;
          ctx.textAlign = 'center';
          ctx.shadowColor = col;
          ctx.shadowBlur = 18;
          ctx.fillText(`${p.mult.toFixed(2)}x`, padLeft + chartW / 2, padTop + 34 * dpr);
          ctx.textAlign = 'left';
          ctx.shadowBlur = 0;
        }
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

      const now = Date.now();
      const tagX =
        slice.length > 0
          ? padLeft + (slice.length - 0.5) * slotW + shiftPx
          : padLeft + slotW * 0.5;
      p.tradeTags.forEach(tag => {
        const age = (now - tag.t) / 1000;
        if (age > 2.5) return;
        const opacity = Math.max(0, 1 - age / 2.5);
        const cy = yFor(tag.price);
        const isBuy = tag.side === 'buy';
        const col = isBuy ? '#00ff9c' : '#ff003c';
        ctx.globalAlpha = opacity;
        const label = `${tag.user} ${tag.amount.toFixed(2)}`;
        ctx.font = `${(isDesktop ? 10 : 9) * dpr}px JetBrains Mono`;
        const tw = ctx.measureText(label).width + 16 * dpr;
        const px = Math.min(tagX + 8 * dpr, padLeft + chartW - tw - 4 * dpr);
        const py = cy;
        ctx.fillStyle = 'rgba(5,7,20,0.9)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1 * dpr;
        const rx = 7 * dpr;
        ctx.beginPath();
        ctx.moveTo(px + rx, py - 9 * dpr);
        ctx.arcTo(px + tw, py - 9 * dpr, px + tw, py + 9 * dpr, rx);
        ctx.arcTo(px + tw, py + 9 * dpr, px, py + 9 * dpr, rx);
        ctx.arcTo(px, py + 9 * dpr, px, py - 9 * dpr, rx);
        ctx.arcTo(px, py - 9 * dpr, px + tw, py - 9 * dpr, rx);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px + 7 * dpr, py, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(label, px + 14 * dpr, py + 3.5 * dpr);
        ctx.globalAlpha = 1;
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

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
