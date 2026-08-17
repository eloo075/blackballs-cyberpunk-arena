import 'server-only';

import {
  DEMO_REFILL_BB,
  DEMO_REFILL_COOLDOWN_MS,
  DEMO_REFILL_ELIGIBLE_BELOW,
  DEMO_STARTING_BB,
  MAX_NEW_ACCOUNTS_PER_IP_PER_DAY,
  shouldGrantStartingCredits,
} from '@/lib/demo-credits';
import { isEvmWalletAddress, normalizeWalletAddress } from '@/lib/demo-rewards';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import { MAX_DEMO_BALANCE, roundMoney } from '@/lib/crash-pnl';

export type DemoAccountRow = {
  address: string;
  balance: number;
  createdAt: string;
  lastSeen: string;
  lastRefillAt: string | null;
  roundsPlayed: number;
  wins: number;
  bestMultiplier: number;
  lifetimePoints: number;
  createdIp: string | null;
  lastIp: string | null;
};

export type EnsureAccountResult =
  | { ok: true; created: boolean; grantedStarting: boolean; account: DemoAccountRow }
  | { ok: false; error: string; status: number };

export type RefillResult =
  | {
      ok: true;
      balance: number;
      nextRefillAt: string;
    }
  | {
      ok: false;
      error: string;
      status: number;
      nextRefillAt?: string;
      balance?: number;
    };

type MemoryAccount = DemoAccountRow & { lastUserAgent: string | null };

