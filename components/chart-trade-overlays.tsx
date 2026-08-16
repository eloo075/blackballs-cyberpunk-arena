'use client';

import { useEffect, useRef, useState } from 'react';
import type { Candle, TradeTag } from '@/lib/crash-types';
import type { ChartLayoutFrame } from '@/lib/chart-layout';
import { markerXForTrade, priceToY, resolveCandleIndex } from '@/lib/chart-layout';

const PUBLIC_TOAST_MS = 720;
const PUBLIC_GAP_MS = 80;
const MAX_QUEUE = 8;
/** Fallback when candle spacing can't be inferred (continuous = 16×250ms). */
const DEFAULT_CANDLE_DURATION_SEC = 4;

function candleDurationSec(
  candles: Candle[],
  visibleStartIdx: number,
  candleIdxInSlice: number,
): number {
  const globalIdx = visibleStartIdx + candleIdxInSlice;
  const cur = candles[globalIdx];
  if (!cur) return DEFAULT_CANDLE_DURATION_SEC;
  const next = candles[globalIdx + 1];
  if (next && next.t > cur.t) return Math.max(0.25, next.t - cur.t);
  const prev = candles[globalIdx - 1];
  if (prev && cur.t > prev.t) return Math.max(0.25, cur.t - prev.t);
  return DEFAULT_CANDLE_DURATION_SEC;
}

interface ChartTradeOverlaysProps {
  tradeTags: TradeTag[];
  candles: Candle[];
  layoutRef: React.RefObject<ChartLayoutFrame | null>;
  viewerName?: string | null;
}

function isMine(tag: TradeTag, viewerName?: string | null): boolean {
  if (!viewerName) return false;
  return tag.user === viewerName;
}

/** CSS-pixel metrics for the blue personal buy logo + label (must match canvas collision). */
export function personalBuyMarkerMetrics(cssW: number) {
  const mobile = cssW < 768;
  return {
    logo: mobile ? 20 : 50,
    gap: mobile ? 8 : 12,
    labelH: mobile ? 12 : 16,
  };
}

export function formatPersonalBuyLabel(amount: number): string {
  const amt =
    Math.abs(amount - Math.round(amount)) < 1e-6
      ? String(Math.round(amount))
      : amount.toFixed(2);
  return `Buy +${amt}`;
}

function PersonalMarkerBadge({ tag }: { tag: TradeTag }) {
  const isBuy = tag.side === 'buy';
  const amt =
    Math.abs(tag.amount - Math.round(tag.amount)) < 1e-6
      ? String(Math.round(tag.amount))
      : tag.amount.toFixed(2);
  const label = isBuy ? formatPersonalBuyLabel(tag.amount) : `Sell -${amt}`;

  return (
    <div className="relative pointer-events-none trade-marker-pop w-5 h-5 md:w-[50px] md:h-[50px]">
      {isBuy ? <span className="trade-buy-pulse-ring hidden md:block" aria-hidden /> : null}
      <div
        className={`absolute inset-0 rounded-full flex items-center justify-center overflow-hidden ${
          isBuy ? 'bg-sky-500 trade-buy-logo-pop' : 'bg-sky-500/90'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/142.png"
          alt=""
          width={50}
          height={50}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
      {isBuy ? (
        <div
          data-buy-label
          className="absolute left-1/2 bottom-[calc(100%+8px)] md:bottom-[calc(100%+12px)] whitespace-nowrap leading-none text-[9px] md:text-[13px] font-extrabold tabular-nums z-10 text-white pointer-events-none"
          style={{
            transform: 'translate(calc(-50% + var(--buy-label-dx, 0px)), var(--buy-label-dy, 0px))',
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)',
          }}
        >
          {label}
        </div>
      ) : (
        <>
          <div
            data-label-right
            className="absolute left-[calc(100%+6px)] md:left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] md:text-[13px] font-extrabold tabular-nums z-10 text-white"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)' }}
          >
            {label}
          </div>
          <div
            data-label-left
            className="absolute right-[calc(100%+6px)] md:right-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] md:text-[13px] font-extrabold tabular-nums z-10 hidden text-white"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)' }}
          >
            {label}
          </div>
        </>
      )}
    </div>
  );
}

function PublicActivityBadge({ tag }: { tag: TradeTag }) {
  const isBuy = tag.side === 'buy';
  const sideLabel = isBuy ? `Buy +${tag.amount.toFixed(2)}` : `Sell -${tag.amount.toFixed(2)}`;
  const sideColor = isBuy ? 'text-emerald-400' : 'text-rose-400';

  const body = (
    <>
      <div className="truncate text-[8px] sm:text-[9px] md:text-[11px] font-bold tracking-wide text-white">
        {tag.user}
      </div>
      <div className={`tabular-nums text-[8px] sm:text-[9px] md:text-[11px] font-bold mt-px ${sideColor}`}>
        {sideLabel}
      </div>
    </>
  );

  return (
    <div className="relative pointer-events-none trade-toast-one">
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-[22px] md:h-[22px] rounded-full flex items-center justify-center overflow-hidden ${
          isBuy ? 'bg-orange-500' : 'bg-amber-800'
        }`}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isBuy ? '/blackballs-coin.png' : '/bear-icon.svg'}
          alt=""
          width={14}
          height={14}
          className="w-[12px] h-[12px] sm:w-[13px] sm:h-[13px] md:w-[18px] md:h-[18px]"
          draggable={false}
        />
      </div>
      <div
        data-label-right
        className="absolute left-[14px] sm:left-[16px] md:left-[26px] top-1/2 -translate-y-1/2 min-w-[64px] max-w-[110px] md:max-w-[140px] pl-1.5 md:pl-2 leading-tight z-10 border-l"
        style={{
          borderLeftColor: isBuy ? 'rgb(16 185 129)' : 'rgb(239 68 68)',
          textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.55)',
        }}
      >
        {body}
      </div>
      <div
        data-label-left
        className="absolute right-[14px] sm:right-[16px] md:right-[26px] top-1/2 -translate-y-1/2 min-w-[64px] max-w-[110px] md:max-w-[140px] pr-1.5 md:pr-2 leading-tight z-10 text-right hidden border-r"
        style={{
          borderRightColor: isBuy ? 'rgb(16 185 129)' : 'rgb(239 68 68)',
          textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.55)',
        }}
      >
        {body}
      </div>
    </div>
  );
}

