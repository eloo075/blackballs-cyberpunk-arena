import { describe, expect, it } from 'vitest';
import {
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

  it('can moon well above 2x and sometimes past 10x across seeds', () => {
    const peaks = Array.from({ length: 200 }, (_, i) => {
      const gameId = 9000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId)
        .peakMultiplier;
    });
    expect(peaks.some(p => p >= 3)).toBe(true);
    expect(peaks.some(p => p >= 10)).toBe(true);
    expect(Math.max(...peaks)).toBeGreaterThanOrEqual(10);
  });

  it('keeps average base rug duration in a playable window', () => {
    const durations = Array.from({ length: 200 }, (_, i) => {
      const gameId = 5000 + i;
      const result = generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
      return result.rugTick * 0.25;
    });
    const average = durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length;

    expect(average).toBeGreaterThanOrEqual(35);
    expect(average).toBeLessThanOrEqual(90);
    expect(Math.max(...durations)).toBeLessThanOrEqual(240);
  }, 15_000);
});
