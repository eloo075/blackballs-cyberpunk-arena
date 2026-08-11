'use client';
import { useEffect, useRef } from 'react';
import type { Candle, PositionLot, TradeTag } from '@/lib/crash-types';
import {
  chartCandleMetrics,
  chartPriceRange,
  chartSlotOffset,
  chartVisibleCount,
  computeChartLayout,
  formatAxisMultLabel,
  markerXForTrade,
  pickNiceMultTicks,
  type ChartLayoutFrame,
} from '@/lib/chart-layout';
import {
  ChartTradeMarkers,
} from '@/components/chart-trade-overlays';
import { usePageVisibility } from '@/hooks/use-page-visibility';
import { CURRENCY_LABEL } from '@/lib/format-currency';

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
  /** Every buy lot (presale + live stacks) gets its own solid entry line. */
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
const CASHOUT_GREEN = '#10B981';
const LIVE_Y_DAMP = 0.15;
/** Mobile public trade toasts — one at a time on the live candle tip. */
const MOBILE_TRADE_MARKER_MS = 900;
const MOBILE_TRADE_GAP_MS = 60;
const DEFAULT_CANDLE_DURATION_SEC = 4;

interface LiveTradeOverlay {
  id: number;
  type: 'BUY' | 'SELL';
  username: string;
  amount: number;
  price: number;
  candleT?: number;
  elapsed?: number;
  timestamp: number;
}

interface CashoutSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface CashoutFx {
  x: number;
  y: number;
  text: string;
  alpha: number;
  scale: number;
  sparks: CashoutSpark[];
}

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth badge text — 2dp for readable count-up; rug locks at 0x. */
function formatLiveMultLabel(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0.00x';
  if (v >= 100) return `${v.toFixed(1)}x`;
  return `${v.toFixed(2)}x`;
}

function snap(n: number): number {
  return Math.round(n);
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

function spawnCashoutFx(x: number, y: number, amount: number): CashoutFx {
  const sparks: CashoutSpark[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
    const speed = 1.2 + Math.random() * 2.4;
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 0.6,
      life: 1,
    });
  }
  return {
    x,
    y,
    text: `+${amount.toFixed(2)} ${CURRENCY_LABEL}`,
    alpha: 1,
    scale: 1,
    sparks,
  };
}

function candleDurationSec(candles: Candle[], visibleStartIdx: number, candleIdxInSlice: number): number {
  const globalIdx = visibleStartIdx + candleIdxInSlice;
  const cur = candles[globalIdx];
  if (!cur) return DEFAULT_CANDLE_DURATION_SEC;
  const next = candles[globalIdx + 1];
  if (next && next.t > cur.t) return Math.max(0.25, next.t - cur.t);
  const prev = candles[globalIdx - 1];
  if (prev && cur.t > prev.t) return Math.max(0.25, cur.t - prev.t);
  return DEFAULT_CANDLE_DURATION_SEC;
}

/** True when the trade belongs on the currently forming (active) candle. */
function isLiveCandleTrade(tag: { candleT?: number; elapsed?: number }, candles: Candle[]): boolean {
  const last = candles[candles.length - 1];
  if (!last) return false;
  if (tag.candleT != null && Math.abs(tag.candleT - last.t) < 1e-3) return true;
  if (tag.elapsed != null && tag.elapsed + 1e-9 >= last.t) return true;
  return false;
}

function truncateUser(name: string): string {
  if (name.length <= 9) return name;
  return `${name.slice(0, 3)}…${name.slice(-3)}`;
}

