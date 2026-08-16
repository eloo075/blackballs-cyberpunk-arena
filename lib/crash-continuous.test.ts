import { describe, expect, it } from 'vitest';
import {
  CONTINUOUS_MAX_ROUND_TICKS,
  CONTINUOUS_PRICE_FLOOR,
  CONTINUOUS_RUG_IMPACT,
  CONTINUOUS_RUG_PROB,
  deriveServerSeedForGameId,
  generateContinuousRoundPath,
  hashServerSeed,
  verifyContinuousCrashRound,
} from './crash-engine';

describe('Demo continuous Crash engine (rugs.fun Standard)', () => {
  it('reproduces the exact path and rug tick from serverSeed-gameId', () => {
    const gameId = 2048;
    const seed = deriveServerSeedForGameId(gameId);
    const a = generateContinuousRoundPath(seed, gameId);
    const b = generateContinuousRoundPath(seed, gameId);

    expect(a).toEqual(b);
    expect(a.rugTick).toBeGreaterThanOrEqual(1);
    expect(a.rugTick).toBeLessThanOrEqual(CONTINUOUS_MAX_ROUND_TICKS);
    expect(a.path[a.rugTick]?.price).toBeLessThan(a.peakMultiplier);
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

  it('rugs with ~98% impact and can trade under 1.0x before the rug', () => {
    const samples = Array.from({ length: 80 }, (_, i) => {
      const gameId = 3000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
    });

    const underOne = samples.some(s =>
      s.path.slice(0, s.rugTick).some(tick => tick.price < 1),
    );
    expect(underOne).toBe(true);

    for (const s of samples) {
      const preRug = s.path[s.rugTick - 1]?.price;
      const rugPrice = s.path[s.rugTick]?.price;
      expect(preRug).toBeDefined();
      expect(rugPrice).toBeDefined();
      if (
        preRug &&
        rugPrice &&
        preRug * (1 - CONTINUOUS_RUG_IMPACT) > CONTINUOUS_PRICE_FLOOR + 1e-9
      ) {
        const ratio = rugPrice / preRug;
        expect(ratio).toBeCloseTo(1 - CONTINUOUS_RUG_IMPACT, 2);
      }
      expect(s.path.every(tick => tick.price >= CONTINUOUS_PRICE_FLOOR - 1e-9)).toBe(true);
    }
  });

  it('rugs on a ranging schedule (base hazard + ramp, ~60–75s mean, 2.25min cap)', () => {
    const durations = Array.from({ length: 400 }, (_, i) => {
      const gameId = 5000 + i;
      const result = generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
      return result.rugTick * 0.25;
    });
    const average = durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length;
    // Escalating hazard → mean ~40s; almost nothing hits the 2.25min wall
    expect(average).toBeGreaterThanOrEqual(50);
    expect(average).toBeLessThanOrEqual(80);
    expect(Math.max(...durations)).toBeLessThanOrEqual(CONTINUOUS_MAX_ROUND_TICKS * 0.25 + 0.01);
    expect(CONTINUOUS_RUG_PROB).toBe(0.0025);
    expect(CONTINUOUS_MAX_ROUND_TICKS).toBe(540);
  }, 25_000);

  it('keeps frozen v2 and v3 paths verifiable after v4 retune', () => {
    const gameId = 2048;
    const seed = deriveServerSeedForGameId(gameId);
    const v2 = generateContinuousRoundPath(seed, gameId, 250, 'v2');
    const v3 = generateContinuousRoundPath(seed, gameId, 250, 'v3');
    const live = generateContinuousRoundPath(seed, gameId, 250, 'v4');
    expect(v2).not.toEqual(live);
    expect(v3).not.toEqual(live);
    expect(
      verifyContinuousCrashRound({
        serverSeed: seed,
        serverSeedHash: hashServerSeed(seed),
        nonce: gameId,
        expectedPeak: v2.peakMultiplier,
        expectedRugTick: v2.rugTick,
      }).valid,
    ).toBe(true);
    expect(
      verifyContinuousCrashRound({
        serverSeed: seed,
        serverSeedHash: hashServerSeed(seed),
        nonce: gameId,
        expectedPeak: v3.peakMultiplier,
        expectedRugTick: v3.rugTick,
      }).valid,
    ).toBe(true);
  });

  it('oscillates with varied peaks (not a flat pump)', () => {
    const samples = Array.from({ length: 120 }, (_, i) => {
      const gameId = 9000 + i;
      return generateContinuousRoundPath(deriveServerSeedForGameId(gameId), gameId);
    });
    const peaks = samples.map(s => s.peakMultiplier).sort((a, b) => a - b);
    const oscillating = samples.filter(s => {
      const prices = s.path.slice(0, s.rugTick).map(t => t.price);
      let ups = 0;
      let downs = 0;
      for (let i = 1; i < prices.length; i++) {
        if (prices[i]! > prices[i - 1]!) ups += 1;
        if (prices[i]! < prices[i - 1]!) downs += 1;
      }
      return ups >= 3 && downs >= 3;
    }).length;

    expect(oscillating).toBeGreaterThanOrEqual(60);
    expect(peaks.some(p => p >= 2)).toBe(true);
    expect(peaks[Math.floor(peaks.length / 2)]!).toBeLessThan(20);
  }, 20_000);
});
