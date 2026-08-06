/**
 * Provably fair crash RNG — v6 retention curve (~3% house edge target).
 *
 * Distribution (non-instant):
 *   ~3% instant rug @ 1.00x
 *   ~15% 1.01–1.50x
 *   ~45% 1.50–4.50x  (sweet spot — frequent cash-out dopamine)
 *   ~22% 4.50–12x
 *   ~10% 12–25x
 *   ~4%  25–40x moon
 *   ~1%  40x cap
 *
 * Near-miss: deterministic sub-band snaps some 2x–4x outcomes to 1.85–1.97x.
 */
import { createHash, createHmac, randomBytes } from 'crypto';
import type { RoundSummary } from './crash-types';
import {
  hashServerSeedNormalized,
  normalizeServerSeed,
  serverSeedMatchesCommit,
} from './provably-fair-utils';

/** Target house edge (~3%). */
export const HOUSE_EDGE_PERCENT = 3;

/** Exactly 3% instant 1.00x rugs. */
export const INSTANT_RUG_RATE = 0.03;

/** Hard cap — rare moons up to 40x. */
export const MAX_CRASH_POINT = 40;

export const DEFAULT_CLIENT_SEED = 'blackballs-global';

export interface ProvablyFairInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

export interface ProvablyFairResult {
  fairHex: string;
  randomUnit: number;
  instantRug: boolean;
  crashPoint: number;
  nearMiss?: boolean;
}

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

/** Deterministic seed so every serverless instance shares the same live round. */
export function deriveServerSeedForGameId(gameId: number, clientSeed = DEFAULT_CLIENT_SEED): string {
  return createHash('sha256').update(`bb-history-v6:${clientSeed}:${gameId}`).digest('hex');
}

export function hashServerSeed(seed: string): string {
  return hashServerSeedNormalized(seed);
}

export function deriveFairHex(serverSeed: string, clientSeed: string, nonce: number): string {
  return createHmac('sha256', normalizeServerSeed(serverSeed))
    .update(`${clientSeed.trim()}:${nonce}`)
    .digest('hex');
}

export function hexToUnitFloat(hex: string): number {
  const slice = hex.slice(0, 13);
  const value = parseInt(slice, 16);
  if (!Number.isFinite(value)) return 0;
  return value / Math.pow(2, 52);
}

