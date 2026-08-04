import 'server-only';

import type { CrashManager } from '@/lib/crash-manager';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';

export type CrashClientViewPayload = {
  phase?: 'waiting' | 'running' | 'crashed';
  gameId?: number;
  hasPosition?: boolean;
  hasLivePosition?: boolean;
  entryPending?: boolean;
  positionSide?: 'buy' | 'sell';
  positionAmount?: number;
  positionLeverage?: number;
  positionEntryPrice?: number;
  balance?: number;
};

type EngineRow = {
  game_id: number;
  phase: 'waiting' | 'running' | 'crashed';
  wait_left: number;
  elapsed: number;
  mult: number;
  peak_mult: number;
  last_settled_round_id: number;
  updated_at: string;
};

type PlayerRow = {
  address: string;
  balance: number;
  has_position: boolean;
  entry_pending: boolean;
  position_side: 'buy' | 'sell';
  position_amount: number;
  position_leverage: number;
  position_entry_price: number;
  position_round_id: number | null;
  pending_side: 'buy' | 'sell' | null;
  pending_amount: number | null;
  pending_leverage: number | null;
  pending_round_id: number | null;
  auto_sell: number | null;
  stimmy: number;
  frenzy: number;
  updated_at: string;
};

let lastEnginePersistAt = 0;
const ENGINE_PERSIST_MS = 500;

export function maybePersistEngineSnapshot(manager: CrashManager): void {
  if (!isSupabaseConfigured()) return;
  const now = Date.now();
  if (now - lastEnginePersistAt < ENGINE_PERSIST_MS) return;
  lastEnginePersistAt = now;
  void persistEngineSnapshot(manager);
}

export async function persistEngineSnapshot(manager: CrashManager): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const snap = manager.exportEngineSnapshot();
  await supabase.from('crash_engine_snapshot').upsert({
    id: 'live',
    game_id: snap.gameId,
    phase: snap.phase,
    wait_left: snap.waitLeft,
    elapsed: snap.elapsed,
    mult: snap.mult,
    peak_mult: snap.peakMult,
    last_settled_round_id: snap.lastSettledRoundId,
    updated_at: new Date().toISOString(),
  });
}

export async function persistPlayerSnapshot(manager: CrashManager, address: string): Promise<void> {
  if (!isSupabaseConfigured() || !address) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const row = manager.exportPlayerSnapshot(address);
  if (!row) return;

  await supabase.from('crash_player_state').upsert({
    address,
    balance: row.balance,
    has_position: row.hasPosition,
    entry_pending: row.entryPending,
    position_side: row.positionSide,
    position_amount: row.positionAmount,
    position_leverage: row.positionLeverage,
    position_entry_price: row.positionEntryPrice,
    position_round_id: row.positionRoundId,
    pending_side: row.pendingSide,
    pending_amount: row.pendingAmount,
    pending_leverage: row.pendingLeverage,
    pending_round_id: row.pendingRoundId,
    auto_sell: row.autoSell,
    stimmy: row.stimmy,
    frenzy: row.frenzy,
    updated_at: new Date().toISOString(),
  });
}

export async function clearPlayerSnapshot(address: string): Promise<void> {
  if (!isSupabaseConfigured() || !address) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from('crash_player_state').delete().eq('address', address);
}

export async function loadAndApplyEngineSnapshot(manager: CrashManager): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('crash_engine_snapshot')
    .select('*')
    .eq('id', 'live')
    .maybeSingle();

  if (error || !data) return false;

  const row = data as EngineRow;
  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs > 120_000) return false;

  const local = manager.exportEngineSnapshot();
  const snapGameId = row.game_id;
  const snapPhase = row.phase;
  const snapElapsed = Number(row.elapsed);
  const snapWaitLeft = Number(row.wait_left);

  // Don't rewind an instance that is already ahead of the DB snapshot.
  if (local.gameId === snapGameId && local.phase === snapPhase) {
    if (snapPhase === 'running' && local.elapsed > snapElapsed + 0.35) return false;
    if (snapPhase === 'waiting' && local.waitLeft < snapWaitLeft - 0.35) return false;
    if (snapPhase === 'crashed' && local.waitLeft < snapWaitLeft - 0.35) return false;
  }

  const catchUpSec = Math.min(ageMs / 1000, 12);
  manager.applyEngineSnapshot(
    {
      gameId: snapGameId,
      phase: snapPhase,
      waitLeft: snapWaitLeft,
      elapsed: snapElapsed,
      mult: Number(row.mult),
      peakMult: Number(row.peak_mult),
      lastSettledRoundId: row.last_settled_round_id,
    },
    catchUpSec,
  );
  return true;
}

export async function loadAndApplyPlayerSnapshot(manager: CrashManager, address: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !address) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('crash_player_state')
    .select('*')
    .eq('address', address)
    .maybeSingle();

  if (error || !data) return false;

  const row = data as PlayerRow;
  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs > 300_000) return false;

  manager.importPlayerSnapshot(address, {
    balance: Number(row.balance),
    hasPosition: row.has_position,
    entryPending: row.entry_pending,
    positionSide: row.position_side,
    positionAmount: Number(row.position_amount),
    positionLeverage: Number(row.position_leverage),
    positionEntryPrice: Number(row.position_entry_price),
    positionRoundId: row.position_round_id,
    pendingSide: row.pending_side,
    pendingAmount: row.pending_amount != null ? Number(row.pending_amount) : null,
    pendingLeverage: row.pending_leverage != null ? Number(row.pending_leverage) : null,
    pendingRoundId: row.pending_round_id,
    autoSell: row.auto_sell != null ? Number(row.auto_sell) : null,
    stimmy: Number(row.stimmy),
    frenzy: Number(row.frenzy),
  });
  return true;
}

/** Align cold serverless instance before enter / cancel / cashout. */
export async function ensureCrashStateSynced(
  manager: CrashManager,
  address: string | null,
  clientView?: CrashClientViewPayload | null,
): Promise<void> {
  await loadAndApplyEngineSnapshot(manager);
  if (address) {
    await loadAndApplyPlayerSnapshot(manager, address);
    if (clientView && !address.startsWith('0x')) {
      manager.reconcilePlayerFromClient(address, clientView);
    }
  }
}
