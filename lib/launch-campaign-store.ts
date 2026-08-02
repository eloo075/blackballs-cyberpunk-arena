import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import { formatSupabaseError } from '@/lib/supabase/fetch';
import {
  LAUNCH_CAMPAIGN_SPOTS,
  normalizeCampaignWallet,
} from '@/lib/launch-campaign';

export type CampaignRegistrationResult =
  | {
      ok: true;
      spotNumber: number;
      totalClaimed: number;
      alreadyRegistered: boolean;
    }
  | {
      ok: false;
      error: string;
      full?: boolean;
      totalClaimed?: number;
    };

export type CampaignStatusResult = {
  totalClaimed: number;
  spotsRemaining: number;
  full: boolean;
  spotNumber: number | null;
  registered: boolean;
};

type MemoryEntry = { wallet: string; spotNumber: number; createdAt: string };

declare global {
  // eslint-disable-next-line no-var
  var __launchCampaignEntries: MemoryEntry[] | undefined;
}

function memoryEntries(): MemoryEntry[] {
  if (!globalThis.__launchCampaignEntries) {
    globalThis.__launchCampaignEntries = [];
  }
  return globalThis.__launchCampaignEntries;
}

function memoryRegister(address: string): CampaignRegistrationResult {
  const entries = memoryEntries();
  const existing = entries.find(e => e.wallet === address);
  if (existing) {
    return {
      ok: true,
      spotNumber: existing.spotNumber,
      totalClaimed: entries.length,
      alreadyRegistered: true,
    };
  }
  if (entries.length >= LAUNCH_CAMPAIGN_SPOTS) {
    return {
      ok: false,
      error: 'All 500 spots are claimed',
      full: true,
      totalClaimed: entries.length,
    };
  }
  const spotNumber = entries.length + 1;
  entries.push({ wallet: address, spotNumber, createdAt: new Date().toISOString() });
  return {
    ok: true,
    spotNumber,
    totalClaimed: entries.length,
    alreadyRegistered: false,
  };
}

function memoryStatus(address: string | null): CampaignStatusResult {
  const entries = memoryEntries();
  const existing = address ? entries.find(e => e.wallet === address) : undefined;
  const totalClaimed = entries.length;
  return {
    totalClaimed,
    spotsRemaining: Math.max(0, LAUNCH_CAMPAIGN_SPOTS - totalClaimed),
    full: totalClaimed >= LAUNCH_CAMPAIGN_SPOTS,
    spotNumber: existing?.spotNumber ?? null,
    registered: Boolean(existing),
  };
}

export async function registerCampaignWallet(
  rawAddress: unknown,
): Promise<CampaignRegistrationResult> {
  const address = normalizeCampaignWallet(rawAddress);
  if (!address) {
    return { ok: false, error: 'Enter a valid 0x wallet address' };
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return { ok: false, error: 'Campaign database unavailable' };
    }

    const { data, error } = await supabase.rpc('register_launch_campaign_wallet', {
      p_wallet: address,
    });

    if (error) {
      return { ok: false, error: formatSupabaseError(error.message) };
    }

    const payload = data as Record<string, unknown> | null;
    if (!payload?.ok) {
      return {
        ok: false,
        error: typeof payload?.error === 'string' ? payload.error : 'Registration failed',
        full: payload?.full === true,
        totalClaimed:
          typeof payload?.totalClaimed === 'number' ? payload.totalClaimed : undefined,
      };
    }

    return {
      ok: true,
      spotNumber: Number(payload.spotNumber),
      totalClaimed: Number(payload.totalClaimed),
      alreadyRegistered: payload.alreadyRegistered === true,
    };
  }

  return memoryRegister(address);
}

export async function getCampaignStatus(rawAddress?: unknown): Promise<CampaignStatusResult> {
  const address = rawAddress != null ? normalizeCampaignWallet(rawAddress) : null;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return memoryStatus(address);
    }

    const { count, error: countError } = await supabase
      .from('launch_campaign_entries')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return memoryStatus(address);
    }

    const totalClaimed = count ?? 0;
    let spotNumber: number | null = null;
    let registered = false;

    if (address) {
      const { data, error } = await supabase
        .from('launch_campaign_entries')
        .select('spot_number')
        .eq('wallet_address', address)
        .maybeSingle();

      if (!error && data) {
        spotNumber = data.spot_number;
        registered = true;
      }
    }

    return {
      totalClaimed,
      spotsRemaining: Math.max(0, LAUNCH_CAMPAIGN_SPOTS - totalClaimed),
      full: totalClaimed >= LAUNCH_CAMPAIGN_SPOTS,
      spotNumber,
      registered,
    };
  }

  return memoryStatus(address);
}
