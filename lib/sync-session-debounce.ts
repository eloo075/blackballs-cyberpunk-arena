/** Minimum gap between non-boot session sync POSTs (prevents API storms in dev). */
export const SESSION_SYNC_MIN_MS = 4000;

const lastSyncAt = new Map<string, number>();

export function shouldSkipSessionSync(address: string, force = false): boolean {
  if (force) return false;
  const last = lastSyncAt.get(address) ?? 0;
  return Date.now() - last < SESSION_SYNC_MIN_MS;
}

export function markSessionSynced(address: string): void {
  lastSyncAt.set(address, Date.now());
}

export function clearSessionSyncDebounce(address: string): void {
  lastSyncAt.delete(address);
}
