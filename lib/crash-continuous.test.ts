import { describe, expect, it } from 'vitest';
import {
  CONTINUOUS_PRICE_FLOOR,
  deriveServerSeedForGameId,
  generateContinuousRoundPath,
  hashServerSeed,
  verifyContinuousCrashRound,
} from './crash-engine';

describe('Demo continuous Crash engine', () => {
  it('reproduces the exact path and rug tick from the committed seed', () => {
    const gameId = 2048;
    const seed = deriveServerSeedForGameId(gameId);
    const a = generateContinuousRoundPath(seed, gameId);
    const b = generateContinuousRoundPath(seed, gameId);

    expect(a).toEqual(b);
    expect(
      verifyContinuousCrashRound({
        serverSeed: seed,
        serverSeedHash: hashServerSeed(seed),
        nonce: gameId,
        expectedPeak: a.peakMultiplier,
        expectedRugTick: a.rugTick,
      }).valid,
    ).toBe(true);
  });

  it('produces down candles and prices below 1.0 before the hard rug', () => {
    const paths = Array.from({ length: 40 }, (_, i) => {
      const gameId = 3000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId).path;
    });
    const prices = paths.flatMap(path => path.map(tick => tick.price));

    expect(prices.some(price => price < 1)).toBe(true);
    expect(
      paths.some(path =>
        path.slice(1).some((tick, i) => tick.price < (path[i]?.price ?? tick.price)),
      ),
    ).toBe(true);
    const deepDipRounds = paths.filter(path =>
      path.some(tick => tick.price <= 0.75),
    ).length;
    expect(deepDipRounds).toBeGreaterThanOrEqual(8);
  });

  it('never flatlines under the live floor for long stretches', () => {
    const paths = Array.from({ length: 80 }, (_, i) => {
      const gameId = 7000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId).path;
    });

    for (const path of paths) {
      expect(path.every(tick => tick.price >= CONTINUOUS_PRICE_FLOOR - 1e-9)).toBe(true);
      let lowStreak = 0;
      for (const tick of path) {
        if (tick.price < 0.5) lowStreak += 1;
        else lowStreak = 0;
        // 4s candles × ~8 = 32 ticks max near-floor crawl
        expect(lowStreak).toBeLessThanOrEqual(40);
      }
    }
  });

  it('swings up and down and can peak toward 15x across seeds', () => {
    const samples = Array.from({ length: 250 }, (_, i) => {
      const gameId = 9000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
    });
    const peaks = samples.map(s => s.peakMultiplier);
    const oscillating = samples.filter(s => {
      const prices = s.path.map(t => t.price);
      let ups = 0;
      let downs = 0;
      for (let i = 1; i < prices.length; i++) {
        if (prices[i]! > prices[i - 1]!) ups += 1;
        if (prices[i]! < prices[i - 1]!) downs += 1;
      }
      return ups >= 8 && downs >= 8;
    }).length;

    expect(oscillating).toBeGreaterThanOrEqual(180);
    expect(peaks.some(p => p >= 3)).toBe(true);
    expect(peaks.some(p => p >= 10)).toBe(true);
    expect(Math.max(...peaks)).toBeGreaterThanOrEqual(15);
  });

  it('keeps average base rug duration snappy (not multi-minute)', () => {
    const durations = Array.from({ length: 200 }, (_, i) => {
      const gameId = 5000 + i;
      const result = generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
      return result.rugTick * 0.25;
    });
    const average = durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length;

    expect(average).toBeGreaterThanOrEqual(20);
    expect(average).toBeLessThanOrEqual(55);
    expect(Math.max(...durations)).toBeLessThanOrEqual(90);
  }, 15_000);
});
