import 'server-only';

import type { FlipManager } from '@/lib/flip-manager';
import type { Flip1v1Match } from '@/lib/flip-types';
import type { FlipSide } from '@/lib/flip-engine';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';

type EngineRow = {
  match_id: number;
  open1v1: Flip1v1Match[];
  active1v1: Flip1v1Match | null;
  updated_at: string;
};

type PlayerRow = {
  address: string;
  balance: number;
  holds_blackballs: boolean;
  active1v1_id: string | null;
  active_dogpile_side: FlipSide | null;
  win_streak: number;
  loss_streak: number;
  last_opponent: string | null;
  updated_at: string;
};

let lastEnginePersistAt = 0;
const ENGINE_PERSIST_MS = 1500;

export function maybePersistFlipEngineSnapshot(manager: FlipManager): void {
  if (!isSupabaseConfigured()) return;
  const now = Date.now();
  if (now - lastEnginePersistAt < ENGINE_PERSIST_MS) return;
  lastEnginePersistAt = now;
  void persistFlipEngineSnapshot(manager);
}

export async function persistFlipEngineSnapshot(manager: FlipManager): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const snap = manager.exportEngineSnapshot();
  await supabase.from('flip_engine_snapshot').upsert({
    id: 'live',
    match_id: snap.matchId,
    open1v1: snap.open1v1,
    active1v1: snap.active1v1,
    updated_at: new Date().toISOString(),
  });
}

export async function persistFlipPlayerSnapshot(manager: FlipManager, address: string): Promise<void> {
  if (!isSupabaseConfigured() || !address) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const row = manager.exportPlayerSnapshot(address);
  if (!row) return;

  await supabase.from('flip_player_state').upsert({
    address,
    balance: row.balance,
    holds_blackballs: row.holdsBlackballs,
    active1v1_id: row.active1v1Id,
    active_dogpile_side: row.activeDogpileSide,
    win_streak: row.winStreak,
    loss_streak: row.lossStreak,
    last_opponent: row.lastOpponent,
    updated_at: new Date().toISOString(),
  });
}

export async function loadAndApplyFlipEngineSnapshot(manager: FlipManager): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('flip_engine_snapshot')
    .select('*')
    .eq('id', 'live')
    .maybeSingle();

  if (error || !data) return false;

  const row = data as EngineRow;
  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs > 120_000) return false;

  manager.applyEngineSnapshot({
    matchId: row.match_id,
    open1v1: Array.isArray(row.open1v1) ? row.open1v1 : [],
    active1v1: row.active1v1 ?? null,
  });
  return true;
}

export async function loadAndApplyFlipPlayerSnapshot(
  manager: FlipManager,
  address: string,
): Promise<boolean> {
  if (!isSupabaseConfigured() || !address) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('flip_player_state')
    .select('*')
    .eq('address', address)
    .maybeSingle();

  if (error || !data) return false;

  const row = data as PlayerRow;
  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs > 300_000) return false;

  manager.importPlayerSnapshot(address, {
    balance: Number(row.balance),
    holdsBlackballs: row.holds_blackballs,
    active1v1Id: row.active1v1_id,
    activeDogpileSide: row.active_dogpile_side,
    winStreak: row.win_streak,
    lossStreak: row.loss_streak,
    lastOpponent: row.last_opponent,
  });
  return true;
}

export async function ensureFlipStateSynced(manager: FlipManager, address: string | null): Promise<void> {
  await loadAndApplyFlipEngineSnapshot(manager);
  if (address) {
    await loadAndApplyFlipPlayerSnapshot(manager, address);
  }
}
