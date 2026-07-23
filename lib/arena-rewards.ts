import type { Fighter } from '@/lib/fighters';
import { computePower } from '@/lib/fighter-stats';

/** Player XP thresholds per rank title (matches leaderboard RANK_TITLES). */
export const XP_PER_RANK = 12_000;

export const RANK_TITLES = ['NPC', 'DEGEN', 'APE', 'CHAD', 'WHALE', 'LEGEND'] as const;

export function rankTitleFromXp(xp: number): string {
  const idx = Math.min(RANK_TITLES.length - 1, Math.floor(xp / XP_PER_RANK));
  return RANK_TITLES[idx];
}

export interface XpProgress {
  rankTitle: string;
  rankIndex: number;
  xpInRank: number;
  xpForNextRank: number;
  xpToNextRank: number;
  progress: number;
  isMaxRank: boolean;
  nextRankTitle: string;
}

export function xpProgress(xp: number): XpProgress {
  const rankIndex = Math.min(RANK_TITLES.length - 1, Math.floor(xp / XP_PER_RANK));
  const rankTitle = RANK_TITLES[rankIndex];
  const xpInRank = xp - rankIndex * XP_PER_RANK;
  const isMaxRank = rankIndex >= RANK_TITLES.length - 1;
  const xpToNextRank = isMaxRank ? 0 : XP_PER_RANK - xpInRank;
  const progress = isMaxRank ? 1 : xpInRank / XP_PER_RANK;
  const nextRankTitle = isMaxRank ? rankTitle : RANK_TITLES[rankIndex + 1];

  return {
    rankTitle,
    rankIndex,
    xpInRank,
    xpForNextRank: XP_PER_RANK,
    xpToNextRank,
    progress,
    isMaxRank,
    nextRankTitle,
  };
}

export function computeBattlePlayerXp(won: boolean, opponentPower: number): number {
  if (won) return 50 + Math.floor(opponentPower * 1.2);
  return 15 + Math.floor(opponentPower * 0.25);
}

/** Fighter-specific coins earned from a battle (spent on level-ups). */
export function computeFighterCoins(won: boolean, opponentPower: number, lootBlackballs: number): number {
  if (won) return Math.max(10, Math.floor(lootBlackballs * 2 + opponentPower * 0.15));
  return Math.max(3, Math.floor(5 + opponentPower * 0.05));
}

export const MAX_FIGHTER_LEVEL = 25;

export function levelUpCoinCost(level: number): number {
  return Math.floor(40 * Math.pow(level, 1.45));
}

export function canLevelUp(level: number, coins: number): boolean {
  return level < MAX_FIGHTER_LEVEL && coins >= levelUpCoinCost(level);
}

/** +4% all combat stats per level above 1. */
export function fighterLevelMultiplier(level: number): number {
  return 1 + (Math.max(1, level) - 1) * 0.04;
}

export interface ScaledFighterStats {
  atk: number;
  hp: number;
  spd: number;
  luck: number;
  power: number;
}

export function scaleFighterStats(fighter: Fighter, level: number): ScaledFighterStats {
  const m = fighterLevelMultiplier(level);
  const atk = Math.round(fighter.atk * m);
  const hp = Math.round(fighter.hp * m);
  const spd = Math.round(fighter.spd * m);
  const luck = Math.round(fighter.luck * m);
  return {
    atk,
    hp,
    spd,
    luck,
    power: computePower(atk, hp, spd, luck),
  };
}
