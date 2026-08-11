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
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 sm:w-7 sm:h-7">
        <span
          className="absolute inset-[-2px] sm:inset-[-3px] rounded-full border-2 trade-marker-ring border-sky-400"
          aria-hidden
        />
        <div className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden border-2 shadow-md bg-sky-500/95 border-sky-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/blackballs-marker.png"
            alt=""
            width={22}
            height={22}
            className="w-[14px] h-[14px] sm:w-[20px] sm:h-[20px]"
            draggable={false}
          />
        </div>
      </div>
      {isBuy ? (
        <div
          data-label-right
          className={`absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] sm:bottom-[calc(100%+10px)] whitespace-nowrap rounded px-1 py-px text-[7px] sm:text-[9px] font-bold tabular-nums z-10 ${neonLabel}`}
          style={{ textShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 2px #fff' }}
        >
          {label}
        </div>
      ) : (
        <>
          <div
            data-label-right
            className={`absolute left-[20px] sm:left-[24px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1 py-px text-[7px] sm:text-[9px] font-bold tabular-nums z-10 ${neonLabel}`}
            style={{ textShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 2px #fff' }}
          >
            {label}
          </div>
          <div
            data-label-left
            className={`absolute right-[20px] sm:right-[24px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1 py-px text-[7px] sm:text-[9px] font-bold tabular-nums z-10 hidden ${neonLabel}`}
            style={{ textShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 2px #fff' }}
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
  const boxClass = isBuy
    ? 'border-orange-400/80 text-orange-50'
    : 'border-amber-400/80 text-amber-50';

  const body = (
    <>
      <div className="truncate text-[9px] sm:text-[10px] font-black tracking-wide text-white">
        {tag.user}
      </div>
      <div className="tabular-nums text-[9px] sm:text-[10px] font-extrabold mt-0.5">{sideLabel}</div>
    </>
  );

  return (
    <div className="relative pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] trade-toast-one">
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border overflow-hidden shadow-md ${
          isBuy ? 'bg-orange-500 border-orange-200' : 'bg-amber-800 border-amber-300'
        }`}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isBuy ? '/blackballs-coin.png' : '/bear-icon.svg'}
          alt=""
          width={16}
          height={16}
          className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px]"
          draggable={false}
        />
      </div>
      <div
        data-label-right
        className={`absolute left-[16px] sm:left-[18px] top-1/2 -translate-y-1/2 min-w-[72px] max-w-[120px] rounded-md border px-1.5 py-0.5 leading-tight shadow-lg bg-[#0d0f12]/96 z-10 ${boxClass}`}
      >
        {body}
      </div>
      <div
        data-label-left
        className={`absolute right-[16px] sm:right-[18px] top-1/2 -translate-y-1/2 min-w-[72px] max-w-[120px] rounded-md border px-1.5 py-0.5 leading-tight shadow-lg bg-[#0d0f12]/96 z-10 text-right hidden ${boxClass}`}
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
    // Lift buy amount label only — keep icon centered on the fill price.
    const buyLift = e.tag.side === 'buy' ? (layout.cssW < 768 ? 4 : 6) : 0;
    resolved.push({
      id: e.id,
      el: e.el,
      x: pos.x,
      y: pos.y - buyLift,
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
      const oy = stackOffset(gi, g.length) * (layout.cssW < 640 ? 0.7 : 1);
      // Extra upward stack for buys so labels stay above the white entry line.
      const buyStack = r.side === 'buy' ? gi * (layout.cssW < 768 ? 16 : 18) : oy;
      const finalY = r.side === 'buy' ? r.y - buyStack : r.y + oy;
      r.el.style.visibility = 'visible';
      r.el.style.left = `${r.x}px`;
      r.el.style.top = `${finalY}px`;
      r.el.style.transform = 'translate(-50%, -50%)';
      r.el.style.zIndex = String(zBase + gi);
      // Buy label is centered above the logo — don't flip/hide it.
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
