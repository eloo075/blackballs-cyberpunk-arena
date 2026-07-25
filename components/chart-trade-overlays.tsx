'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Candle, TradeTag } from '@/lib/crash-types';
import type { ChartLayoutFrame } from '@/lib/chart-layout';
import { markerXForCandle, priceToY, resolveCandleIndex } from '@/lib/chart-layout';

const TOOLTIP_TTL_MS = 1750;
const FADE_START_MS = 1200;

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

function TradeAvatar({ player }: { player: string }) {
  const hue = player.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-5 h-5 rounded-full shrink-0 border border-white/15 flex items-center justify-center text-[8px] font-extrabold text-white/80 overflow-hidden"
      style={{ background: `hsl(${hue} 22% 34%)` }}
      aria-hidden
    >
      {player.slice(0, 2).toUpperCase()}
    </div>
  );
}

function TradeMarker({ isBuy }: { isBuy: boolean }) {
  return (
    <div
      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 border-2 shadow-md ${
        isBuy
          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
          : 'bg-orange-500/20 border-orange-400 text-orange-200'
      }`}
      aria-hidden
    >
      {isBuy ? '🚀' : '🐻'}
    </div>
  );
}

function TradeTooltip({ tag }: { tag: TradeTag }) {
  const isBuy = tag.side === 'buy';
  const actionLabel = isBuy
    ? `Buy +${tag.amount.toFixed(3)}`
    : `Sell -${tag.amount.toFixed(3)}`;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 shadow-lg backdrop-blur-sm font-arcade min-w-0 max-w-[148px] ${
        isBuy
          ? 'bg-[#141518]/95 border-emerald-500/50'
          : 'bg-[#141518]/95 border-orange-500/50'
      }`}
    >
      <TradeAvatar player={tag.user} />
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-extrabold text-white/75 truncate leading-tight">{tag.user}</div>
        <div
          className={`text-[10px] font-extrabold leading-tight tabular-nums ${
            isBuy ? 'text-emerald-400' : 'text-orange-400'
          }`}
        >
          {actionLabel}
        </div>
      </div>
    </div>
  );
}

function ConnectorLine({
  x1,
  y1,
  x2,
  y2,
  isBuy,
  opacity,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isBuy: boolean;
  opacity: number;
}) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      style={{ opacity }}
      aria-hidden
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isBuy ? 'rgba(34,197,94,0.45)' : 'rgba(251,146,60,0.45)'}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
    </svg>
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
  const tooltipW = 138;
  const tooltipH = 36;

  let tooltipX = markerX - tooltipW - 18;
  if (tooltipX < layout.padLeft + 6) {
    tooltipX = Math.min(markerX + 18, layout.padLeft + layout.chartW - tooltipW - 6);
  }

  const centerBandBottom = layout.padTop + layout.chartH * 0.42;
  let tooltipY =
    markerY < centerBandBottom
      ? markerY + 24
      : markerY - tooltipH - 8;

  tooltipY = Math.max(
    layout.padTop + 6,
    Math.min(tooltipY, layout.padTop + layout.chartH - tooltipH - 6),
  );

  return { markerX, markerY, tooltipX, tooltipY };
}

export function ChartTradeOverlays({ tradeTags, candles, layoutRef }: ChartTradeOverlaysProps) {
  const [activeTag, setActiveTag] = useState<TradeTag | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [position, setPosition] = useState<OverlayPosition | null>(null);
  const lastSeenIdRef = useRef(-1);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const clearTimers = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    hideTimerRef.current = null;
    fadeTimerRef.current = null;
  };

  const showTag = (tag: TradeTag) => {
    lastSeenIdRef.current = tag.id;
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
    }, TOOLTIP_TTL_MS);
  };

  useEffect(() => {
    if (tradeTags.length === 0) return;
    const latest = tradeTags[tradeTags.length - 1];
    if (lastSeenIdRef.current === -1) {
      lastSeenIdRef.current = latest.id;
      return;
    }
    if (latest.id <= lastSeenIdRef.current) return;
    showTag(latest);
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

  const isBuy = activeTag.side === 'buy';
  const { markerX, markerY, tooltipX, tooltipY } = position;
  const tooltipH = 36;
  const lineX2 = tooltipX + 138;
  const lineY2 = tooltipY + tooltipH / 2;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
      <AnimatePresence>
        <motion.div
          key={activeTag.id}
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <ConnectorLine
            x1={markerX}
            y1={markerY}
            x2={lineX2}
            y2={lineY2}
            isBuy={isBuy}
            opacity={opacity * 0.85}
          />
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: markerX, top: markerY }}
          >
            <TradeMarker isBuy={isBuy} />
          </div>
          <div className="absolute" style={{ left: tooltipX, top: tooltipY }}>
            <motion.div
              initial={{ scale: 0.88, x: 8 }}
              animate={{ scale: 1, x: 0 }}
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
