/**
 * Provably fair coin flip — commit-reveal (same HMAC scheme as Crash).
 * Pure 50/50: randomUnit < 0.5 → heads, else tails.
 */
import { createHash, createHmac, randomBytes } from 'crypto';
import { FLIP_CONFIG } from './flip-config';
import {
  hashServerSeedNormalized,
  normalizeServerSeed,
  serverSeedMatchesCommit,
} from './provably-fair-utils';

export type FlipSide = 'heads' | 'tails';

export interface FlipProvablyFairInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

export interface FlipProvablyFairResult {
  fairHex: string;
  randomUnit: number;
  side: FlipSide;
}

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
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

export function sideFromRandom(randomUnit: number): FlipSide {
  return randomUnit < 0.5 ? 'heads' : 'tails';
}

export function computeFlipResult(input: FlipProvablyFairInput): FlipProvablyFairResult {
  const fairHex = deriveFairHex(input.serverSeed, input.clientSeed, input.nonce);
  const randomUnit = hexToUnitFloat(fairHex);
  return { fairHex, randomUnit, side: sideFromRandom(randomUnit) };
}

export function verifyFlipRound(params: {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  expectedSide: FlipSide;
}): { valid: boolean; reason?: string; side?: FlipSide } {
  if (!serverSeedMatchesCommit(params.serverSeed, params.serverSeedHash)) {
    return { valid: false, reason: 'server seed does not match committed hash' };
  }
  const result = computeFlipResult({
    serverSeed: normalizeServerSeed(params.serverSeed),
    clientSeed: params.clientSeed.trim(),
    nonce: params.nonce,
  });
  if (result.side !== params.expectedSide) {
    return { valid: false, reason: 'side mismatch', side: result.side };
  }
  return { valid: true, side: result.side };
}

/** Landing rotation (deg) for 3D coin animation — same asset both faces. */
export function landingRotation(side: FlipSide, extraSpins = 5): number {
  const base = side === 'heads' ? 0 : 180;
  return extraSpins * 360 + base;
}

export function defaultClientSeed(): string {
  return FLIP_CONFIG.DEFAULT_CLIENT_SEED;
}