function setLabelSide(el: HTMLDivElement, labelLeft: boolean) {
  const left = el.querySelector<HTMLElement>('[data-label-left]');
  const right = el.querySelector<HTMLElement>('[data-label-right]');
  if (left) left.style.display = labelLeft ? 'block' : 'none';
  if (right) right.style.display = labelLeft ? 'none' : 'block';
}

function tagAnchor(
  layout: ChartLayoutFrame,
  candles: Candle[],
  tag: TradeTag,
): { x: number; y: number; labelLeft: boolean } | null {
  const last = candles[candles.length - 1];
  const onLive =
    !!last &&
    (tag.candleT == null ||
      Math.abs(tag.candleT - last.t) < 1e-3 ||
      (tag.elapsed != null && tag.elapsed + 1e-9 >= last.t));

  // Live trades always pin to the active candle at the exact fill elapsed/price.
  let candleIdx: number;
  if (onLive && last) {
    candleIdx = candles.length - 1 - layout.visibleStartIdx;
  } else {
    candleIdx = resolveCandleIndex(
      candles,
      layout.visibleStartIdx,
      tag.candleT,
      tag.price,
    );
  }
  if (candleIdx < 0) return null;

  const openT = onLive && last ? last.t : tag.candleT;
  let x = markerXForTrade(
    layout,
    candleIdx,
    openT,
    tag.elapsed,
    candleDurationSec(candles, layout.visibleStartIdx, candleIdx),
  );
  const minX = layout.padLeft + 10;
  const maxX = layout.padLeft + layout.chartW - 10;
  if (x < minX - 20 || x > maxX + 28) return null;
  x = Math.min(maxX, Math.max(minX, x));

  // Exact trade price on the candle body — not the live tip.
  let y = priceToY(tag.price, layout);
  const minY = layout.padTop + 16;
  const maxY = layout.padTop + layout.chartH - 16;
  y = Math.min(maxY, Math.max(minY, y));

  const labelLeft = x > layout.padLeft + layout.chartW * 0.48;

  return { x, y, labelLeft };
}

function stackOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  return (index - (total - 1) / 2) * 26;
}

function placeMarkers(
  layout: ChartLayoutFrame,
  candles: Candle[],
  entries: { id: number; tag: TradeTag; el: HTMLDivElement }[],
  zBase: number,
) {
  const resolved: {
    id: number;
    el: HTMLDivElement;
    x: number;
    y: number;
    labelLeft: boolean;
    side: TradeTag['side'];
  }[] = [];

  for (const e of entries) {
    const pos = tagAnchor(layout, candles, e.tag);
    if (!pos) {
      e.el.style.visibility = 'hidden';
      continue;
    }
    resolved.push({
      id: e.id,
      el: e.el,
      x: pos.x,
      y: pos.y,
      labelLeft: pos.labelLeft,
      side: e.tag.side,
    });
  }

  resolved.sort((a, b) => a.id - b.id);
  const groups: number[][] = [];
  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];
    let placed = false;
    for (const g of groups) {
      const head = resolved[g[0]];
      if (Math.abs(head.x - r.x) < 24 && Math.abs(head.y - r.y) < 28) {
        g.push(i);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([i]);
  }

  for (const g of groups) {
    g.forEach((ri, gi) => {
      const r = resolved[ri];
      const oy = r.side === 'buy' ? 0 : stackOffset(gi, g.length) * (layout.cssW < 640 ? 0.7 : 1);
      r.el.style.visibility = 'visible';
      r.el.style.left = `${r.x}px`;
      r.el.style.top = `${r.y + oy}px`;
      r.el.style.transform = 'translate(-50%, -50%)';
      r.el.style.zIndex = String(zBase + gi);
      const labelDy = r.side === 'buy' ? layout.personalBuyLabelDy?.[r.id] ?? 0 : 0;
      r.el.style.setProperty('--buy-label-dy', `${labelDy}px`);
      if (r.side !== 'buy') setLabelSide(r.el, r.labelLeft);
    });
  }
}

