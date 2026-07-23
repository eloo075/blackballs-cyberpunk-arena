import { FIGHTERS, type Fighter } from '@/lib/fighters';

/** Only the two lowest-power fighters are free; rest require $BLACKBALLS. */
export const FREE_FIGHTER_COUNT = 2;

const POWER_UNLOCK_EXPONENT = 3;
const POWER_UNLOCK_MULTIPLIER = 25;

const sortedByPower = [...FIGHTERS].sort((a, b) => a.power - b.power);
const FREE_FIGHTER_IDS = new Set(sortedByPower.slice(0, FREE_FIGHTER_COUNT).map(f => f.id));

/** Unlock cost scales with power³ — stronger fighters cost much more. */
export function computeUnlockCostFromPower(power: number): number {
  return Math.round(Math.pow(power, POWER_UNLOCK_EXPONENT) * POWER_UNLOCK_MULTIPLIER);
}

export function isFreeFighter(fighter: Fighter): boolean {
  return FREE_FIGHTER_IDS.has(fighter.id);
}

export function getFighterUnlockRequirement(fighter: Fighter): number | null {
  if (isFreeFighter(fighter)) return null;
  return computeUnlockCostFromPower(fighter.power);
}

export function isFighterUnlocked(fighter: Fighter, blackballsBalance: number): boolean {
  const required = getFighterUnlockRequirement(fighter);
  if (required == null) return true;
  return blackballsBalance >= required;
}

export function formatUnlockCost(cost: number): string {
  if (cost >= 1_000_000) return `${(cost / 1_000_000).toFixed(cost % 1_000_000 === 0 ? 0 : 1)}M`;
  if (cost >= 1_000) return `${(cost / 1_000).toFixed(cost % 1_000 === 0 ? 0 : 1)}K`;
  return cost.toLocaleString();
}
