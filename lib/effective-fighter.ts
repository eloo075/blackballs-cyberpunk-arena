import type { Fighter } from '@/lib/fighters';
import { computePower } from '@/lib/fighter-stats';
import { scaleFighterStats, type ScaledFighterStats } from '@/lib/arena-rewards';
import type { StatAllocation } from '@/lib/fighter-build';
import { applyStatAllocation } from '@/lib/fighter-build';
import type { EquipmentLoadout } from '@/lib/arena-equipment';
import { equipmentStatBonus } from '@/lib/arena-equipment';

/** Fighter stats after level-up bonuses, stat points, and equipment. */
export interface BattleFighter extends Fighter, ScaledFighterStats {
  level: number;
  statAllocation?: StatAllocation;
  equipment?: EquipmentLoadout;
}

export function toBattleFighter(
  fighter: Fighter,
  level: number,
  statAllocation?: StatAllocation,
  equipment?: EquipmentLoadout,
): BattleFighter {
  const scaled = scaleFighterStats(fighter, level);
  const withStats = applyStatAllocation(scaled, statAllocation ?? { atk: 0, hp: 0, spd: 0, luck: 0 });
  const eq = equipmentStatBonus(equipment ?? {});
  const atk = withStats.atk + eq.atk;
  const hp = withStats.hp + eq.hp;
  const spd = withStats.spd + eq.spd;
  const luck = withStats.luck + eq.luck;
  return {
    ...fighter,
    atk,
    hp,
    spd,
    luck,
    power: computePower(atk, hp, spd, luck),
    level,
    statAllocation,
    equipment,
  };
}
