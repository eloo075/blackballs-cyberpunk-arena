import { describe, expect, it } from 'vitest';
import {
  calcCrashSettlement,
  calcLotsPnl,
  calcPositionPnl,
  isLeveragedExitAllowed,
  leveragedOpenFee,
  MAX_LEVERAGE,
  minExitMultiplierRatio,
  netLeveragedProfit,
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
      expect(settlement.openFee).toBe(10);
      expect(settlement.netProfit).toBe(profit5x - 10);
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
    expect(settlement.netProfit).toBe(-5);
  });

  it('makes 5x → 1.05–1.15x scalp unprofitable or blocked', () => {
    expect(minExitMultiplierRatio(5)).toBeGreaterThanOrEqual(1.15);
    expect(isLeveragedExitAllowed('buy', 5, 1, 1.05)).toBe(false);
    expect(isLeveragedExitAllowed('buy', 5, 1, 1.1)).toBe(false);
    expect(isLeveragedExitAllowed('buy', 5, 1, 1.15)).toBe(false);
    expect(isLeveragedExitAllowed('buy', 5, 1, 1.18)).toBe(true);

    // Even if somehow settled at 1.10x, net after fee is still checked
    const netAt110 = netLeveragedProfit('buy', 100, 5, 1, 1.1);
    // 100*5*0.10 - 10 = 40 — would be profitable WITHOUT the min-exit gate
    expect(netAt110).toBe(40);
    // Gate is what stops the exploit; fee alone is not enough above 1.02x
    expect(isLeveragedExitAllowed('buy', 5, 1, 1.1)).toBe(false);
  });

  it('blocks stimmy/frenzy bonuses on early leveraged exits', () => {
    const early = calcCrashSettlement({
      side: 'buy',
      margin: 100,
      leverage: 5,
      entry: 1,
      exit: 1.18,
      stimmy: 0.5,
      frenzy: 0.15,
      random: () => 0,
    });
    expect(early.bonus).toBe(0);

    const later = calcCrashSettlement({
      side: 'buy',
      margin: 100,
      leverage: 5,
      entry: 1,
      exit: 1.25,
      stimmy: 0.5,
      frenzy: 0,
      random: () => 0,
    });
    expect(later.pnl).toBe(125);
    expect(later.bonus).toBe(62.5);
  });

  it('bonuses use positive profit only and clamp malicious client rates', () => {
    const settlement = calcCrashSettlement({
      side: 'buy',
      margin: 100,
      leverage: 5,
      entry: 1,
      exit: 1.3,
      stimmy: 1e12,
      frenzy: 1e12,
      random: () => 0,
    });

    // Legitimate hard maxima are 50% Stimmy + 15% Frenzy, applied to 150 profit.
    expect(settlement.pnl).toBe(150);
    expect(settlement.bonus).toBe(97.5);
    expect(settlement.returnAmount).toBe(347.5);
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
      openFee: 0,
      netProfit: 0,
    });
  });

  it('sums stacked lots precisely (not average-entry approx)', () => {
    // 10 @ 1.00x + 10 @ 2.00x, exit 1.50x
    // lot1: 10*(1.5-1)=5 ; lot2: 10*(1.5/2-1)=-2.5 ; total=2.5
    // avg entry 1.5 would wrongly give 0
    const lots = [
      { amount: 10, entry: 1, leverage: 1 },
      { amount: 10, entry: 2, leverage: 1 },
    ];
    expect(calcLotsPnl('buy', lots, 1.5)).toBe(2.5);
    const avgWouldBe = calcPositionPnl('buy', 20, 1, 1.5, 1.5);
    expect(avgWouldBe).toBe(0);
    expect(calcLotsPnl('buy', lots, 1.5)).not.toBe(avgWouldBe);
  });
});
