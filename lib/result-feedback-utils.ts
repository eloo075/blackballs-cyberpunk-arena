import { CURRENCY_LABEL } from '@/lib/format-currency';

export type ResultIntensity = 'normal' | 'big' | 'mega';

export interface ResultFeedbackEvent {
  id: string;
  won: boolean;
  amount: number;
  subtitle?: string;
  intensity: ResultIntensity;
}

export interface ResultFeedbackInput {
  won: boolean;
  amount: number;
  subtitle?: string;
  multiplier?: number;
  intensity?: ResultIntensity;
}

export function computeResultIntensity(amount: number, multiplier?: number): ResultIntensity {
  const abs = Math.abs(amount);
  if (abs >= 50 || (multiplier != null && multiplier >= 10)) return 'mega';
  if (abs >= 10 || (multiplier != null && multiplier >= 3)) return 'big';
  return 'normal';
}

export function winDurationMs(intensity: ResultIntensity): number {
  if (intensity === 'mega') return 2500;
  if (intensity === 'big') return 2200;
  return 2000;
}

export function lossDurationMs(): number {
  return 1400;
}

export function formatResultAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${amount.toFixed(2)} ${CURRENCY_LABEL}`;
}

/** Deterministic pseudo-random for stable particle layouts per event id. */
export function particleSeed(id: string, index: number): number {
  let h = 0;
  const s = `${id}-${index}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
