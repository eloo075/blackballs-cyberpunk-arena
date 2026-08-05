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
    const paths = Array.from({ length: 30 }, (_, i) => {
      const gameId = 3000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId).path;
    });
    const prices = paths.flatMap(path => path.slice(0, -1).map(tick => tick.price));

    expect(prices.some(price => price < 1)).toBe(true);
    expect(
      paths.some(path =>
        path.slice(1, -1).some((tick, i) => tick.price < (path[i]?.price ?? tick.price)),
      ),
    ).toBe(true);
    expect(paths.every(path => path[path.length - 1]?.price === 0.01)).toBe(true);
  });

  it('keeps average round duration in the longer 45–60 second target', () => {
    const durations = Array.from({ length: 500 }, (_, i) => {
      const gameId = 5000 + i;
      const result = generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
      return result.rugTick * 0.25;
    });
    const average = durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length;

    expect(average).toBeGreaterThanOrEqual(45);
    expect(average).toBeLessThanOrEqual(60);
    expect(Math.max(...durations)).toBeLessThanOrEqual(180);
  });
});
