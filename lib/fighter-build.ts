/** Stat point allocation — +1 point every 2 levels. */

export interface StatAllocation {
  atk: number;
  hp: number;
  spd: number;
  luck: number;
}

export const STAT_POINTS_PER_LEVEL = 0.5;

export function statPointsEarned(level: number): number {
  return Math.floor((Math.max(1, level) - 1) * STAT_POINTS_PER_LEVEL);
}

export function statPointsSpent(allocation: StatAllocation): number {
  return allocation.atk + allocation.hp + allocation.spd + allocation.luck;
}

export function statPointsAvailable(level: number, allocation: StatAllocation): number {
  return Math.max(0, statPointsEarned(level) - statPointsSpent(allocation));
}

export function defaultAllocation(): StatAllocation {
  return { atk: 0, hp: 0, spd: 0, luck: 0 };
}

export function applyStatAllocation(
  base: { atk: number; hp: number; spd: number; luck: number },
  allocation: StatAllocation,
): { atk: number; hp: number; spd: number; luck: number } {
  return {
    atk: base.atk + allocation.atk * 2,
    hp: base.hp + allocation.hp * 5,
    spd: base.spd + allocation.spd,
    luck: base.luck + allocation.luck,
  };
}
