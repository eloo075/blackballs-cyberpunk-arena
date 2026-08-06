'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Candle, TradeTag } from '@/lib/crash-types';
import type { ChartLayoutFrame } from '@/lib/chart-layout';
import { markerXForCandle, priceToY, resolveCandleIndex } from '@/lib/chart-layout';

/** rugs.fun-style: brief toast only — no permanent crowded labels */
const TOOLTIP_TTL_MS = 2000;
const FADE_START_MS = 1550;

interface ChartTradeOverlaysProps {
  tradeTags: TradeTag[];
  candles: Candle[];
  layoutRef: React.RefObject<ChartLayoutFrame | null>;
}

interface OverlayPosition {
  markerX: number;
  markerY: number;
  tooltipX: number;
  tooltipY: number;
}

function TradeIcon({ isBuy }: { isBuy: boolean }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 shadow-lg overflow-hidden ${
        isBuy ? 'bg-[#141518] border-amber-400' : 'bg-[#141518] border-orange-500'
      }`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isBuy ? '/blackballs-coin.png' : '/bear-icon.svg'}
        alt=""
        width={22}
        height={22}
        className="w-[22px] h-[22px]"
        draggable={false}
      />
    </div>
  );
}

function TradeTooltip({ tag }: { tag: TradeTag }) {
  const isBuy = tag.side === 'buy';

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-lg backdrop-blur-sm font-arcade min-w-0 max-w-[140px] ${
        isBuy
          ? 'bg-[#141518]/95 border-amber-400/55'
          : 'bg-[#141518]/95 border-orange-500/55'
      }`}
    >
      <TradeIcon isBuy={isBuy} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold text-white truncate leading-tight">
          {tag.user}
        </div>
        <div
          className={`text-[9px] font-extrabold leading-tight tabular-nums ${
            isBuy ? 'text-amber-300' : 'text-orange-300'
          }`}
        >
          {isBuy ? 'Buy' : 'Sell'} +{tag.amount.toFixed(3)}
        </div>
      </div>
    </div>
  );
}

function computePosition(
  layout: ChartLayoutFrame,
  candles: Candle[],
  tag: TradeTag,
): OverlayPosition {
  const candleIdx = resolveCandleIndex(
    candles,
    layout.visibleStartIdx,
    tag.candleT,
    tag.price,
  );
  const markerX = markerXForCandle(layout, candleIdx);
  const markerY = priceToY(tag.price, layout);
  const tooltipW = 132;
  const tooltipH = 36;

  let tooltipX = markerX + 16;
  if (tooltipX + tooltipW > layout.padLeft + layout.chartW - 4) {
    tooltipX = Math.max(layout.padLeft + 4, markerX - tooltipW - 14);
  }

  const centerBandBottom = layout.padTop + layout.chartH * 0.42;
  let tooltipY =
    markerY < centerBandBottom ? markerY + 18 : markerY - tooltipH - 6;

  tooltipY = Math.max(
    layout.padTop + 6,
    Math.min(tooltipY, layout.padTop + layout.chartH - tooltipH - 6),
  );

  return { markerX, markerY, tooltipX, tooltipY };
}

/**
 * @deprecated Permanent markers crowded the chart — kept as no-op so old imports don't break.
 */
export function ChartTradeMarkers(_props: ChartTradeOverlaysProps) {
  return null;
}

export function ChartTradeOverlays({ tradeTags, candles, layoutRef }: ChartTradeOverlaysProps) {
  const [activeTag, setActiveTag] = useState<TradeTag | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [position, setPosition] = useState<OverlayPosition | null>(null);
  const lastSeenIdRef = useRef(-1);
  const queueRef = useRef<TradeTag[]>([]);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showingRef = useRef(false);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const clearTimers = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    hideTimerRef.current = null;
    fadeTimerRef.current = null;
  };

  const showTag = (tag: TradeTag) => {
    lastSeenIdRef.current = Math.max(lastSeenIdRef.current, tag.id);
    showingRef.current = true;
    setActiveTag(tag);
    setOpacity(1);
    const layout = layoutRef.current;
    if (layout) {
      setPosition(computePosition(layout, candlesRef.current, tag));
    }
    clearTimers();
    fadeTimerRef.current = setTimeout(() => setOpacity(0), FADE_START_MS);
    hideTimerRef.current = setTimeout(() => {
      setActiveTag(null);
      setPosition(null);
      setOpacity(1);
      showingRef.current = false;
      const next = queueRef.current.shift();
      if (next) showTag(next);
    }, TOOLTIP_TTL_MS);
  };

  useEffect(() => {
    if (tradeTags.length === 0) return;
    const latest = tradeTags[tradeTags.length - 1];
    if (lastSeenIdRef.current === -1) {
      lastSeenIdRef.current = latest.id;
      return;
    }
    const fresh = tradeTags.filter(t => t.id > lastSeenIdRef.current);
    if (fresh.length === 0) return;
    lastSeenIdRef.current = fresh[fresh.length - 1].id;

    // Prefer the newest events; keep queue short so chart stays clean.
    const incoming = fresh.slice(-3);
    if (!showingRef.current) {
      const [first, ...rest] = incoming;
      queueRef.current = rest;
      showTag(first);
    } else {
      queueRef.current = [...queueRef.current, ...incoming].slice(-4);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showTag resets timers only
  }, [tradeTags]);

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!activeTag) return;
    let raf = 0;
    let lastPaint = 0;

    const tick = (now: number) => {
      const layout = layoutRef.current;
      if (layout && activeTag) {
        if (now - lastPaint > 32) {
          lastPaint = now;
          setPosition(computePosition(layout, candlesRef.current, activeTag));
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeTag, layoutRef]);

  if (!activeTag || !position) return null;

  const { markerX, markerY, tooltipX, tooltipY } = position;
  const isBuy = activeTag.side === 'buy';

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
      <AnimatePresence>
        <motion.div
          key={activeTag.id}
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: markerX, top: markerY }}
          >
            <TradeIcon isBuy={isBuy} />
          </div>
          <div className="absolute" style={{ left: tooltipX, top: tooltipY }}>
            <motion.div
              initial={{ scale: 0.88, y: 6 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <TradeTooltip tag={activeTag} />
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
