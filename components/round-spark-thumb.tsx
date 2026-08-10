'use client';

import { useMemo } from 'react';
import { CRASH_TIER_COLOR, crashTier } from '@/lib/crash-engine';
import { sparkForRound } from '@/lib/round-sparkline';
import type { RoundSummary } from '@/lib/crash-types';

const W = 72;
const H = 44;
const PAD = 3;

/**
 * rugs.fun-style mini chart thumb: tiny path of the round + multiplier badge.
 */
export function RoundSparkThumb({ round }: { round: RoundSummary }) {
  const tier = crashTier(round.crashPoint);
  const color = CRASH_TIER_COLOR[tier];
  const isRug = round.crashPoint <= 1.02;

  const { line, area, candles } = useMemo(() => {
    const pts = sparkForRound({
      sparkline: round.sparkline,
      crashPoint: round.crashPoint,
      id: round.id,
    });
    const min = Math.min(...pts);
    const max = Math.max(...pts, min + 0.05);
    const span = max - min || 1;
    const n = pts.length;
    const coords = pts.map((p, i) => {
      const x = PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2);
      const y = PAD + (1 - (p - min) / span) * (H - PAD * 2);
      return { x, y, p };
    });

    const lineD = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');
    const areaD = `${lineD} L${coords[coords.length - 1].x.toFixed(1)},${H - 1} L${coords[0].x.toFixed(1)},${H - 1} Z`;

    // Mini candle bodies from consecutive closes
    const candleRects = coords.slice(0, -1).map((c, i) => {
      const next = coords[i + 1];
      const up = next.p >= c.p;
      const bodyTop = Math.min(c.y, next.y);
      const bodyH = Math.max(1.2, Math.abs(next.y - c.y));
      const slotW = (W - PAD * 2) / Math.max(1, n - 1);
      const bw = Math.max(1.6, Math.min(3.2, slotW * 0.55));
      return {
        x: c.x + slotW * 0.5 - bw / 2,
        y: bodyTop,
        w: bw,
        h: bodyH,
        up,
        wickX: c.x + slotW * 0.5,
        wickY1: Math.min(c.y, next.y) - 0.8,
        wickY2: Math.max(c.y, next.y) + 0.8,
      };
    });

    return { line: lineD, area: areaD, candles: candleRects };
  }, [round.sparkline, round.crashPoint, round.id]);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0c0e12]"
      style={{ width: W, height: H }}
      title={`Round #${round.id} · ${round.crashPoint.toFixed(2)}x · ${tier.toUpperCase()}`}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id={`spark-fill-${round.id}-${round.ts}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#spark-fill-${round.id}-${round.ts})`} />
        {candles.map((c, i) => (
          <g key={i}>
            <line
              x1={c.wickX}
              y1={c.wickY1}
              x2={c.wickX}
              y2={c.wickY2}
              stroke={c.up ? '#22c55e' : '#ef4444'}
              strokeWidth={0.7}
              opacity={0.55}
            />
            <rect
              x={c.x}
              y={c.y}
              width={c.w}
              height={c.h}
              rx={0.4}
              fill={c.up ? '#22c55e' : '#ef4444'}
              opacity={0.85}
            />
          </g>
        ))}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      </svg>
      <div
        className={`absolute bottom-0.5 right-0.5 px-1 py-[1px] rounded text-[9px] font-black tabular-nums leading-none shadow-sm ${
          isRug ? 'bg-rose-500/90 text-white' : 'bg-black/75 text-white'
        }`}
        style={!isRug ? { color } : undefined}
      >
        {round.crashPoint.toFixed(2)}x
      </div>
    </div>
  );
}