/** Deterministic near-miss roll from normalized t (same seed → same result). */
function nearMissRoll(t: number): number {
  const x = Math.sin(t * 12_989.987 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

export function crashPointFromRandom(
  randomUnit: number,
  _houseEdgePercent = HOUSE_EDGE_PERCENT,
): { crashPoint: number; instantRug: boolean; nearMiss?: boolean } {
  const r = Math.min(Math.max(randomUnit, 0), 1 - 1e-12);

  if (r < INSTANT_RUG_RATE) {
    return { crashPoint: 1.0, instantRug: true };
  }

  const t = (r - INSTANT_RUG_RATE) / (1 - INSTANT_RUG_RATE);

  let mult: number;
  if (t < 0.15) {
    mult = 1.01 + 0.49 * Math.pow(t / 0.15, 0.78);
  } else if (t < 0.6) {
    mult = 1.5 + 3.0 * Math.pow((t - 0.15) / 0.45, 0.82);
  } else if (t < 0.82) {
    mult = 4.5 + 7.5 * Math.pow((t - 0.6) / 0.22, 0.88);
  } else if (t < 0.92) {
    mult = 12 + 13 * Math.pow((t - 0.82) / 0.1, 0.9);
  } else if (t < 0.985) {
    mult = 25 + 14 * Math.pow((t - 0.92) / 0.065, 0.92);
  } else {
    mult = 39 + Math.pow((t - 0.985) / 0.015, 0.8);
  }

  let nearMiss = false;
  if (mult >= 1.98 && mult <= 4.2 && nearMissRoll(t) < 0.1) {
    mult = 1.85 + nearMissRoll(t * 7.13) * 0.12;
    nearMiss = true;
  }

  const crashPoint = roundCrashPoint(Math.min(MAX_CRASH_POINT, Math.max(1.0, mult)));
  return { crashPoint, instantRug: false, nearMiss };
}

export function roundCrashPoint(value: number): number {
  return Math.floor(value * 100) / 100;
}

export function computeProvablyFairCrash(input: ProvablyFairInput): ProvablyFairResult {
  const fairHex = deriveFairHex(input.serverSeed, input.clientSeed, input.nonce);
  const randomUnit = hexToUnitFloat(fairHex);
  const { crashPoint, instantRug, nearMiss } = crashPointFromRandom(randomUnit);

  return { fairHex, randomUnit, instantRug, crashPoint, nearMiss };
}

export function computeCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  return computeProvablyFairCrash({ serverSeed, clientSeed, nonce }).crashPoint;
}

export function verifyCrashRound(params: {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  expectedCrashPoint: number;
}): { valid: boolean; reason?: string; derived?: ProvablyFairResult } {
  if (!serverSeedMatchesCommit(params.serverSeed, params.serverSeedHash)) {
    return { valid: false, reason: 'server seed does not match committed hash' };
  }

  const derived = computeProvablyFairCrash({
    serverSeed: normalizeServerSeed(params.serverSeed),
    clientSeed: params.clientSeed.trim(),
    nonce: params.nonce,
  });

  const valid =
    Math.abs(derived.crashPoint - roundCrashPoint(params.expectedCrashPoint)) < 0.015;
  return valid ? { valid: true, derived } : { valid: false, reason: 'crash point mismatch', derived };
}

export function verifyContinuousCrashRound(params: {
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  expectedPeak: number;
  expectedRugTick: number;
}): {
  valid: boolean;
  reason?: string;
  derived?: { peakMultiplier: number; rugTick: number };
} {
  if (!serverSeedMatchesCommit(params.serverSeed, params.serverSeedHash)) {
    return { valid: false, reason: 'server seed does not match committed hash' };
  }
  const generated = generateContinuousRoundPath(
    normalizeServerSeed(params.serverSeed),
    params.nonce,
  );
  const derived = {
    peakMultiplier: generated.peakMultiplier,
    rugTick: generated.rugTick,
  };
  const valid =
    Math.abs(derived.peakMultiplier - roundCrashPoint(params.expectedPeak)) < 0.015 &&
    derived.rugTick === params.expectedRugTick;
  return valid
    ? { valid: true, derived }
    : { valid: false, reason: 'continuous path mismatch', derived };
}

export function computeCrashPointLegacy(serverSeed: string, gameId: number): number {
  return computeCrashPoint(serverSeed, DEFAULT_CLIENT_SEED, gameId);
}

export function generateSeedHistory(count: number, clientSeed = DEFAULT_CLIENT_SEED): RoundSummary[] {
  const entries: RoundSummary[] = [];
  for (let i = count; i >= 1; i--) {
    const roundSeed = createHash('sha256').update(`bb-history-v6:${clientSeed}:${i}`).digest('hex');
    const result = computeProvablyFairCrash({ serverSeed: roundSeed, clientSeed, nonce: i });
    entries.push({
      id: i,
      crashPoint: result.crashPoint,
      serverSeedHash: hashServerSeed(roundSeed),
      serverSeed: roundSeed,
      clientSeed,
      nonce: i,
      instantRug: result.instantRug,
      ts: Date.now() - (count - i + 1) * 42000,
    });
  }
  return entries;
}

export function crashTier(mult: number): 'rug' | 'low' | 'mid' | 'high' | 'moon' {
  if (mult <= 1.01) return 'rug';
  if (mult < 3) return 'low';
  if (mult < 9) return 'mid';
  if (mult < 25) return 'high';
  return 'moon';
}

export const CRASH_TIER_COLOR: Record<ReturnType<typeof crashTier>, string> = {
  rug: '#ff003c',
  low: '#fcee0a',
  mid: '#00ff9c',
  high: '#00f0ff',
  moon: '#9d00ff',
};

export interface CrashHistoryStats {
  count: number;
  avgMult: number;
  rugPct: number;
  moonPct: number;
  biggest: number;
}

export function computeHistoryStats(history: RoundSummary[]): CrashHistoryStats {
  if (history.length === 0) {
    return { count: 0, avgMult: 0, rugPct: 0, moonPct: 0, biggest: 0 };
  }
  const count = history.length;
  const sum = history.reduce((a, r) => a + r.crashPoint, 0);
  const rugs = history.filter(r => r.crashPoint <= 1.01).length;
  const moons = history.filter(r => r.crashPoint >= 20).length;
  const biggest = Math.max(...history.map(r => r.crashPoint));
  return {
    count,
    avgMult: sum / count,
    rugPct: (rugs / count) * 100,
    moonPct: (moons / count) * 100,
    biggest,
  };
}

function seededPRNG(seed: string, gameId: number) {
  let counter = 0;
  return () => {
    const h = createHmac('sha256', seed).update(`${gameId}:${counter++}`).digest();
    return parseInt(h.subarray(0, 7).toString('hex'), 16) / Math.pow(2, 52);
  };
}

/** Fast deterministic unit PRNG (one HMAC seed, then xorshift — keeps path gen off the hot path). */
function seededUnitPRNG(seed: string, gameId: number) {
  const h = createHmac('sha256', seed).update(`continuous-v2:${gameId}`).digest();
  let s0 = h.readUInt32BE(0) >>> 0;
  let s1 = h.readUInt32BE(4) >>> 0;
  if (s0 === 0) s0 = 0x9e3779b9;
  if (s1 === 0) s1 = 0x6a09e667;
  return () => {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26);
    s1 = x >>> 0;
    return ((s0 + s1) >>> 0) / 4294967296;
  };
}

