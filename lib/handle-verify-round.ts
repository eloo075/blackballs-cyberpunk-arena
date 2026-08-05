import { verifyServerSeed } from '@/lib/provably-fair';
import { normalizeHashHex, normalizeServerSeed } from '@/lib/provably-fair-utils';

export interface VerifyRoundInput {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  expectedCrashPoint: number;
  mode?: 'classic' | 'continuous';
  expectedRugTick?: number | null;
}

export interface VerifyRoundResult {
  valid: boolean;
  reason?: string;
  crashPoint?: number;
}

/**
 * Provably-fair verification: Web Crypto hash check, then server crash-point validation.
 */
export async function handleVerifyRound(
  input: VerifyRoundInput,
  signal?: AbortSignal,
): Promise<VerifyRoundResult> {
  const serverSeed = normalizeServerSeed(input.serverSeed);
  const serverSeedHash = normalizeHashHex(input.serverSeedHash);

  if (!serverSeed || !serverSeedHash) {
    return { valid: false, reason: 'missing seed or hash' };
  }

  const hashValid = await verifyServerSeed(serverSeed, serverSeedHash);
  if (!hashValid) {
    return { valid: false, reason: 'Hash mismatch: server seed does not match committed hash' };
  }

  const res = await fetch('/api/crash/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverSeed,
      serverSeedHash,
      clientSeed: input.clientSeed.trim(),
      nonce: input.nonce,
      expectedCrashPoint: input.expectedCrashPoint,
      mode: input.mode,
      expectedRugTick: input.expectedRugTick,
    }),
    signal,
  });

  const data = (await res.json().catch(() => ({}))) as {
    valid?: boolean;
    reason?: string;
    derived?: { crashPoint?: number; peakMultiplier?: number };
  };

  if (data.valid) {
    return {
      valid: true,
      crashPoint:
        data.derived?.crashPoint ??
        data.derived?.peakMultiplier ??
        input.expectedCrashPoint,
    };
  }

  return {
    valid: false,
    reason: data.reason ?? 'Verification failed',
  };
}