declare global {
  // eslint-disable-next-line no-var
  var __demoRewardAccounts: Map<string, MemoryAccount> | undefined;
  // eslint-disable-next-line no-var
  var __demoRewardSignups: Map<string, number> | undefined;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function requireAdmin() {
  const supabase = isSupabaseConfigured() ? getSupabaseAdmin() : null;
  if (supabase) return supabase;
  if (isProduction()) {
    throw new Error(
      '[demo-rewards] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.',
    );
  }
  return null;
}

function memoryAccounts(): Map<string, MemoryAccount> {
  if (!globalThis.__demoRewardAccounts) globalThis.__demoRewardAccounts = new Map();
  return globalThis.__demoRewardAccounts;
}

function memorySignups(): Map<string, number> {
  if (!globalThis.__demoRewardSignups) globalThis.__demoRewardSignups = new Map();
  return globalThis.__demoRewardSignups;
}

function utcDayKey(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

function clampBalance(n: number): number {
  return roundMoney(Math.min(MAX_DEMO_BALANCE, Math.max(0, n)));
}

function toAccount(row: Record<string, unknown>): DemoAccountRow {
  return {
    address: String(row.address),
    balance: clampBalance(Number(row.balance) || 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    lastSeen: String(row.last_seen ?? new Date().toISOString()),
    lastRefillAt: row.last_refill_at != null ? String(row.last_refill_at) : null,
    roundsPlayed: Number(row.rounds_played) || 0,
    wins: Number(row.wins) || 0,
    bestMultiplier: Number(row.best_multiplier) || 0,
    lifetimePoints: Number(row.lifetime_points) || 0,
    createdIp: row.created_ip != null ? String(row.created_ip) : null,
    lastIp: row.last_ip != null ? String(row.last_ip) : null,
  };
}

function newAccount(address: string, ip: string | null): MemoryAccount {
  const now = new Date().toISOString();
  return {
    address,
    balance: DEMO_STARTING_BB,
    createdAt: now,
    lastSeen: now,
    lastRefillAt: null,
    roundsPlayed: 0,
    wins: 0,
    bestMultiplier: 0,
    lifetimePoints: 0,
    createdIp: ip,
    lastIp: ip,
    lastUserAgent: null,
  };
}

function signupKey(ip: string): string {
  return `${ip}|${utcDayKey()}`;
}

function memoryAllowSignup(ip: string): boolean {
  const key = signupKey(ip);
  const map = memorySignups();
  const count = map.get(key) ?? 0;
  if (count >= MAX_NEW_ACCOUNTS_PER_IP_PER_DAY) return false;
  map.set(key, count + 1);
  return true;
}

export async function ensureDemoAccount(
  rawAddress: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<EnsureAccountResult> {
  if (!isEvmWalletAddress(rawAddress)) {
    return { ok: false, error: 'Connect a wallet to play', status: 401 };
  }
  const address = normalizeWalletAddress(rawAddress);
  const ip = (meta.ip ?? 'unknown').slice(0, 64);
  const userAgent = (meta.userAgent ?? '').slice(0, 240);
  const now = new Date().toISOString();

  const supabase = requireAdmin();
  if (!supabase) {
    const accounts = memoryAccounts();
    const existing = accounts.get(address);
    if (existing) {
      existing.lastSeen = now;
      existing.lastIp = ip;
      existing.lastUserAgent = userAgent || existing.lastUserAgent;
      if (
        shouldGrantStartingCredits({
          balance: existing.balance,
          roundsPlayed: existing.roundsPlayed,
        })
      ) {
        existing.balance = DEMO_STARTING_BB;
        existing.lastRefillAt = null;
        return { ok: true, created: false, grantedStarting: true, account: existing };
      }
      return { ok: true, created: false, grantedStarting: false, account: existing };
    }
    if (!memoryAllowSignup(ip)) {
      return {
        ok: false,
        error: 'Too many new wallets from this network today. Try again tomorrow.',
        status: 429,
      };
    }
    const created = newAccount(address, ip);
    created.lastUserAgent = userAgent || null;
    accounts.set(address, created);
    return { ok: true, created: true, grantedStarting: true, account: created };
  }

  const { data: existing, error: readError } = await supabase
    .from('crash_player_state')
    .select(
      'address, balance, created_at, last_seen, last_refill_at, rounds_played, wins, best_multiplier, lifetime_points, created_ip, last_ip, has_position, entry_pending',
    )
    .eq('address', address)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: 'Account lookup failed', status: 503 };
  }

  if (existing) {
    const row = existing as Record<string, unknown>;
    const grant = shouldGrantStartingCredits({
      balance: Number(row.balance) || 0,
      roundsPlayed: Number(row.rounds_played) || 0,
      hasPosition: row.has_position === true,
      entryPending: row.entry_pending === true,
    });
    await supabase
      .from('crash_player_state')
      .update({
        last_seen: now,
        last_ip: ip,
        last_user_agent: userAgent || null,
        ...(grant ? { balance: DEMO_STARTING_BB, last_refill_at: null } : {}),
      })
      .eq('address', address);
    return {
      ok: true,
      created: false,
      grantedStarting: grant,
      account: toAccount({
        ...row,
        ...(grant ? { balance: DEMO_STARTING_BB, last_refill_at: null } : {}),
      }),
    };
  }

  const day = utcDayKey();
  const { data: signup } = await supabase
    .from('crash_signup_ip')
    .select('created_count')
    .eq('ip', ip)
    .eq('day', day)
    .maybeSingle();

  const createdCount = Number(signup?.created_count) || 0;
  if (createdCount >= MAX_NEW_ACCOUNTS_PER_IP_PER_DAY) {
    return {
      ok: false,
      error: 'Too many new wallets from this network today. Try again tomorrow.',
      status: 429,
    };
  }

  const { error: insertError } = await supabase.from('crash_player_state').insert({
    address,
    balance: DEMO_STARTING_BB,
    created_at: now,
    last_seen: now,
    last_refill_at: null,
    created_ip: ip,
    last_ip: ip,
    last_user_agent: userAgent || null,
    rounds_played: 0,
    wins: 0,
    best_multiplier: 0,
    lifetime_points: 0,
  });

  if (insertError) {
    const { data: raced } = await supabase
      .from('crash_player_state')
      .select(
        'address, balance, created_at, last_seen, last_refill_at, rounds_played, wins, best_multiplier, lifetime_points, created_ip, last_ip',
      )
      .eq('address', address)
      .maybeSingle();
    if (raced) {
      return {
        ok: true,
        created: false,
        grantedStarting: false,
        account: toAccount(raced as Record<string, unknown>),
      };
    }
    return { ok: false, error: 'Could not create account', status: 503 };
  }

  await supabase.from('crash_signup_ip').upsert({
    ip,
    day,
    created_count: createdCount + 1,
  });

  return {
    ok: true,
    created: true,
    grantedStarting: true,
    account: toAccount({
      address,
      balance: DEMO_STARTING_BB,
      created_at: now,
      last_seen: now,
      last_refill_at: null,
      rounds_played: 0,
      wins: 0,
      best_multiplier: 0,
      lifetime_points: 0,
      created_ip: ip,
      last_ip: ip,
    }),
  };
}

export async function getDemoAccount(rawAddress: string): Promise<DemoAccountRow | null> {
  if (!isEvmWalletAddress(rawAddress)) return null;
  const address = normalizeWalletAddress(rawAddress);
  const supabase = requireAdmin();
  if (!supabase) {
    return memoryAccounts().get(address) ?? null;
  }
  const { data, error } = await supabase
    .from('crash_player_state')
    .select(
      'address, balance, created_at, last_seen, last_refill_at, rounds_played, wins, best_multiplier, lifetime_points, created_ip, last_ip',
    )
    .eq('address', address)
    .maybeSingle();
  if (error || !data) return null;
  return toAccount(data as Record<string, unknown>);
}

export async function persistAccountBalance(address: string, balance: number): Promise<void> {
  const clamped = clampBalance(balance);
  const now = new Date().toISOString();
  const supabase = requireAdmin();
  if (!supabase) {
    const row = memoryAccounts().get(address);
    if (row) {
      row.balance = clamped;
      row.lastSeen = now;
    }
    return;
  }
  await supabase
    .from('crash_player_state')
    .update({ balance: clamped, last_seen: now, updated_at: now })
    .eq('address', address);
}

export async function applyDailyRefill(
  rawAddress: string,
  currentBalance: number,
): Promise<RefillResult> {
  if (!isEvmWalletAddress(rawAddress)) {
    return { ok: false, error: 'Connect a wallet to claim credits', status: 401 };
  }
  const address = normalizeWalletAddress(rawAddress);
  const account = await getDemoAccount(address);
  if (!account) {
    return { ok: false, error: 'Account not found', status: 404 };
  }

  const liquid = clampBalance(currentBalance);
  if (liquid > DEMO_REFILL_ELIGIBLE_BELOW) {
    return {
      ok: false,
      error: `Refill is only available when credits are at or below ${DEMO_REFILL_ELIGIBLE_BELOW}.`,
      status: 400,
      balance: liquid,
    };
  }

  const last = account.lastRefillAt ? new Date(account.lastRefillAt).getTime() : 0;
  const elapsed = Date.now() - last;
  if (last > 0 && elapsed < DEMO_REFILL_COOLDOWN_MS) {
    const nextRefillAt = new Date(last + DEMO_REFILL_COOLDOWN_MS).toISOString();
    return {
      ok: false,
      error: 'Daily refill already claimed. Come back in 24h.',
      status: 429,
      nextRefillAt,
      balance: liquid,
    };
  }

  const now = new Date();
  const nextRefillAt = new Date(now.getTime() + DEMO_REFILL_COOLDOWN_MS).toISOString();
  const supabase = requireAdmin();
  if (!supabase) {
    const row = memoryAccounts().get(address);
    if (row) {
      row.balance = DEMO_REFILL_BB;
      row.lastRefillAt = now.toISOString();
      row.lastSeen = now.toISOString();
    }
    return { ok: true, balance: DEMO_REFILL_BB, nextRefillAt };
  }

  const { error } = await supabase
    .from('crash_player_state')
    .update({
      balance: DEMO_REFILL_BB,
      last_refill_at: now.toISOString(),
      last_seen: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('address', address);

  if (error) {
    return { ok: false, error: 'Refill failed', status: 503, balance: liquid };
  }
  return { ok: true, balance: DEMO_REFILL_BB, nextRefillAt };
}

export function nextRefillAtIso(lastRefillAt: string | null): string | null {
  if (!lastRefillAt) return null;
  const last = new Date(lastRefillAt).getTime();
  if (!Number.isFinite(last)) return null;
  return new Date(last + DEMO_REFILL_COOLDOWN_MS).toISOString();
}
