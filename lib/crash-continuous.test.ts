import { describe, expect, it } from 'vitest';
import {
  CONTINUOUS_MAX_ROUND_TICKS,
  CONTINUOUS_MIN_ROUND_TICKS,
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
    const paths = Array.from({ length: 50 }, (_, i) => {
      const gameId = 7000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId).path;
    });

    for (const path of paths) {
      expect(path.every(tick => tick.price >= CONTINUOUS_PRICE_FLOOR - 1e-9)).toBe(true);
      let lowStreak = 0;
      for (const tick of path) {
        if (tick.price < 0.55) lowStreak += 1;
        else lowStreak = 0;
        expect(lowStreak).toBeLessThanOrEqual(56);
      }
    }
  });

  it('balances up and down with varied peaks (not a 25x wall)', () => {
    const samples = Array.from({ length: 180 }, (_, i) => {
      const gameId = 9000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
    });
    const peaks = samples.map(s => s.peakMultiplier).sort((a, b) => a - b);
    const median = peaks[Math.floor(peaks.length / 2)]!;
    const ceilingHits = peaks.filter(p => p >= 24.5).length;
    const oscillating = samples.filter(s => {
      const prices = s.path.map(t => t.price);
      let ups = 0;
      let downs = 0;
      for (let i = 1; i < Math.min(prices.length, 120); i++) {
        if (prices[i]! > prices[i - 1]!) ups += 1;
        if (prices[i]! < prices[i - 1]!) downs += 1;
      }
      return ups >= 10 && downs >= 10;
    }).length;

    expect(oscillating).toBeGreaterThanOrEqual(120);
    expect(median).toBeLessThan(12);
    expect(ceilingHits / peaks.length).toBeLessThan(0.15);
    expect(peaks.some(p => p >= 5)).toBe(true);
  }, 20_000);

  it('targets ~1.5 minute average rounds (still 12s–3min range)', () => {
    const durations = Array.from({ length: 300 }, (_, i) => {
      const gameId = 5000 + i;
      const result = generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
      expect(result.rugTick).toBeGreaterThanOrEqual(CONTINUOUS_MIN_ROUND_TICKS);
      expect(result.rugTick).toBeLessThanOrEqual(CONTINUOUS_MAX_ROUND_TICKS);
      return result.rugTick * 0.25;
    });
    const average = durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length;
    const shortCount = durations.filter(s => s <= 45).length;
    const longCount = durations.filter(s => s >= 140).length;

    expect(average).toBeGreaterThanOrEqual(70);
    expect(average).toBeLessThanOrEqual(110);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...durations)).toBeLessThanOrEqual(180);
    expect(shortCount).toBeGreaterThanOrEqual(15);
    expect(longCount).toBeGreaterThanOrEqual(20);
  }, 25_000);
});
