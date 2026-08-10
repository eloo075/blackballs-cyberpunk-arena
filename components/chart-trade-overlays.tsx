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

function PersonalMarkerBadge({ tag }: { tag: TradeTag }) {
  const isBuy = tag.side === 'buy';
  const amt =
    Math.abs(tag.amount - Math.round(tag.amount)) < 1e-6
      ? String(Math.round(tag.amount))
      : tag.amount.toFixed(2);
  const label = isBuy ? `Buy +${amt}` : `Sell -${amt}`;
  const neonLabel =
    'border-white/40 text-white bg-[#0d0f12]/88 shadow-[0_0_10px_rgba(255,255,255,0.5)]';

  return (
    <div className="relative pointer-events-none drop-shadow-lg trade-marker-pop">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 sm:w-9 sm:h-9">
        <span
          className="absolute inset-[-2px] sm:inset-[-3px] rounded-full border-2 trade-marker-ring border-sky-400"
          aria-hidden
        />
        <div className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden border-2 shadow-md bg-sky-500/95 border-sky-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/blackballs-marker.png"
            alt=""
            width={26}
            height={26}
            className="w-[18px] h-[18px] sm:w-[26px] sm:h-[26px]"
            draggable={false}
          />
        </div>
      </div>
      {/* Beside the logo only — ENTRY stays above the entry line, so they never stack. */}
      <div
        data-label-right
        className={`absolute left-[24px] sm:left-[28px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1 sm:px-1.5 py-px text-[8px] sm:text-[10px] font-bold tabular-nums z-10 ${neonLabel}`}
        style={{ textShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 2px #fff' }}
      >
        {label}
      </div>
      <div
        data-label-left
        className={`absolute right-[24px] sm:right-[28px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1 sm:px-1.5 py-px text-[8px] sm:text-[10px] font-bold tabular-nums z-10 hidden ${neonLabel}`}
        style={{ textShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 2px #fff' }}
      >
        {label}
      </div>
    </div>
  );
}

function PublicActivityBadge({ tag }: { tag: TradeTag }) {
  const isBuy = tag.side === 'buy';
  const sideLabel = isBuy ? `Buy +${tag.amount.toFixed(3)}` : `Sell -${tag.amount.toFixed(3)}`;
  const boxClass = isBuy
    ? 'border-orange-400 text-orange-50'
    : 'border-amber-400 text-amber-50';

  const body = (
    <>
      <div className="truncate text-[11px] sm:text-xs font-black tracking-wide text-white">
        {tag.user}
      </div>
      <div className="tabular-nums text-[11px] sm:text-xs font-extrabold mt-0.5">{sideLabel}</div>
    </>
  );

  return (
    <div className="relative pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] trade-toast-one">
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 overflow-hidden shadow-md ${
          isBuy ? 'bg-orange-500 border-orange-200' : 'bg-amber-800 border-amber-300'
        }`}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isBuy ? '/blackballs-coin.png' : '/bear-icon.svg'}
          alt=""
          width={22}
          height={22}
          className="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px]"
          draggable={false}
        />
      </div>
      <div
        data-label-right
        className={`absolute left-[20px] sm:left-[22px] top-1/2 -translate-y-1/2 min-w-[88px] max-w-[150px] rounded-lg border-2 px-2 py-1 leading-tight shadow-lg bg-[#0d0f12]/96 z-10 ${boxClass}`}
      >
        {body}
      </div>
      <div
        data-label-left
        className={`absolute right-[20px] sm:right-[22px] top-1/2 -translate-y-1/2 min-w-[88px] max-w-[150px] rounded-lg border-2 px-2 py-1 leading-tight shadow-lg bg-[#0d0f12]/96 z-10 text-right hidden ${boxClass}`}
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
  const candleIdx = resolveCandleIndex(
    candles,
    layout.visibleStartIdx,
    tag.candleT,
    tag.price,
  );
  if (candleIdx < 0) return null;

  let x = markerXForTrade(
    layout,
    candleIdx,
    tag.candleT,
    tag.elapsed,
    candleDurationSec(candles, layout.visibleStartIdx, candleIdx),
  );
  const minX = layout.padLeft + 10;
  const maxX = layout.padLeft + layout.chartW - 10;
  if (x < minX - 20 || x > maxX + 28) return null;
  x = Math.min(maxX, Math.max(minX, x));

  let y = priceToY(tag.price, layout);
  const minY = layout.padTop + 16;
  const maxY = layout.padTop + layout.chartH - 16;
  y = Math.min(maxY, Math.max(minY, y));

  // Live candle sits on the right — flip labels left so they aren't clipped by the axis
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
  const resolved: { id: number; el: HTMLDivElement; x: number; y: number; labelLeft: boolean }[] =
    [];
  const mobileLift = 0;

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
      y: pos.y + mobileLift,
      labelLeft: pos.labelLeft,
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
      const oy = stackOffset(gi, g.length) * (layout.cssW < 640 ? 0.7 : 1);
      r.el.style.visibility = 'visible';
      r.el.style.left = `${r.x}px`;
      r.el.style.top = `${r.y + oy}px`;
      r.el.style.transform = 'translate(-50%, -50%)';
      r.el.style.zIndex = String(zBase + gi);
      setLabelSide(r.el, r.labelLeft);
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

    const publicNewest = newest.filter(t => !isMine(t, viewerName));
    if (publicNewest.length === 0) return;

    for (const tag of publicNewest) {
      if (!queueRef.current.includes(tag.id) && tag.id !== activeId) {
        queueRef.current.push(tag.id);
      }
    }
    // Keep queue short — drop oldest during bot spam so we stay snappy
    if (queueRef.current.length > MAX_QUEUE) {
      queueRef.current = queueRef.current.slice(-MAX_QUEUE);
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
