import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseAdmin: () => null,
}));

import { DEMO_STARTING_BB } from '@/lib/demo-credits';
import { applyDailyRefill, ensureDemoAccount } from '@/lib/supabase/demo-account-store';

function wallet(n: number): string {
  return `0x${n.toString(16).padStart(40, 'a')}`;
}

afterEach(() => {
  globalThis.__demoRewardAccounts = undefined;
  globalThis.__demoRewardSignups = undefined;
});

describe('ensureDemoAccount (memory)', () => {
  it('grants DEMO_STARTING_BB to a brand-new wallet', async () => {
    const result = await ensureDemoAccount(wallet(1), { ip: '1.1.1.1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.grantedStarting).toBe(true);
    expect(result.account.balance).toBe(DEMO_STARTING_BB);
    expect(result.account.lastRefillAt).toBeNull();
  });

  it('backfills a never-played 0-balance row so BUY can work', async () => {
    const addr = wallet(2);
    const first = await ensureDemoAccount(addr, { ip: '2.2.2.2' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    first.account.balance = 0;
    first.account.lastRefillAt = new Date().toISOString();

    const again = await ensureDemoAccount(addr, { ip: '2.2.2.2' });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.created).toBe(false);
    expect(again.grantedStarting).toBe(true);
    expect(again.account.balance).toBe(DEMO_STARTING_BB);
    expect(again.account.lastRefillAt).toBeNull();
  });

  it('does not re-grant after the player has already played', async () => {
    const addr = wallet(3);
    const first = await ensureDemoAccount(addr, { ip: '3.3.3.3' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    first.account.balance = 0;
    first.account.roundsPlayed = 4;

    const again = await ensureDemoAccount(addr, { ip: '3.3.3.3' });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.grantedStarting).toBe(false);
    expect(again.account.balance).toBe(0);
  });
});

describe('applyDailyRefill (memory)', () => {
  it('grants credits at balance 0 when cooldown is clear', async () => {
    const addr = wallet(4);
    const created = await ensureDemoAccount(addr, { ip: '4.4.4.4' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    created.account.balance = 0;
    created.account.roundsPlayed = 2;
    created.account.lastRefillAt = null;

    const refill = await applyDailyRefill(addr, 0);
    expect(refill.ok).toBe(true);
    if (!refill.ok) return;
    expect(refill.balance).toBe(DEMO_STARTING_BB);
  });
});
