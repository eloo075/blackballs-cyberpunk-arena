'use client';

import { useEffect, useRef, useState } from 'react';
import type { Candle, TradeTag } from '@/lib/crash-types';
import type { ChartLayoutFrame } from '@/lib/chart-layout';
import { markerXForCandle, priceToY, resolveCandleIndex } from '@/lib/chart-layout';

interface ChartTradeOverlaysProps {
  tradeTags: TradeTag[];
  candles: Candle[];
  layoutRef: React.RefObject<ChartLayoutFrame | null>;
}

function MarkerBadge({ tag }: { tag: TradeTag }) {
  const isBuy = tag.side === 'buy';
  const label = isBuy ? `Buy +${tag.amount.toFixed(3)}` : `Sell -${tag.amount.toFixed(3)}`;

  return (
    <div className="flex items-center gap-1 drop-shadow-lg pointer-events-none">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 overflow-hidden shadow-md ${
          isBuy ? 'bg-emerald-500 border-emerald-300' : 'bg-rose-500 border-rose-300'
        }`}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/blackballs-marker.png"
          alt=""
          width={22}
          height={22}
          className="w-[22px] h-[22px]"
          draggable={false}
        />
      </div>
      <span
        className={`max-w-[120px] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums bg-[#111418]/92 ${
          isBuy
            ? 'border-emerald-500/50 text-emerald-200'
            : 'border-rose-500/50 text-rose-200'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function tagPosition(
  layout: ChartLayoutFrame,
  candles: Candle[],
  tag: TradeTag,
): { x: number; y: number } | null {
  const candleIdx = resolveCandleIndex(
    candles,
    layout.visibleStartIdx,
    tag.candleT,
    tag.price,
  );
  const x = markerXForCandle(layout, candleIdx);
  const y = priceToY(tag.price, layout);
  if (x < layout.padLeft - 8 || x > layout.padLeft + layout.chartW + 8) return null;
  return { x, y };
}

/**
 * Permanent rugs.fun-style markers — one per BUY/SELL at the exact execution price.
 * Positions are updated via DOM (no React setState per frame) so the live stream
 * cannot freeze from a 60fps re-render loop.
 */
export function ChartTradeMarkers({
  tradeTags,
  candles,
  layoutRef,
}: ChartTradeOverlaysProps) {
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const tagsRef = useRef(tradeTags);
  tagsRef.current = tradeTags;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const layout = layoutRef.current;
      const tags = tagsRef.current;
      const candleSnap = candlesRef.current;
      if (layout) {
        for (const tag of tags) {
          const el = nodeRefs.current.get(tag.id);
          if (!el) continue;
          const pos = tagPosition(layout, candleSnap, tag);
          if (!pos) {
            el.style.visibility = 'hidden';
            continue;
          }
          el.style.visibility = 'visible';
          el.style.left = `${pos.x}px`;
          el.style.top = `${pos.y}px`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layoutRef]);

  if (tradeTags.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[18] pointer-events-none overflow-hidden" aria-hidden>
      {tradeTags.map(tag => (
        <div
          key={tag.id}
          ref={el => {
            if (el) nodeRefs.current.set(tag.id, el);
            else nodeRefs.current.delete(tag.id);
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: 0, top: 0, visibility: 'hidden' }}
        >
          <MarkerBadge tag={tag} />
        </div>
      ))}
    </div>
  );
}

/** Brief flash for the newest action (optional accent on top of permanent markers). */
export function ChartTradeOverlays({ tradeTags, candles, layoutRef }: ChartTradeOverlaysProps) {
  const [flashId, setFlashId] = useState<number | null>(null);
  const lastSeenIdRef = useRef(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  useEffect(() => {
    if (tradeTags.length === 0) return;
    const latest = tradeTags[tradeTags.length - 1];
    if (lastSeenIdRef.current === -1) {
      lastSeenIdRef.current = latest.id;
      return;
    }
    if (latest.id <= lastSeenIdRef.current) return;
    lastSeenIdRef.current = latest.id;
    setFlashId(latest.id);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlashId(null), 900);
  }, [tradeTags]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const layout = layoutRef.current;
  const tag = flashId != null ? tradeTags.find(t => t.id === flashId) : null;
  if (!layout || !tag) return null;
  const pos = tagPosition(layout, candlesRef.current, tag);
  if (!pos) return null;

  return (
    <div className="absolute inset-0 z-[19] pointer-events-none overflow-visible" aria-hidden>
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 animate-pulse"
        style={{ left: pos.x, top: pos.y }}
      >
        <div
          className={`w-9 h-9 rounded-full border-2 ${
            tag.side === 'buy' ? 'border-emerald-300/80' : 'border-rose-300/80'
          }`}
        />
      </div>
    </div>
  );
}
