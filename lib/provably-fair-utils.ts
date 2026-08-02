import { createHash } from 'crypto';

/** Normalize hex hash strings for safe equality checks. */
export function normalizeHashHex(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalize server seed before hashing (strip accidental whitespace). */
export function normalizeServerSeed(seed: string): string {
  return seed.trim();
}

/** SHA-256 of normalized server seed, returned as lowercase hex. */
export function hashServerSeedNormalized(seed: string): string {
  return normalizeHashHex(
    createHash('sha256').update(normalizeServerSeed(seed)).digest('hex'),
  );
}

/** True when revealed seed matches the committed pre-round hash. */
export function serverSeedMatchesCommit(serverSeed: string, committedHash: string): boolean {
  return hashServerSeedNormalized(serverSeed) === normalizeHashHex(committedHash);
}
