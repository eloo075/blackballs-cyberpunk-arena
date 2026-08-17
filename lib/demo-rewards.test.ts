import { describe, expect, it } from 'vitest';
import {
  capPeriodPoints,
  isoWeekBounds,
  isoWeekPeriodId,
  MAX_ROUND_SCORE,
  normalizeWalletAddress,
  PERIOD_POINTS_CAP,
  scoreSettledRound,
  SCORED_ROUNDS_CAP,
} from './demo-rewards';
import { normalizeDemoSessionBalance } from './session-balance';

describe('demo-rewards scoring', () => {
  it('scores winning ROI and ignores losses', () => {
    expect(scoreSettledRound({ stake: 100, pnl: 100, won: true })).toBe(50);
    expect(scoreSettledRound({ stake: 100, pnl: 200, won: true })).toBe(100);
    expect(scoreSettledRound({ stake: 100, pnl: 400, won: true })).toBe(MAX_ROUND_SCORE);
    expect(scoreSettledRound({ stake: 100, pnl: -100, won: false })).toBe(0);
    expect(scoreSettledRound({ stake: 100, pnl: 50, won: false })).toBe(0);
  });

  it('ranks on best N rounds, not raw volume', () => {
    const grinder = capPeriodPoints(Array.from({ length: 400 }, () => 10));
    const skilled = capPeriodPoints([100, 100, 100, 100, 100]);
    expect(grinder.scoredRounds).toBe(SCORED_ROUNDS_CAP);
    expect(grinder.points).toBe(SCORED_ROUNDS_CAP * 10);
    expect(skilled.points).toBe(500);
    expect(skilled.points).toBeGreaterThan(grinder.points);
    expect(grinder.points).toBeLessThanOrEqual(PERIOD_POINTS_CAP);
  });

  it('hard-caps period points', () => {
    const maxed = capPeriodPoints(Array.from({ length: 200 }, () => MAX_ROUND_SCORE));
    expect(maxed.points).toBe(PERIOD_POINTS_CAP);
    expect(maxed.scoredRounds).toBe(SCORED_ROUNDS_CAP);
  });

  it('never auto-mints credits from a client-reported 0', () => {
    expect(
      normalizeDemoSessionBalance('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 0, true, {
        allowRefill: true,
      }),
    ).toBe(0);
    expect(
      normalizeDemoSessionBalance('demo-local', 0, false, { allowRefill: true }),
    ).toBe(0);
  });

  it('normalizes EVM wallets and keeps ISO weeks stable', () => {
    expect(normalizeWalletAddress('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD')).toBe(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    );
    const id = isoWeekPeriodId(new Date('2026-08-17T15:00:00Z'));
    expect(id).toMatch(/^2026-W\d{2}$/);
    const bounds = isoWeekBounds(id);
    expect(bounds.endsAt.getTime() - bounds.startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(bounds.startsAt.getUTCDay()).toBe(1);
  });
});
