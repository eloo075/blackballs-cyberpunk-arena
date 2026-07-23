import type { Fighter } from '@/lib/fighters';
import { scaleFighterStats, type ScaledFighterStats } from '@/lib/arena-rewards';

/** Fighter stats after level-up bonuses are applied. */
export interface BattleFighter extends Fighter, ScaledFighterStats {
  level: number;
}

export function toBattleFighter(fighter: Fighter, level: number): BattleFighter {
  const scaled = scaleFighterStats(fighter, level);
  return { ...fighter, ...scaled, level };
}
