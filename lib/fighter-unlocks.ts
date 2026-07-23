import { FIGHTERS, type Fighter } from '@/lib/fighters';

/** Fighters 1–4 are free; 5–8 require $BLACKBALLS balance thresholds. */
export const FIGHTER_UNLOCK_BALANCE: Record<string, number> = {
  moon_ape: 10_000,
  degen_lord: 25_000,
  pepe_war: 50_000,
  chad_monk: 100_000,
};

export function getFighterUnlockRequirement(fighter: Fighter): number | null {
  const idx = FIGHTERS.findIndex(f => f.id === fighter.id);
  if (idx < 0 || idx < 4) return null;
  return FIGHTER_UNLOCK_BALANCE[fighter.id] ?? null;
}

export function isFighterUnlocked(fighter: Fighter, blackballsBalance: number): boolean {
  const required = getFighterUnlockRequirement(fighter);
  if (required == null) return true;
  return blackballsBalance >= required;
}