function formatTradeAmt(amount: number): string {
  if (Math.abs(amount - Math.round(amount)) < 1e-6) return String(Math.round(amount));
  if (amount >= 100) return amount.toFixed(1);
  return amount.toFixed(2);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawMobileTradeMarker(
  ctx: CanvasRenderingContext2D,
  m: LiveTradeOverlay,
  x: number,
  y: number,
  dpr: number,
  labelLeft: boolean,
  coinImg: HTMLImageElement | null,
  bearImg: HTMLImageElement | null,
) {
  const isBuy = m.type === 'BUY';
  const iconR = 4.5 * dpr;
  const iconD = iconR * 2;
  const age = Date.now() - m.timestamp;
  const life = Math.max(0, 1 - age / MOBILE_TRADE_MARKER_MS);
  const alpha = life > 0.18 ? 1 : life / 0.18;
  // Small pop-in on the candle tip.
  const popT = Math.min(1, age / 220);
  const scale = 0.55 + 0.45 * easeOutBack(popT);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);

  ctx.beginPath();
  ctx.arc(x, y, iconR + 0.7 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = isBuy ? '#F97316' : '#78350f';
  ctx.fill();
  ctx.strokeStyle = isBuy ? '#FDBA74' : '#FCD34D';
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();

  const img = isBuy ? coinImg : bearImg;
  if (img && img.complete && img.naturalWidth > 0) {
    const s = iconD * 0.82;
    ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, iconR * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  const user = truncateUser(m.username);
  const sideLine = isBuy ? `Buy +${formatTradeAmt(m.amount)}` : `Sell -${formatTradeAmt(m.amount)}`;
  const userFont = `700 ${6.5 * dpr}px JetBrains Mono, monospace`;
  const amtFont = `700 ${6.5 * dpr}px JetBrains Mono, monospace`;
  ctx.font = userFont;
  const userW = ctx.measureText(user).width;
  ctx.font = amtFont;
  const amtW = ctx.measureText(sideLine).width;
  const pillPadX = 3.5 * dpr;
  const pillW = Math.max(userW, amtW) + pillPadX * 2;
  const pillH = 15 * dpr;
  const gap = 3.5 * dpr;
  const pillX = labelLeft ? x - iconR - gap - pillW : x + iconR + gap;
  const pillY = y - pillH / 2;

  roundRectPath(ctx, pillX, snap(pillY), pillW, pillH, 4 * dpr);
  ctx.fillStyle = 'rgba(13, 15, 18, 0.92)';
  ctx.fill();
  ctx.strokeStyle = isBuy ? 'rgba(249, 115, 22, 0.7)' : 'rgba(245, 158, 11, 0.65)';
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = userFont;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(user, pillX + pillPadX, y - 3.5 * dpr);
  ctx.font = amtFont;
  ctx.fillStyle = isBuy ? '#10B981' : '#EF4444';
  ctx.fillText(sideLine, pillX + pillPadX, y + 3.8 * dpr);

  ctx.restore();
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
    viewerName,
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
    viewerName,
  };
  const pageActive = usePageVisibility(active);

  const shiftOffsetRef = useRef(0);
  const prevCandleCountRef = useRef(0);
  /** Incoming WS/price ticks — drained by the RAF lerp loop (decoupled from paint). */
  const tickQueueRef = useRef<number[]>([]);
  const lastQueuedMultRef = useRef<number | null>(null);
  const smoothMultRef = useRef(1);
  const smoothCandleRef = useRef<{ t: number; h: number; l: number; c: number } | null>(null);
  const smoothRangeRef = useRef({ min: 0, max: 2, primed: false });
  /** Damped screen-Y for live price line / badge (kills sub-pixel tremor). */
  const smoothLiveYRef = useRef<number | null>(null);
  const cashoutFxRef = useRef<CashoutFx[]>([]);
  const seenSellIdsRef = useRef<Set<number>>(new Set());
  const sellBootstrappedRef = useRef(false);
  const liveTradeQueueRef = useRef<LiveTradeOverlay[]>([]);
  const activeLiveTradeRef = useRef<LiveTradeOverlay | null>(null);
  const nextLiveTradeAtRef = useRef(0);
  const seenPublicTradeIdsRef = useRef<Set<number>>(new Set());
  const publicTradeBootstrappedRef = useRef(false);
  const coinImgRef = useRef<HTMLImageElement | null>(null);
  const bearImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!pageActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;

    if (!coinImgRef.current) {
      const coin = new Image();
      coin.src = '/blackballs-coin.png';
      coinImgRef.current = coin;
    }
    if (!bearImgRef.current) {
      const bear = new Image();
      bear.src = '/bear-icon.svg';
      bearImgRef.current = bear;
    }

    let lastFrame = performance.now();
    const SHIFT_LERP_PER_SEC = 8;
    const PRICE_LERP_PER_SEC = 16;
    const RANGE_LERP_PER_SEC = 9;

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
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, cssW, cssH);

      // Rich dark radial base (non-flat black).
      const baseGrad = ctx.createRadialGradient(
        cssW * 0.5,
        cssH * 0.45,
        Math.min(cssW, cssH) * 0.08,
        cssW * 0.5,
        cssH * 0.5,
        Math.max(cssW, cssH) * 0.72,
      );
      baseGrad.addColorStop(0, '#0e1118');
      baseGrad.addColorStop(1, '#06070a');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, cssW, cssH);

      const isMobile = cssW < 768;
      const padLeft = isMobile ? 36 : 40;
      const padRight = isMobile ? 56 : 62;
      const padTop = isMobile ? 8 : 24;
      const padBottom = isMobile ? 4 : 22;
      const chartW = cssW - padLeft - padRight;
      const chartH = cssH - padTop - padBottom;
      const visibleCount = chartVisibleCount(cssW);
      const visible = p.candles;
      const startIdx = Math.max(0, visible.length - visibleCount);
      const slice = visible.slice(startIdx).map(c => ({ ...c }));

      // Ingest price ticks into a queue (render never snaps to raw WS cadence).
      // After rug: hard-lock at 0x — clear queue so the badge never keeps counting.
      const targetMult =
        p.phase === 'crashed'
          ? 0
          : Number.isFinite(p.mult) && p.mult > 0
            ? p.mult
            : 1;
      if (p.phase === 'crashed') {
        tickQueueRef.current = [];
        lastQueuedMultRef.current = 0;
        smoothMultRef.current = 0;
        if (smoothCandleRef.current) {
          smoothCandleRef.current.c = 0;
          smoothCandleRef.current.l = Math.min(smoothCandleRef.current.l, 0.01);
        }
        smoothLiveYRef.current = null;
      } else if (lastQueuedMultRef.current !== targetMult) {
        tickQueueRef.current.push(targetMult);
        if (tickQueueRef.current.length > 12) {
          tickQueueRef.current = tickQueueRef.current.slice(-6);
        }
        lastQueuedMultRef.current = targetMult;
      }

      const priceT = 1 - Math.exp(-PRICE_LERP_PER_SEC * dt);
      let head = tickQueueRef.current[0] ?? targetMult;
      if (p.phase !== 'crashed') {
        smoothMultRef.current = lerp(smoothMultRef.current, head, priceT);
        while (
          tickQueueRef.current.length > 0 &&
          Math.abs(smoothMultRef.current - tickQueueRef.current[0]) < 0.00035
        ) {
          tickQueueRef.current.shift();
          head = tickQueueRef.current[0] ?? targetMult;
        }
        if (tickQueueRef.current.length > 4) {
          smoothMultRef.current = lerp(smoothMultRef.current, targetMult, Math.min(1, priceT * 2.5));
        }
      }
      const dispMult = p.phase === 'crashed' ? 0 : smoothMultRef.current;

      if (slice.length > 0 && (p.phase === 'running' || p.phase === 'crashed')) {
        const last = slice[slice.length - 1];
        const prev = smoothCandleRef.current;
        if (!prev || prev.t !== last.t) {
          smoothCandleRef.current = {
            t: last.t,
            h: Math.max(last.h, last.o, dispMult),
            l: Math.min(last.l, last.o, dispMult),
            c: dispMult,
          };
        } else {
          const targetC = p.phase === 'running' ? dispMult : last.c;
          const targetH = Math.max(last.h, last.o, targetC);
          const targetL = Math.min(last.l, last.o, targetC);
          prev.c = lerp(prev.c, targetC, priceT);
          prev.h = lerp(prev.h, Math.max(prev.h, targetH), priceT);
          prev.l = lerp(prev.l, Math.min(prev.l, targetL), priceT);
          prev.h = Math.max(prev.h, last.o, prev.c);
          prev.l = Math.min(prev.l, last.o, prev.c);
        }
        const sm = smoothCandleRef.current!;
        slice[slice.length - 1] = {
          ...last,
          c: sm.c,
          h: Math.max(sm.h, sm.c, last.o),
          l: Math.min(sm.l, sm.c, last.o),
        };
      } else if (p.phase === 'waiting') {
        smoothCandleRef.current = null;
        tickQueueRef.current = [];
        lastQueuedMultRef.current = null;
        smoothMultRef.current = targetMult;
        smoothRangeRef.current.primed = false;
        smoothLiveYRef.current = null;
        cashoutFxRef.current = [];
        seenSellIdsRef.current = new Set();
        sellBootstrappedRef.current = false;
        liveTradeQueueRef.current = [];
        activeLiveTradeRef.current = null;
        nextLiveTradeAtRef.current = 0;
        seenPublicTradeIdsRef.current = new Set();
        publicTradeBootstrappedRef.current = false;
      }

      if (visible.length > prevCandleCountRef.current) {
        shiftOffsetRef.current = 1;
      }
      prevCandleCountRef.current = visible.length;

      const rawRange = chartPriceRange(
        slice.length ? slice : visible,
        dispMult,
        visibleCount,
      );
      const rangeT = 1 - Math.exp(-RANGE_LERP_PER_SEC * dt);
      if (!smoothRangeRef.current.primed) {
        smoothRangeRef.current = {
          min: rawRange.minPrice,
          max: rawRange.maxPrice,
          primed: true,
        };
      } else {
        smoothRangeRef.current.min = lerp(smoothRangeRef.current.min, rawRange.minPrice, rangeT);
        smoothRangeRef.current.max = lerp(smoothRangeRef.current.max, rawRange.maxPrice, rangeT);
      }
      const minPrice = smoothRangeRef.current.min;
      const maxPrice = Math.max(smoothRangeRef.current.max, minPrice + 0.05);

      layoutRef.current = computeChartLayout(
        cssW,
        cssH,
        visible,
        p.phase,
        dispMult,
        p.peakMult,
        p.elapsed,
        shiftOffsetRef.current,
        minPrice,
        maxPrice,
      );

      const slotW = chartW / visibleCount;
      const shiftPx = shiftOffsetRef.current * slotW;
      const slotOffset = chartSlotOffset(visibleCount, slice.length);
      const { candleWidth: bodyW } = chartCandleMetrics(slotW, isMobile, dpr);

      const yFor = (price: number) =>
        padTop + chartH - ((price - minPrice) / (maxPrice - minPrice)) * chartH;

      // Dynamic Y-axis grid + left multiplier badges.
      const axisTicks = pickNiceMultTicks(minPrice, maxPrice, chartH);
      ctx.font = `600 ${(isMobile ? 9 : 10) * dpr}px JetBrains Mono, monospace`;
      ctx.textBaseline = 'middle';
      for (const tick of axisTicks) {
        const gy = snap(yFor(tick));
        if (gy < padTop - 2 || gy > padTop + chartH + 2) continue;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(padLeft, gy);
        ctx.lineTo(padLeft + chartW, gy);
        ctx.stroke();

        const label = formatAxisMultLabel(tick);
        ctx.font = `600 ${(isMobile ? 9 : 10) * dpr}px JetBrains Mono, monospace`;
        const lw = ctx.measureText(label).width;
        const badgeW = lw + 6 * dpr;
        const badgeH = (isMobile ? 14 : 16) * dpr;
        const bx = Math.max(2 * dpr, padLeft - badgeW - 4 * dpr);
        const by = snap(gy - badgeH / 2);
        roundRectPath(ctx, bx, by, badgeW, badgeH, 3 * dpr);
        ctx.fillStyle = 'rgba(10, 12, 16, 0.72)';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.textAlign = 'left';
        ctx.fillText(label, bx + 3 * dpr, gy);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

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

      let lastBodyRight = padLeft;
      slice.forEach((c, i) => {
        const cx = padLeft + (slotOffset + i + 0.5) * slotW + shiftPx;
        if (cx < padLeft - slotW || cx > padLeft + chartW + slotW) return;

        const isLast = i === slice.length - 1;
        const up = c.c >= c.o;
        const isCrashCandle = p.phase === 'crashed' && isLast && c.c < c.o;
        const color = isCrashCandle ? CANDLE_DOWN : up ? CANDLE_UP : CANDLE_DOWN;

        const yH = snap(yFor(c.h));
        const yL = snap(yFor(c.l));
        const yO = snap(yFor(c.o));
        const yC = snap(yFor(c.c));

        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = Math.max(isMobile ? 1.15 : 1.1, (isMobile ? 1.1 : 1) * dpr);
        ctx.beginPath();
        ctx.moveTo(cx, yH);
        ctx.lineTo(cx, yL);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(Math.abs(yC - yO), (isMobile ? 2.4 : 2.2) * dpr);
        const bodyX = cx - bodyW / 2;
        if (isLast) lastBodyRight = bodyX + bodyW;

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
        const activeCandle = slice.length > 0 ? slice[slice.length - 1] : null;
        // Track close tip color from the leading candle body (green if close ≥ open).
        const isGreen = activeCandle ? activeCandle.c >= activeCandle.o : p.phase === 'running';
        const trackStroke = isGreen ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        const trackFill = isGreen ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)';

        const targetY = yFor(activeCandle ? activeCandle.c : dispMult);
        if (smoothLiveYRef.current == null) {
          smoothLiveYRef.current = targetY;
        } else {
          smoothLiveYRef.current += (targetY - smoothLiveYRef.current) * LIVE_Y_DAMP;
        }
        const y = snap(smoothLiveYRef.current);
        const chartRight = padLeft + chartW;
        const tipX = Math.min(chartRight - 2, Math.max(padLeft, lastBodyRight));

        // Soft ambient glow behind the leading candle tip.
        const tipCx =
          slice.length > 0
            ? padLeft + (slotOffset + slice.length - 0.5) * slotW + shiftPx
            : tipX;
        const ambient = ctx.createRadialGradient(tipCx, y, 0, tipCx, y, Math.max(90, chartH * 0.35));
        ambient.addColorStop(
          0,
          isGreen ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
        );
        ambient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ambient;
        ctx.fillRect(padLeft, padTop, chartW, chartH);

        // Dashed tracking line → right edge, anchored to close tip.
        ctx.strokeStyle = trackStroke;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.lineWidth = (isMobile ? 1.35 : 1.15) * dpr;
        ctx.beginPath();
        ctx.moveTo(tipX, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Smooth counting badge (lerp mult → toFixed(2)).
        const liveLabel = formatLiveMultLabel(dispMult);
        const liveFont = (isMobile ? 9 : 11) * dpr;
        ctx.font = `bold ${liveFont}px JetBrains Mono, monospace`;
        const tw = ctx.measureText(liveLabel).width;
        const tagW = tw + (isMobile ? 10 : 12) * dpr;
        const tagH = (isMobile ? 16 : 18) * dpr;
        const tagX = Math.min(cssW - tagW - 2 * dpr, chartRight - tagW * 0.15);
        const tagY = snap(y - tagH / 2);
        roundRectPath(ctx, tagX, tagY, tagW, tagH, 4 * dpr);
        ctx.fillStyle = trackFill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, 0.8 * dpr);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255,255,255,0.55)';
        ctx.shadowBlur = 5 * dpr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(liveLabel, tagX + tagW / 2, y);
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
        const ey = snap(yFor(level.price));
        const x0 = Math.min(
          padLeft + chartW - 4,
          Math.max(padLeft, xForEntryElapsed(layout, visible, level.elapsed)),
        );
        const x1 = padLeft + chartW;

        // Sleek thin solid white entry line.
        ctx.setLineDash([]);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.25 * dpr;
        ctx.beginPath();
        ctx.moveTo(x0, ey);
        ctx.lineTo(x1, ey);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x0, ey, 2.4 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        const label = `ENTRY ${level.price.toFixed(2)}x`;
        const entryFont = (isMobile ? 7 : 8) * dpr;
        ctx.font = `bold ${entryFont}px JetBrains Mono`;
        const tw = ctx.measureText(label).width;
        const bh = (isMobile ? 10 : 12) * dpr;
        const bw = tw + (isMobile ? 7 : 9) * dpr;
        const stack = Math.min(li, 4);
        let bx = x0 - bw * 0.35;
        bx = Math.max(padLeft + 2 * dpr, Math.min(bx, padLeft + chartW - bw - 2 * dpr));
        // Keep ENTRY clearly above the white line (room for Buy badge too).
        const by = snap(ey - bh - (isMobile ? 18 : 20) * dpr - stack * (bh + 3 * dpr));
        roundRectPath(ctx, bx, by, bw, bh, 3 * dpr);
        ctx.fillStyle = 'rgba(8,10,14,0.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = Math.max(1, 0.75 * dpr);
        ctx.stroke();
        ctx.shadowColor = 'rgba(255,255,255,0.75)';
        ctx.shadowBlur = 4 * dpr;
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + (isMobile ? 3.5 : 4.5) * dpr, by + bh / 2);
        ctx.shadowBlur = 0;
        ctx.textBaseline = 'alphabetic';
      });

      if (p.peakMult > 1.15 && p.phase !== 'waiting') {
        const py = snap(yFor(p.peakMult));
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

      // Live-candle buy/sell icons + username (same path on mobile and laptop).
      if (layout) {
        if (p.phase !== 'running') {
          liveTradeQueueRef.current = [];
          activeLiveTradeRef.current = null;
        } else {
          const now = Date.now();
          const viewer = p.viewerName;
          const lastCandle = visible[visible.length - 1];
          if (!publicTradeBootstrappedRef.current) {
            for (const tag of p.tradeTags) {
              seenPublicTradeIdsRef.current.add(tag.id);
            }
            publicTradeBootstrappedRef.current = true;
          } else if (lastCandle) {
            for (const tag of p.tradeTags) {
              if (viewer && tag.user === viewer) continue;
              if (seenPublicTradeIdsRef.current.has(tag.id)) continue;
              seenPublicTradeIdsRef.current.add(tag.id);
              // Only the active candle — skip historical wallets/candles.
              if (!isLiveCandleTrade(tag, visible)) continue;
              liveTradeQueueRef.current.push({
                id: tag.id,
                type: tag.side === 'buy' ? 'BUY' : 'SELL',
                username: tag.user,
                amount: tag.amount,
                price: tag.price,
                candleT: tag.candleT ?? lastCandle.t,
                elapsed: tag.elapsed ?? tag.t,
                timestamp: 0,
              });
            }
            // Keep only the newest couple — never replay a long previous-wallet backlog.
            if (liveTradeQueueRef.current.length > 2) {
              liveTradeQueueRef.current = liveTradeQueueRef.current.slice(-2);
            }
          }

          const active = activeLiveTradeRef.current;
          if (active) {
            const expired = now - active.timestamp > MOBILE_TRADE_MARKER_MS;
            const offLive = !isLiveCandleTrade(active, visible);
            if (expired || offLive) {
              activeLiveTradeRef.current = null;
              nextLiveTradeAtRef.current = now + MOBILE_TRADE_GAP_MS;
            }
          }

          if (
            !activeLiveTradeRef.current &&
            now >= nextLiveTradeAtRef.current &&
            liveTradeQueueRef.current.length > 0
          ) {
            const next = liveTradeQueueRef.current.shift()!;
            next.timestamp = now;
            activeLiveTradeRef.current = next;
          }

          const m = activeLiveTradeRef.current;
          if (m && lastCandle) {
            // Always pin to the active (last) candle slot at the trade's elapsed + price.
            const candleIdx = visible.length - 1 - layout.visibleStartIdx;
            if (candleIdx >= 0) {
              const dur = candleDurationSec(visible, layout.visibleStartIdx, candleIdx);
              let mx = markerXForTrade(
                layout,
                candleIdx,
                lastCandle.t,
                m.elapsed ?? m.candleT,
                dur,
              );
              const minX = padLeft + 10;
              const maxX = padLeft + chartW - 10;
              mx = Math.min(maxX, Math.max(minX, mx));
              // Y = exact fill price on the candle — not the live tip.
              let my = yFor(m.price > 0 ? m.price : dispMult);
              my = Math.min(padTop + chartH - 14, Math.max(padTop + 14, my));
              const labelLeft = mx > padLeft + chartW * 0.48;
              drawMobileTradeMarker(
                ctx,
                m,
                snap(mx),
                snap(my),
                dpr,
                labelLeft,
                coinImgRef.current,
                bearImgRef.current,
              );
            }
          }
        }
      }

      // Cashout floating FX — spawn from personal sell tags (visual only).
      const viewer = p.viewerName;
      if (viewer && layout) {
        if (!sellBootstrappedRef.current) {
          for (const tag of p.tradeTags) {
            if (tag.side === 'sell' && tag.user === viewer) {
              seenSellIdsRef.current.add(tag.id);
            }
          }
          sellBootstrappedRef.current = true;
        } else {
          for (const tag of p.tradeTags) {
            if (tag.side !== 'sell' || tag.user !== viewer) continue;
            if (seenSellIdsRef.current.has(tag.id)) continue;
            seenSellIdsRef.current.add(tag.id);
            const sliceIdx = (() => {
              const g =
                tag.candleT != null
                  ? visible.findIndex(c => Math.abs(c.t - tag.candleT!) < 1e-4)
                  : visible.length - 1;
              const idx = g >= 0 ? g : visible.length - 1;
              return idx - layout.visibleStartIdx;
            })();
            const fxX =
              sliceIdx >= 0
                ? markerXForTrade(
                    layout,
                    sliceIdx,
                    tag.candleT,
                    tag.elapsed ?? tag.t,
                    4,
                  )
                : padLeft + chartW * 0.7;
            const fxY = snap(yFor(tag.price > 0 ? tag.price : dispMult));
            cashoutFxRef.current.push(spawnCashoutFx(fxX, fxY, tag.amount));
            if (cashoutFxRef.current.length > 6) {
              cashoutFxRef.current = cashoutFxRef.current.slice(-6);
            }
          }
        }
      }

      // Animate + draw cashout pills / sparks.
      if (cashoutFxRef.current.length > 0) {
        const next: CashoutFx[] = [];
        for (const fx of cashoutFxRef.current) {
          fx.y -= 1.2;
          fx.alpha -= 0.02;
          fx.scale = Math.min(1.12, fx.scale + 0.01);
          for (const s of fx.sparks) {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.05;
            s.life -= 0.035;
          }
          fx.sparks = fx.sparks.filter(s => s.life > 0);
          if (fx.alpha <= 0) continue;
          next.push(fx);

          ctx.save();
          ctx.globalAlpha = Math.max(0, fx.alpha);
          for (const s of fx.sparks) {
            ctx.globalAlpha = Math.max(0, fx.alpha * s.life);
            ctx.fillStyle = CASHOUT_GREEN;
            ctx.beginPath();
            ctx.arc(snap(s.x), snap(s.y), 1.6 * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = Math.max(0, fx.alpha);
          const fontPx = (isMobile ? 10 : 12) * dpr * fx.scale;
          ctx.font = `bold ${fontPx}px JetBrains Mono, monospace`;
          const tw = ctx.measureText(fx.text).width;
          const pillW = tw + 14 * dpr;
          const pillH = (isMobile ? 18 : 20) * dpr;
          const px = snap(fx.x - pillW / 2);
          const py = snap(fx.y - pillH / 2);
          ctx.shadowColor = 'rgba(16,185,129,0.55)';
          ctx.shadowBlur = 10 * dpr;
          roundRectPath(ctx, px, py, pillW, pillH, 999);
          ctx.fillStyle = 'rgba(8,14,12,0.88)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(16,185,129,0.65)';
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = CASHOUT_GREEN;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(fx.text, snap(fx.x), snap(fx.y));
          ctx.restore();
        }
        cashoutFxRef.current = next;
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
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
    </div>
  );
}
