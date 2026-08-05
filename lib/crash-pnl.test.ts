import { describe, expect, it } from 'vitest';
import {
  calcCrashSettlement,
  calcPositionPnl,
  leveragedOpenFee,
  MAX_LEVERAGE,
} from './crash-pnl';

describe('Crash payout invariants', () => {
  const multipliers = [
    { exit: 1.01, profit5x: 5 },
    { exit: 1.1, profit5x: 50 },
    { exit: 1.39, profit5x: 195 },
    { exit: 2, profit5x: 500 },
  ];

  it.each(multipliers)(
    'uses linear PnL at 5x and $exit',
    ({ exit, profit5x }) => {
      const settlement = calcCrashSettlement({
        side: 'buy',
        margin: 100,
        leverage: 5,
        entry: 1,
        exit,
      });

      expect(settlement.pnl).toBe(profit5x);
      expect(settlement.bonus).toBe(0);
      expect(settlement.returnAmount).toBe(100 + profit5x);
    },
  );

  it.each(multipliers)(
    'stays linear at 10x even though entries above the 5x server cap are rejected',
    ({ exit }) => {
      const expected = Math.round(100 * 10 * (exit - 1) * 1000) / 1000;
      expect(calcPositionPnl('buy', 100, 10, 1, exit)).toBe(expected);
      expect(MAX_LEVERAGE).toBe(5);
    },
  );

  it('applies the 2% leveraged-notional fee once and prevents 1.01x scalping', () => {
    const startingBalance = 200;
    const margin = 100;
    const fee = leveragedOpenFee(margin, 5);
    const settlement = calcCrashSettlement({
      side: 'buy',
      margin,
      leverage: 5,
      entry: 1,
      exit: 1.01,
    });
    const endingBalance = startingBalance - margin - fee + settlement.returnAmount;

    expect(fee).toBe(10);
    expect(endingBalance).toBe(195);
    expect(endingBalance).toBeLessThan(startingBalance);
    expect(leveragedOpenFee(margin, 1)).toBe(0);
  });

  it('bonuses use positive profit only and clamp malicious client rates', () => {
    const settlement = calcCrashSettlement({
      side: 'buy',
      margin: 100,
      leverage: 5,
      entry: 1,
      exit: 1.1,
      stimmy: 1e12,
      frenzy: 1e12,
      random: () => 0,
    });

    // Legitimate hard maxima are 50% Stimmy + 15% Frenzy, applied to 50 profit.
    expect(settlement.pnl).toBe(50);
    expect(settlement.bonus).toBe(32.5);
    expect(settlement.returnAmount).toBe(182.5);
    expect(settlement.returnAmount).toBeLessThan(1_000);
  });

  it('fails closed for non-finite inputs', () => {
    expect(calcPositionPnl('buy', 100, Number.POSITIVE_INFINITY, 1, 1.3)).toBe(-100);
    expect(
      calcCrashSettlement({
        side: 'buy',
        margin: Number.POSITIVE_INFINITY,
        leverage: 5,
        entry: 1,
        exit: 1.3,
      }),
    ).toEqual({
      pnl: 0,
      baseProfit: 0,
      bonus: 0,
      frenzyProc: false,
      returnAmount: 0,
    });
  });
});
