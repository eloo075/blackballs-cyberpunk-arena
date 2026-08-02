import { FIGHTERS } from '@/lib/fighters';

export interface DailyChallenge {
  id: string;
  label: string;
  target: number;
  xpReward: number;
}

export interface Achievement {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export const DAILY_CHALLENGES: DailyChallenge[] = [
  { id: 'arena_win_2', label: 'Win 2 arena fights', target: 2, xpReward: 200 },
  { id: 'arena_upset', label: 'Upset: beat +20 PWR opponent', target: 1, xpReward: 350 },
  { id: 'arena_grind_3', label: 'Fight 3 arena battles', target: 3, xpReward: 100 },
  { id: 'crash_2x', label: 'Cash out crash at 2x+', target: 1, xpReward: 150 },
  { id: 'streak_3', label: 'Hit a 3-win arena streak', target: 1, xpReward: 250 },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', label: 'First Blood', emoji: '🩸', description: 'Win your first arena fight' },
  { id: 'streak_5', label: 'On Fire', emoji: '🔥', description: 'Reach a 5-win arena streak' },
  { id: 'streak_10', label: 'Unstoppable', emoji: '⚡', description: 'Reach a 10-win arena streak' },
  { id: 'boss_slayer', label: 'Boss Slayer', emoji: '💀', description: 'Defeat the daily boss' },
  { id: 'whale_hunter', label: 'Whale Hunter', emoji: '🐋', description: 'Beat Zog in the arena' },
  { id: 'degen_100', label: 'Arena Addict', emoji: '🎰', description: 'Fight 100 arena battles' },
  { id: 'crash_moon', label: 'Moon Rider', emoji: '🌙', description: 'Cash out crash at 10x+' },
  { id: 'upset_king', label: 'Upset King', emoji: '👑', description: 'Beat an opponent 30+ PWR stronger' },
];

const BOSS_IDS = ['zog', 'rug_reaper', 'pingu', 'bullx'] as const;

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyBossId(): string {
  const day = new Date().getDay();
  return BOSS_IDS[day % BOSS_IDS.length];
}

export function getDailyBossFighter() {
  const id = getDailyBossId();
  return FIGHTERS.find(f => f.id === id) ?? FIGHTERS[FIGHTERS.length - 1];
}

/** Escalating multiplier for arena win streaks. */
export function arenaStreakMultiplier(streak: number): number {
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

export function streakLabel(streak: number): string | null {
  if (streak >= 10) return 'UNSTOPPABLE';
  if (streak >= 5) return 'ON FIRE';
  if (streak >= 3) return 'HEATING UP';
  return null;
}

export function isUpset(playerPower: number, opponentPower: number): boolean {
  return playerPower + 20 <= opponentPower;
}

export function isMegaUpset(playerPower: number, opponentPower: number): boolean {
  return playerPower + 30 <= opponentPower;
}

export const BOSS_REWARD_MULTIPLIER = 3;
export const BOSS_OPPONENT_LEVEL = 6;
export const FREE_BOSS_ATTEMPTS = 1;
export const BOSS_RETRY_COST = 50;

export const WAGER_OPTIONS = [0, 10, 25, 50, 100] as const;
export const WAGER_MIN = 0;
export const WAGER_MAX = 500;
export const CHALLENGE_COST_BB = 15;
