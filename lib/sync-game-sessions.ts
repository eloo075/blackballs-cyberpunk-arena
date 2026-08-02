'use client';

import {
  clearSessionSyncDebounce,
  markSessionSynced,
  shouldSkipSessionSync,
} from '@/lib/sync-session-debounce';

async function postSession(
  path: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn(`[sync-game-sessions] ${path} failed`, res.status, data.error ?? data);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[sync-game-sessions] ${path} network error`, err);
    return false;
  }
}

/** Sync demo balance into Crash + Flip server state. Never throws. */
export async function syncGameSessionBalances(
  address: string,
  balance: number,
  stimmy: number,
  frenzy: number,
  holdsBlackballs: boolean,
  isRealWallet = false,
  boot = true,
  force = false,
): Promise<boolean> {
  if (!force && !boot && shouldSkipSessionSync(address)) {
    return true;
  }
  const crashOk = await postSession('/api/crash/session', {
    address,
    balance,
    stimmy,
    frenzy,
    isRealWallet,
    boot,
  });
  const flipOk = await postSession('/api/flip/session', {
    address,
    balance,
    holdsBlackballs,
    isRealWallet,
    boot,
  });
  if (crashOk && flipOk) markSessionSynced(address);
  return crashOk && flipOk;
}

const bootedAddresses = new Set<string>();
const inflightBoot = new Map<string, Promise<boolean>>();

/** Boot both game servers once per wallet address (survives tab switches). */
export async function bootGameSessionsForWallet(
  address: string,
  balance: number,
  stimmy: number,
  frenzy: number,
  holdsBlackballs: boolean,
  isRealWallet = false,
): Promise<boolean> {
  const existing = inflightBoot.get(address);
  if (existing) return existing;

  const job = (async () => {
    if (bootedAddresses.has(address)) {
      return syncGameSessionBalances(
        address,
        balance,
        stimmy,
        frenzy,
        holdsBlackballs,
        isRealWallet,
        false,
      );
    }

    const ok = await syncGameSessionBalances(
      address,
      balance,
      stimmy,
      frenzy,
      holdsBlackballs,
      isRealWallet,
      true,
      true,
    );
    if (ok) bootedAddresses.add(address);
    return ok;
  })();

  inflightBoot.set(address, job);
  try {
    return await job;
  } finally {
    inflightBoot.delete(address);
  }
}

/** Push wallet balance into both game servers after a trade/settlement. Never throws. */
export async function mirrorAuthoritativeBalance(
  address: string,
  balance: number,
  stimmy: number,
  frenzy: number,
  holdsBlackballs: boolean,
  isRealWallet = false,
): Promise<void> {
  await syncGameSessionBalances(address, balance, stimmy, frenzy, holdsBlackballs, isRealWallet, false);
}

export function clearGameSessionBoot(address: string) {
  bootedAddresses.delete(address);
  inflightBoot.delete(address);
  clearSessionSyncDebounce(address);
}
