import 'server-only';

import { MAX_DEMO_BALANCE, roundMoney } from '@/lib/crash-pnl';
import {
  capPeriodPoints,
  isoWeekBounds,
  isoWeekPeriodId,
  normalizeWalletAddress,
  scoreSettledRound,
  SCORED_ROUNDS_CAP,
  shortenWallet,
} from '@/lib/demo-rewards';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import type { CrashPlaySettlement } from '@/lib/crash-play-settlement';
import type { LeaderboardEntry, LeaderboardPayload } from '@/lib/crash-leaderboard-types';

export type { CrashPlaySettlement, LeaderboardEntry, LeaderboardPayload };

type MemoryRound = {
  periodId: string;
  gameId: number;
  address: string;
  won: boolean;
  stake: number;
  pnl: number;
  exitMultiplier: number | null;
  crashMultiplier: number | null;
  roundScore: number;
  finalized: boolean;
};

type MemoryStanding = {
  periodId: string;
  address: string;
  points: number;
  scoredRounds: number;
  wins: number;
  bestMultiplier: number;
  roundsPlayed: number;
  rank: number | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __demoRewardRounds: MemoryRound[] | undefined;
  // eslint-disable-next-line no-var
  var __demoRewardStandings: MemoryStanding[] | undefined;
  // eslint-disable-next-line no-var
  var __demoRewardPeriods: Map<string, { startsAt: string; endsAt: string; frozen: boolean }> | undefined;
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

function memoryRounds(): MemoryRound[] {
  if (!globalThis.__demoRewardRounds) globalThis.__demoRewardRounds = [];
  return globalThis.__demoRewardRounds;
}

function memoryStandings(): MemoryStanding[] {
  if (!globalThis.__demoRewardStandings) globalThis.__demoRewardStandings = [];
  return globalThis.__demoRewardStandings;
}

function memoryPeriods() {
  if (!globalThis.__demoRewardPeriods) globalThis.__demoRewardPeriods = new Map();
  return globalThis.__demoRewardPeriods;
}

export async function ensureCurrentPeriod(at = new Date()): Promise<{
  periodId: string;
  startsAt: string;
  endsAt: string;
  frozen: boolean;
}> {
  const periodId = isoWeekPeriodId(at);
  const { startsAt, endsAt } = isoWeekBounds(periodId);
  const supabase = requireAdmin();
  if (!supabase) {
    const periods = memoryPeriods();
    for (const [id, p] of periods) {
      if (!p.frozen && new Date(p.endsAt).getTime() <= at.getTime()) {
        p.frozen = true;
        periods.set(id, p);
      }
    }
    const existing = periods.get(periodId);
    if (!existing) {
      periods.set(periodId, {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        frozen: false,
      });
    }
    const row = periods.get(periodId)!;
    return { periodId, startsAt: row.startsAt, endsAt: row.endsAt, frozen: row.frozen };
  }

  const { data: open } = await supabase
    .from('crash_leaderboard_periods')
    .select('period_id, ends_at, frozen')
    .eq('frozen', false);

  for (const row of open ?? []) {
    if (new Date(row.ends_at).getTime() <= at.getTime()) {
      await supabase
        .from('crash_leaderboard_periods')
        .update({ frozen: true, snapshot_at: at.toISOString() })
        .eq('period_id', row.period_id);
    }
  }

  const { data: current } = await supabase
    .from('crash_leaderboard_periods')
    .select('period_id, starts_at, ends_at, frozen')
    .eq('period_id', periodId)
    .maybeSingle();

  if (!current) {
    await supabase.from('crash_leaderboard_periods').upsert({
      period_id: periodId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      frozen: false,
    });
    return {
      periodId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      frozen: false,
    };
  }

  return {
    periodId,
    startsAt: String(current.starts_at),
    endsAt: String(current.ends_at),
    frozen: current.frozen === true,
  };
}

async function bumpLifetimeStats(
  address: string,
  firstFinalize: boolean,
  won: boolean,
  exitMult: number | null,
  periodPoints: number,
): Promise<void> {
  if (!firstFinalize) return;
  const supabase = requireAdmin();
  if (!supabase) return;
  const { data } = await supabase
    .from('crash_player_state')
    .select('rounds_played, wins, best_multiplier')
    .eq('address', address)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from('crash_player_state')
    .update({
      rounds_played: (Number(data.rounds_played) || 0) + 1,
      wins: (Number(data.wins) || 0) + (won ? 1 : 0),
      best_multiplier: Math.max(Number(data.best_multiplier) || 0, exitMult ?? 0),
      lifetime_points: periodPoints,
      last_seen: new Date().toISOString(),
    })
    .eq('address', address);
}

async function recomputeWalletStanding(periodId: string, address: string): Promise<void> {
  const supabase = requireAdmin();
  if (!supabase) {
    const rounds = memoryRounds().filter(r => r.periodId === periodId && r.address === address && r.finalized);
    const { points, scoredRounds } = capPeriodPoints(rounds.map(r => r.roundScore));
    const wins = rounds.filter(r => r.won).length;
    const bestMultiplier = rounds.reduce((m, r) => Math.max(m, r.exitMultiplier ?? 0), 0);
    const standings = memoryStandings();
    const idx = standings.findIndex(s => s.periodId === periodId && s.address === address);
    const next: MemoryStanding = {
      periodId,
      address,
      points,
      scoredRounds,
      wins,
      bestMultiplier,
      roundsPlayed: rounds.length,
      rank: null,
    };
    if (idx >= 0) standings[idx] = next;
    else standings.push(next);

    const ranked = standings
      .filter(s => s.periodId === periodId)
      .sort((a, b) => b.points - a.points || b.bestMultiplier - a.bestMultiplier);
    ranked.forEach((s, i) => {
      s.rank = i + 1;
    });
    return;
  }

  const { data: rounds } = await supabase
    .from('crash_settled_rounds')
    .select('round_score, won, exit_multiplier')
    .eq('period_id', periodId)
    .eq('address', address)
    .eq('finalized', true);

  const list = rounds ?? [];
  const { points, scoredRounds } = capPeriodPoints(list.map(r => Number(r.round_score) || 0));
  const wins = list.filter(r => r.won).length;
  const bestMultiplier = list.reduce((m, r) => Math.max(m, Number(r.exit_multiplier) || 0), 0);

  await supabase.from('crash_leaderboard_standings').upsert({
    period_id: periodId,
    address,
    points,
    scored_rounds: scoredRounds,
    wins,
    best_multiplier: bestMultiplier,
    rounds_played: list.length,
    updated_at: new Date().toISOString(),
  });
}

export async function recordSettledPlay(
  event: CrashPlaySettlement,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const address = normalizeWalletAddress(event.address);
  if (!address.startsWith('0x')) return;

  const period = await ensureCurrentPeriod();
  if (period.frozen) return;

  const stake = roundMoney(Math.min(MAX_DEMO_BALANCE, Math.max(0, event.stake)));
  const pnl = roundMoney(event.pnl);
  const exitMult = Number.isFinite(event.exitMult) ? event.exitMult : null;
  const crashMult = event.crashMult != null && Number.isFinite(event.crashMult) ? event.crashMult : null;
  const ip = (meta.ip ?? '').slice(0, 64) || null;
  const userAgent = (meta.userAgent ?? '').slice(0, 240) || null;

  const supabase = requireAdmin();
  if (!supabase) {
    const rounds = memoryRounds();
    const idx = rounds.findIndex(
      r => r.periodId === period.periodId && r.gameId === event.gameId && r.address === address,
    );
    const prev = idx >= 0 ? rounds[idx] : null;
    const firstFinalize = event.finalized && !prev?.finalized;
    const next: MemoryRound = {
      periodId: period.periodId,
      gameId: event.gameId,
      address,
      won: false,
      stake: roundMoney((prev?.stake ?? 0) + stake),
      pnl: roundMoney((prev?.pnl ?? 0) + pnl),
      exitMultiplier: Math.max(prev?.exitMultiplier ?? 0, exitMult ?? 0) || exitMult,
      crashMultiplier: crashMult ?? prev?.crashMultiplier ?? null,
      roundScore: 0,
      finalized: event.finalized || Boolean(prev?.finalized),
    };
    next.won = next.finalized && next.pnl > 0.0001;
    next.roundScore = next.finalized
      ? scoreSettledRound({ stake: next.stake, pnl: next.pnl, won: next.won })
      : 0;
    if (idx >= 0) rounds[idx] = next;
    else rounds.push(next);
    if (next.finalized) {
      await recomputeWalletStanding(period.periodId, address);
      void firstFinalize;
    }
    return;
  }

  const { data: existing } = await supabase
    .from('crash_settled_rounds')
    .select('stake, pnl, exit_multiplier, crash_multiplier, finalized')
    .eq('period_id', period.periodId)
    .eq('game_id', event.gameId)
    .eq('address', address)
    .maybeSingle();

  const mergedStake = roundMoney((Number(existing?.stake) || 0) + stake);
  const mergedPnl = roundMoney((Number(existing?.pnl) || 0) + pnl);
  const mergedExit = Math.max(Number(existing?.exit_multiplier) || 0, exitMult ?? 0) || exitMult;
  const firstFinalize = event.finalized && existing?.finalized !== true;
  const finalized = event.finalized || existing?.finalized === true;
  const mergedWon = finalized && mergedPnl > 0.0001;
  const mergedScore = finalized
    ? scoreSettledRound({ stake: mergedStake, pnl: mergedPnl, won: mergedWon })
    : 0;

  await supabase.from('crash_settled_rounds').upsert({
    period_id: period.periodId,
    game_id: event.gameId,
    address,
    won: mergedWon,
    stake: mergedStake,
    pnl: mergedPnl,
    exit_multiplier: mergedExit,
    crash_multiplier: crashMult ?? existing?.crash_multiplier ?? null,
    round_score: mergedScore,
    finalized,
    settled_at: new Date().toISOString(),
    ip,
    user_agent: userAgent,
  });

  if (finalized) {
    await recomputeWalletStanding(period.periodId, address);
    const { data: standing } = await supabase
      .from('crash_leaderboard_standings')
      .select('points')
      .eq('period_id', period.periodId)
      .eq('address', address)
      .maybeSingle();
    await bumpLifetimeStats(
      address,
      firstFinalize,
      mergedWon,
      mergedExit,
      Number(standing?.points) || mergedScore,
    );
  }
}

export async function getLeaderboard(viewerAddress?: string | null): Promise<LeaderboardPayload> {
  const period = await ensureCurrentPeriod();
  const youAddr = viewerAddress ? normalizeWalletAddress(viewerAddress) : null;
  const remainingMs = Math.max(0, new Date(period.endsAt).getTime() - Date.now());

  const toEntry = (
    row: {
      rank: number | null;
      address: string;
      points: number;
      scoredRounds: number;
      wins: number;
      bestMultiplier: number;
      roundsPlayed: number;
    },
    fallbackRank: number,
  ): LeaderboardEntry => ({
    rank: row.rank ?? fallbackRank,
    address: row.address,
    display: shortenWallet(row.address),
    points: row.points,
    scoredRounds: row.scoredRounds,
    wins: row.wins,
    bestMultiplier: row.bestMultiplier,
    roundsPlayed: row.roundsPlayed,
    isYou: Boolean(youAddr && row.address === youAddr),
  });

  const supabase = requireAdmin();
  if (!supabase) {
    const rows = memoryStandings()
      .filter(s => s.periodId === period.periodId)
      .sort((a, b) => b.points - a.points || b.bestMultiplier - a.bestMultiplier);
    const entries = rows.slice(0, 100).map((s, i) =>
      toEntry(
        {
          rank: s.rank ?? i + 1,
          address: s.address,
          points: s.points,
          scoredRounds: s.scoredRounds,
          wins: s.wins,
          bestMultiplier: s.bestMultiplier,
          roundsPlayed: s.roundsPlayed,
        },
        i + 1,
      ),
    );
    const youRow = youAddr ? rows.find(s => s.address === youAddr) : null;
    return {
      periodId: period.periodId,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      frozen: period.frozen,
      remainingMs,
      entries,
      you: youRow
        ? toEntry(
            {
              rank: youRow.rank,
              address: youRow.address,
              points: youRow.points,
              scoredRounds: youRow.scoredRounds,
              wins: youRow.wins,
              bestMultiplier: youRow.bestMultiplier,
              roundsPlayed: youRow.roundsPlayed,
            },
            youRow.rank ?? rows.length,
          )
        : null,
      scoredRoundsCap: SCORED_ROUNDS_CAP,
    };
  }

  const { data } = await supabase
    .from('crash_leaderboard_standings')
    .select('rank, address, points, scored_rounds, wins, best_multiplier, rounds_played')
    .eq('period_id', period.periodId)
    .order('points', { ascending: false })
    .order('best_multiplier', { ascending: false })
    .limit(100);

  const entries = (data ?? []).map((row, i) =>
    toEntry(
      {
        rank: row.rank,
        address: row.address,
        points: Number(row.points) || 0,
        scoredRounds: Number(row.scored_rounds) || 0,
        wins: Number(row.wins) || 0,
        bestMultiplier: Number(row.best_multiplier) || 0,
        roundsPlayed: Number(row.rounds_played) || 0,
      },
      i + 1,
    ),
  );

  let you: LeaderboardEntry | null = entries.find(e => e.isYou) ?? null;
  if (!you && youAddr) {
    const { data: mine } = await supabase
      .from('crash_leaderboard_standings')
      .select('rank, address, points, scored_rounds, wins, best_multiplier, rounds_played')
      .eq('period_id', period.periodId)
      .eq('address', youAddr)
      .maybeSingle();
    if (mine) {
      const { count } = await supabase
        .from('crash_leaderboard_standings')
        .select('address', { count: 'exact', head: true })
        .eq('period_id', period.periodId)
        .gt('points', Number(mine.points) || 0);
      const computedRank = (count ?? 0) + 1;
      you = toEntry(
        {
          rank: computedRank,
          address: mine.address,
          points: Number(mine.points) || 0,
          scoredRounds: Number(mine.scored_rounds) || 0,
          wins: Number(mine.wins) || 0,
          bestMultiplier: Number(mine.best_multiplier) || 0,
          roundsPlayed: Number(mine.rounds_played) || 0,
        },
        computedRank,
      );
    }
  }

  return {
    periodId: period.periodId,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    frozen: period.frozen,
    remainingMs,
    entries,
    you,
    scoredRoundsCap: SCORED_ROUNDS_CAP,
  };
}
