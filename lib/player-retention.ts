/** Daily login streak + small rewards (localStorage per wallet). */

export interface LoginStreakState {
  lastLoginDay: string;
  streak: number;
  totalClaims: number;
}

export interface AirdropProgress {
  daysInSeason: number;
  seasonLength: number;
  xpProgress: number;
  xpToNextRank: number;
  rankTitle: string;
  nextRankTitle: string;
}

const STORAGE_PREFIX = 'bb_login_streak_';
const SEASON_DAYS = 15;

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultStreak(): LoginStreakState {
  return { lastLoginDay: '', streak: 0, totalClaims: 0 };
}

export function loadLoginStreak(address: string | null): LoginStreakState {
  if (!address || typeof window === 'undefined') return defaultStreak();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + address);
    return raw ? (JSON.parse(raw) as LoginStreakState) : defaultStreak();
  } catch {
    return defaultStreak();
  }
}

export function saveLoginStreak(address: string, state: LoginStreakState) {
  localStorage.setItem(STORAGE_PREFIX + address, JSON.stringify(state));
}

/** Call on connect — returns reward if a new day was claimed. */
export function tickLoginStreak(address: string): { streak: number; rewardBb: number; fightCoins: number; isNew: boolean } {
  const today = todayKey();
  const current = loadLoginStreak(address);
  if (current.lastLoginDay === today) {
    return { streak: current.streak, rewardBb: 0, fightCoins: 0, isNew: false };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const continued = current.lastLoginDay === yesterdayKey;
  const streak = continued ? current.streak + 1 : 1;
  const rewardBb = Math.min(50, 3 + streak * 2);
  const fightCoins = Math.min(30, 5 + streak);

  saveLoginStreak(address, {
    lastLoginDay: today,
    streak,
    totalClaims: current.totalClaims + 1,
  });

  return { streak, rewardBb, fightCoins, isNew: true };
}

export function airdropSeasonProgress(xp: number, rankTitle: string, nextRankTitle: string, xpToNextRank: number, progress: number): AirdropProgress {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const dayOfYear = Math.floor((Date.now() - startOfYear.getTime()) / 86_400_000);
  const daysInSeason = (dayOfYear % SEASON_DAYS) + 1;

  return {
    daysInSeason,
    seasonLength: SEASON_DAYS,
    xpProgress: progress,
    xpToNextRank,
    rankTitle,
    nextRankTitle,
  };
}

export interface HallOfFameEntry {
  id: string;
  player: string;
  multiplier: number;
  profit: number;
  ts: number;
}

const HOF_KEY = 'bb_hof_today';

export function loadHallOfFameToday(): HallOfFameEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HOF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { day: string; entries: HallOfFameEntry[] };
    if (parsed.day !== todayKey()) return [];
    return parsed.entries.slice(0, 10);
  } catch {
    return [];
  }
}

export function recordHallOfFame(entry: Omit<HallOfFameEntry, 'id' | 'ts'>) {
  if (typeof window === 'undefined') return;
  const existing = loadHallOfFameToday();
  const next: HallOfFameEntry = {
    ...entry,
    id: `hof-${Date.now()}`,
    ts: Date.now(),
  };
  const merged = [next, ...existing]
    .sort((a, b) => b.profit - a.profit || b.multiplier - a.multiplier)
    .slice(0, 10);
  localStorage.setItem(HOF_KEY, JSON.stringify({ day: todayKey(), entries: merged }));
}
