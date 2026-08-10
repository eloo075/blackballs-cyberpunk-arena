import type { Candle } from '@/lib/crash-types';

const SPARK_POINTS = 24;

/** Downsample round candles into a compact close-price sparkline for Last-100 thumbs. */
export function downsampleCandlesToSpark(candles: Candle[], points = SPARK_POINTS): number[] {
  if (!candles.length) return [1];
  if (candles.length <= points) {
    return candles.map(c => Math.max(0.01, c.c));
  }
  const out: number[] = [];
  const last = candles.length - 1;
  for (let i = 0; i < points; i++) {
    const idx = Math.round((i / (points - 1)) * last);
    out.push(Math.max(0.01, candles[idx].c));
  }
  // Ensure the final point reflects the last candle close (crash / peak)
  out[out.length - 1] = Math.max(0.01, candles[last].c);
  return out;
}

/**
 * Deterministic synthetic path for seeded / legacy history that has no candles.
 * Climbs toward crashPoint then rugs — enough shape for a mini thumbnail.
 */
export function synthesizeSparkline(crashPoint: number, seed: number, points = SPARK_POINTS): number[] {
  const rug = crashPoint <= 1.02;
  const peak = rug ? Math.max(1.05, 1 + ((seed % 17) / 100)) : Math.max(crashPoint, 1.05);
  const out: number[] = [];
  let s = (seed * 2654435761) >>> 0;

  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };

  const climbEnd = rug ? Math.max(4, Math.floor(points * 0.45)) : Math.max(6, points - 3);

  for (let i = 0; i < points; i++) {
    if (i === 0) {
      out.push(1);
      continue;
    }
    if (i >= climbEnd) {
      // Final stretch: settle on crash / peak then dump if rug
      if (i === points - 1) {
        out.push(Math.max(0.01, crashPoint));
      } else if (rug && i >= points - 2) {
        out.push(Math.max(0.05, peak * (0.15 + rand() * 0.1)));
      } else {
        const t = (i - climbEnd) / Math.max(1, points - 1 - climbEnd);
        out.push(peak * (1 - t * 0.08) + (rand() - 0.5) * 0.02 * peak);
      }
      continue;
    }
    const t = i / climbEnd;
    const ease = t * t * (3 - 2 * t);
    const noise = (rand() - 0.48) * 0.04 * (1 + t * 2);
    out.push(Math.max(0.05, 1 + (peak - 1) * ease + noise));
  }

  out[out.length - 1] = Math.max(0.01, crashPoint);
  return out.map(v => Math.round(v * 1000) / 1000);
}

export function sparkForRound(opts: {
  sparkline?: number[] | null;
  crashPoint: number;
  id: number;
}): number[] {
  if (opts.sparkline && opts.sparkline.length >= 3) return opts.sparkline;
  return synthesizeSparkline(opts.crashPoint, opts.id);
}
