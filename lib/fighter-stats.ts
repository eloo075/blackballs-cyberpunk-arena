import type { Fighter } from '@/lib/fighters';

/** Derive visual tier 1–5 from power rating (stronger = flashier art). */
export function fighterVisualTier(power: number): 1 | 2 | 3 | 4 | 5 {
  if (power >= 92) return 5;
  if (power >= 78) return 4;
  if (power >= 62) return 3;
  if (power >= 48) return 2;
  return 1;
}

/** Power is the average of combat stats — keeps ranking honest. */
export function computePower(atk: number, hp: number, spd: number, luck: number): number {
  return Math.round((atk + hp + spd + luck) / 4);
}

export function assertMonotonicStats(fighters: Fighter[]): void {
  for (let i = 1; i < fighters.length; i++) {
    const prev = fighters[i - 1];
    const cur = fighters[i];
    if (cur.power <= prev.power) {
      throw new Error(`Fighter ${cur.id} power must exceed ${prev.id}`);
    }
    for (const stat of ['atk', 'hp', 'spd', 'luck'] as const) {
      if (cur[stat] < prev[stat]) {
        throw new Error(`Fighter ${cur.id}.${stat} must be >= ${prev.id}.${stat}`);
      }
    }
  }
}