export interface PriceTick {
  price: number;
  t: number;
}

/**
 * rugs.fun Standard-style continuous path.
 * Candle timeframe is 4s (16 x 250ms ticks) on the manager.
 * Round length: ~6s to ~3min from a seeded mixture (short rugs common, long moons rarer).
 * Price mean-reverts toward a slowly wandering target so candles balance up/down
 * instead of one-way pumping into a ceiling.
 */
export const CONTINUOUS_MIN_ROUND_TICKS = 48; // 12s minimum — avoid instant rugs feeling broken
export const CONTINUOUS_MAX_ROUND_TICKS = 720; // 180s / 3 minutes
export const CONTINUOUS_PATH_EXTENSION_TICKS = 160; // +40s liquidity buffer
export const CONTINUOUS_PRICE_FLOOR = 0.4;
export const CONTINUOUS_PRICE_CEIL = 80;
/** @deprecated Prefer sampleContinuousRugTick — kept for imports/tests. */
export const CONTINUOUS_RUG_CHANCE_PER_TICK = 0.0045;

export interface ContinuousRoundPath {
  path: PriceTick[];
  peakMultiplier: number;
  /** Seed-fair base rug tick — live liquidity can delay or advance this. */
  rugTick: number;
}

/** Seeded duration mix targeting ~90s average (rugs.fun Standard feel). */
export function sampleContinuousRugTick(rng: () => number): number {
  const u = rng();
  let seconds: number;
  if (u < 0.1) {
    // Short rugs (15–45s)
    seconds = 15 + rng() * 30;
  } else if (u < 0.55) {
    // Core band around 1–2 minutes (55–110s)
    seconds = 55 + rng() * 55;
  } else if (u < 0.85) {
    // Extended (95–150s)
    seconds = 95 + rng() * 55;
  } else {
    // Long moon charts (140–180s / up to ~3 min)
    seconds = 140 + rng() * 40;
  }
  const ticks = Math.round((seconds * 1000) / 250);
  return Math.max(
    CONTINUOUS_MIN_ROUND_TICKS,
    Math.min(CONTINUOUS_MAX_ROUND_TICKS, ticks),
  );
}

/**
 * Demo Standard path: smooth mean-reverting walk that keeps balancing like a
 * live market, with occasional trend legs and rare moons (10x–50x+).
 */