export function ChartTradeMarkers({
  tradeTags,
  candles,
  layoutRef,
  viewerName,
}: ChartTradeOverlaysProps) {
  const personalTags = tradeTags.filter(t => isMine(t, viewerName));
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const tagsRef = useRef(personalTags);
  tagsRef.current = personalTags;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const layout = layoutRef.current;
      if (layout) {
        const entries: { id: number; tag: TradeTag; el: HTMLDivElement }[] = [];
        for (const tag of tagsRef.current) {
          const el = nodeRefs.current.get(tag.id);
          if (el) entries.push({ id: tag.id, tag, el });
        }
        placeMarkers(layout, candlesRef.current, entries, 20);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layoutRef]);

  if (personalTags.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[18] pointer-events-none overflow-hidden" aria-hidden>
      {personalTags.map(tag => (
        <div
          key={tag.id}
          ref={el => {
            if (el) nodeRefs.current.set(tag.id, el);
            else nodeRefs.current.delete(tag.id);
          }}
          className="absolute will-change-transform"
          style={{ left: 0, top: 0, visibility: 'hidden' }}
        >
          <PersonalMarkerBadge tag={tag} />
        </div>
      ))}
    </div>
  );
}

export function ChartTradeOverlays({
  tradeTags,
  candles,
  layoutRef,
  viewerName,
}: ChartTradeOverlaysProps) {
  /** Only one public toast on screen at a time — queue the rest. */
  const [activeId, setActiveId] = useState<number | null>(null);
  const lastSeenIdRef = useRef(-1);
  const queueRef = useRef<number[]>([]);
  const showingRef = useRef(false);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const tagsRef = useRef(tradeTags);
  tagsRef.current = tradeTags;
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const clearDrain = () => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
  };

  const showNext = useRef(() => {});
  showNext.current = () => {
    clearDrain();
    const nextId = queueRef.current.shift();
    if (nextId == null) {
      showingRef.current = false;
      setActiveId(null);
      return;
    }
    showingRef.current = true;
    setActiveId(nextId);
    drainTimerRef.current = setTimeout(() => {
      // brief gap before next so the chart stays readable
      setActiveId(null);
      drainTimerRef.current = setTimeout(() => {
        showNext.current();
      }, PUBLIC_GAP_MS);
    }, PUBLIC_TOAST_MS);
  };

  useEffect(() => {
    if (tradeTags.length === 0) return;
    const newest = tradeTags.filter(t => t.id > lastSeenIdRef.current);
    if (newest.length === 0) return;
    lastSeenIdRef.current = Math.max(...newest.map(t => t.id));

    // Skip huge catch-up dumps on first connect / reconnect
    if (newest.length > 12) return;

    const publicNewest = newest.filter(t => {
      if (isMine(t, viewerName)) return false;
      const candles = candlesRef.current;
      const last = candles[candles.length - 1];
      if (!last) return false;
      // Only toast trades that land on the active candle (no old-wallet replay).
      if (t.candleT != null && Math.abs(t.candleT - last.t) < 1e-3) return true;
      if (t.elapsed != null && t.elapsed + 1e-9 >= last.t) return true;
      return false;
    });
    if (publicNewest.length === 0) return;

    for (const tag of publicNewest) {
      if (!queueRef.current.includes(tag.id) && tag.id !== activeId) {
        queueRef.current.push(tag.id);
      }
    }
    // Keep queue short — drop oldest during bot spam so we stay snappy
    if (queueRef.current.length > 3) {
      queueRef.current = queueRef.current.slice(-3);
    }

    if (!showingRef.current) {
      showNext.current();
    }
  }, [tradeTags, viewerName, activeId]);

  useEffect(
    () => () => {
      clearDrain();
      queueRef.current = [];
      showingRef.current = false;
    },
    [],
  );

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const layout = layoutRef.current;
      const el = nodeRef.current;
      const id = activeId;
      if (layout && el && id != null) {
        const tag = tagsRef.current.find(t => t.id === id);
        if (tag) {
          placeMarkers(layout, candlesRef.current, [{ id, tag, el }], 40);
        } else {
          el.style.visibility = 'hidden';
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layoutRef, activeId]);

  const activeTag = activeId != null ? tradeTags.find(t => t.id === activeId) : null;
  if (!activeTag) return null;

  return (
    <div className="absolute inset-0 z-[19] pointer-events-none overflow-hidden hidden sm:block" aria-hidden>
      <div
        key={activeTag.id}
        ref={nodeRef}
        className="absolute will-change-transform"
        style={{ left: 0, top: 0, visibility: 'hidden' }}
      >
        <PublicActivityBadge tag={activeTag} />
      </div>
    </div>
  );
}
