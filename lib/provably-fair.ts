/**
 * Browser-native SHA-256 verification for provably fair rounds.
 * Uses Web Crypto API — avoids CryptoJS vs hex encoding mismatches.
 */

import { serverSeedMatchesCommit } from '@/lib/provably-fair-utils';

/** Standard Web Crypto API SHA-256 verification (client-safe). */
export async function verifyServerSeed(seed: string, expectedHash: string): Promise<boolean> {
  if (!seed || !expectedHash) return false;

  const cleanSeed = seed.trim();
  const cleanExpectedHash = expectedHash.trim().toLowerCase();

  if (!cleanSeed || !cleanExpectedHash) return false;

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(cleanSeed);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return computedHash.toLowerCase() === cleanExpectedHash;
    }
  } catch (error) {
    console.error('Verification error:', error);
  }

  return serverSeedMatchesCommit(cleanSeed, cleanExpectedHash);
}
