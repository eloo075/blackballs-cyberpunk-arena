/**
 * Demo-with-real-rewards helpers.
 * Credits are play-money. Leaderboard points are computed from settled rounds
 * with a per-period cap so grinding volume cannot dominate skill.
 */

export const SCORED_ROUNDS_CAP = 40;
export const MAX_ROUND_SCORE = 100;
export const PERIOD_POINTS_CAP = SCORED_ROUNDS_CAP * MAX_ROUND_SCORE;

export type SettledRoundScoreInput = {
  stake: number;
  pnl: number;
  won: boolean;
};

export function normalizeWalletAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.startsWith('0x') && trimmed.length === 42) return trimmed.toLowerCase();
  return trimmed;
}

export function isEvmWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export function shortenWallet(address: string): string {
  const a = address.trim();
  if (a.startsWith('0x') && a.length >= 10) return `${a.slice(0, 6)}…${a.slice(-4)}`;
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** ISO week id in UTC, e.g. 2026-W34. Weeks start Monday 00:00 UTC. */
export function isoWeekPeriodId(at: Date = new Date()): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isoWeekBounds(periodId: string): { startsAt: Date; endsAt: Date } {
  const match = /^(\d{4})-W(\d{2})$/.exec(periodId);
  if (!match) {
    const now = new Date();
    return isoWeekBounds(isoWeekPeriodId(now));
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  monday.setUTCHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  return { startsAt: monday, endsAt: nextMonday };
}

/**
 * Skill-ish round score: only winning ROI counts, 2x cash-out ≈ 50 pts, 3x+ caps at 100.
 * Losing rounds score 0 so volume-of-losses cannot farm the board.
 */
export function scoreSettledRound(input: SettledRoundScoreInput): number {
  const stake = Number(input.stake);
  const pnl = Number(input.pnl);
  if (!Number.isFinite(stake) || stake <= 0) return 0;
  if (!input.won || !Number.isFinite(pnl) || pnl <= 0) return 0;
  const roi = pnl / stake;
  return Math.max(0, Math.min(MAX_ROUND_SCORE, Math.round(roi * 50 * 1000) / 1000));
}

/** Sum the best N round scores, then apply the hard period cap. */
export function capPeriodPoints(roundScores: number[]): {
  points: number;
  scoredRounds: number;
} {
  const best = [...roundScores]
    .filter(s => Number.isFinite(s) && s > 0)
    .sort((a, b) => b - a)
    .slice(0, SCORED_ROUNDS_CAP);
  const raw = best.reduce((sum, s) => sum + s, 0);
  return {
    points: Math.min(PERIOD_POINTS_CAP, Math.round(raw * 1000) / 1000),
    scoredRounds: best.length,
  };
}

export function msUntil(iso: string | Date, now = Date.now()): number {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t - now);
}