export function generateContinuousRoundPath(
  serverSeed: string,
  gameId: number,
  tickMs = 250,
): ContinuousRoundPath {
  const rng = seededUnitPRNG(serverSeed, gameId);
  const rugTick = sampleContinuousRugTick(rng);
  const totalTicks = Math.min(
    CONTINUOUS_MAX_ROUND_TICKS + CONTINUOUS_PATH_EXTENSION_TICKS,
    rugTick + CONTINUOUS_PATH_EXTENSION_TICKS,
  );

  const path: PriceTick[] = [{ price: 1, t: 0 }];
  let price = 1;
  let peakMultiplier = 1;
  // Wandering fair value the price keeps balancing around
  let target = 1;
  let moonLeft = 0;

  for (let i = 1; i <= totalTicks; i++) {
    // Rare moon: lift the target for a stretch (can reach 10–50x on long rounds)
    if (moonLeft <= 0 && i > 20 && i <= rugTick && rng() < 0.0045) {
      moonLeft = 8 + Math.floor(rng() * 18);
      target = Math.max(target, 1.8 + rng() * 4) * (1 + rng() * 0.5);
    }
    if (moonLeft > 0) {
      moonLeft -= 1;
      target *= 1 + (0.008 + rng() * 0.03);
      target = Math.min(55, target);
    } else if (rng() < 0.11) {
      // Jump the balance point — waves above AND below 1x like rugs.fun
      const jump = (rng() - 0.52) * (0.12 + rng() * 0.32);
      target = Math.max(0.48, Math.min(3.8, target * (1 + jump)));
      target = target * 0.95 + 1 * 0.05;
    } else {
      // Slow drift of the target
      target *= 1 + (rng() - 0.52) * 0.02;
      target = Math.max(0.48, Math.min(3.2, target * 0.993 + 1 * 0.007));
    }

    // Mean-revert price toward target + candle noise (smooth, not jumpy)
    const pull = (target - price) * (0.055 + rng() * 0.04);
    const noise = price * (0.01 + rng() * 0.02) * (2 * rng() - 1);
    let change = pull + noise;

    // Occasional sharper candle (wicky up/down) without locking a direction
    if (rng() < 0.08) {
      change += (rng() > 0.5 ? 1 : -1) * (0.02 + rng() * 0.05);
    }

    // Floor bounce — never crawl at 0.1x
    if (price < CONTINUOUS_PRICE_FLOOR + 0.05) {
      change = Math.max(change, 0.025 + rng() * 0.06);
      target = Math.max(target, 0.7 + rng() * 0.35);
    } else if (price < 0.55) {
      change += 0.008 + rng() * 0.02;
    }

    // Resistance above mid multiples unless in an active moon
    if (moonLeft <= 0 && price > 3.5) {
      change -= (price - 3.5) * 0.01 * (0.3 + rng());
    }
    if (moonLeft <= 0 && price > 8 && rng() < 0.3) {
      change = -Math.abs(change) - (0.025 + rng() * 0.05);
      target = Math.min(target, 2 + rng() * 2);
    }

    price = Math.max(
      CONTINUOUS_PRICE_FLOOR,
      Math.min(CONTINUOUS_PRICE_CEIL, price * (1 + change)),
    );
    // Peak for history/seed verify = live window only (not liquidity extension)
    if (i <= rugTick) {
      peakMultiplier = Math.max(peakMultiplier, price);
    }
    path.push({
      price: Math.round(price * 10_000) / 10_000,
      t: (i * tickMs) / 1000,
    });
  }

  return {
    path,
    peakMultiplier: roundCrashPoint(peakMultiplier),
    rugTick,
  };
}

export function generateRoundPath(serverSeed: string, gameId: number, crashPoint: number, tickMs = 250): PriceTick[] {
  const rng = seededPRNG(serverSeed, gameId);
  const ticks: PriceTick[] = [];

  // Instant rugs crash on the FIRST candle — no low hover that telegraphs the
  // outcome (players were reading flat 1.00x candles and reacting before the drop).
  if (crashPoint <= 1.01) {
    return [
      { price: 1.0, t: 0 },
      { price: 1.0, t: tickMs / 1000 },
    ];
  }

  // Snappier pacing (closer to rugs.fun feel): ~9s for a 2x, ~16s for a 4x,
  // ~25s for a 10x, hard-capped at 60s. Crash point distribution / RTP unchanged.
  const duration = Math.max(2.5, Math.min(60, 2.5 + Math.log10(Math.max(crashPoint, 1.1)) * 22));
  let totalTicks = Math.floor((duration * 1000) / tickMs);
  if (!Number.isFinite(totalTicks) || totalTicks < 1) totalTicks = 1;

  for (let i = 0; i <= totalTicks; i++) {
    const t = (i * tickMs) / 1000;
    if (i === totalTicks) {
      ticks.push({ price: 0.01, t });
      break;
    }

    const progress = i / totalTicks;
    const ease = (Math.exp(progress * 3.2) - 1) / (Math.exp(3.2) - 1);
    const basePrice = 1 + (crashPoint - 1) * ease;
    const volatility = 0.02 * (1 - Math.pow(progress, 1.4));
    const noise = 1 + (rng() - 0.5) * 2 * volatility;
    const price = Math.max(1.0, basePrice * noise);
    ticks.push({ price, t });
  }

  return ticks;
}

export function simulateHouseEdge(samples = 100_000, houseEdgePercent = HOUSE_EDGE_PERCENT): number {
  let total = 0;
  for (let i = 0; i < samples; i++) {
    const seed = createHash('sha256').update(`sim:${i}`).digest('hex');
    const hex = deriveFairHex(seed, 'sim-client', i);
    const r = hexToUnitFloat(hex);
    total += crashPointFromRandom(r, houseEdgePercent).crashPoint;
  }
  return total / samples;
}
