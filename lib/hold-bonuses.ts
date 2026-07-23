export interface TokenHoldings {
  blackballs: number;
  ansem: number;
  cashcat: number;
}

export interface ActiveBonus {
  token: 'BLACKBALLS' | 'ANSEM' | 'CASHCAT';
  type: 'stimmy' | 'frenzy';
  rate: number;
  label: string;
}

export interface HoldBonuses {
  stimmy: number;
  frenzy: number;
  active: ActiveBonus[];
  damageMultiplier: number;
  payoutMultiplier: number;
  critChanceBonus: number;
}

export const HOLD_THRESHOLDS: Record<keyof TokenHoldings, number> = {
  blackballs: 1,
  ansem: 1,
  cashcat: 1,
};

const EMPTY_BONUSES: HoldBonuses = {
  stimmy: 0,
  frenzy: 0,
  active: [],
  damageMultiplier: 1,
  payoutMultiplier: 1,
  critChanceBonus: 0,
};

export function holdingsFromWallet(blackballsBalance: number, ansem = 0, cashcat = 0): TokenHoldings {
  return {
    blackballs: blackballsBalance,
    ansem,
    cashcat,
  };
}

export function computeHoldBonuses(holdings: TokenHoldings): HoldBonuses {
  const active: ActiveBonus[] = [];
  let stimmy = 0;
  let frenzy = 0;

  if (holdings.blackballs >= HOLD_THRESHOLDS.blackballs) {
    stimmy += 0.3;
    active.push({
      token: 'BLACKBALLS',
      type: 'stimmy',
      rate: 0.3,
      label: 'Stimmy +30%',
    });
  }

  if (holdings.ansem >= HOLD_THRESHOLDS.ansem) {
    stimmy += 0.2;
    active.push({
      token: 'ANSEM',
      type: 'stimmy',
      rate: 0.2,
      label: 'Stimmy +20%',
    });
  }

  if (holdings.cashcat >= HOLD_THRESHOLDS.cashcat) {
    frenzy += 0.15;
    active.push({
      token: 'CASHCAT',
      type: 'frenzy',
      rate: 0.15,
      label: 'Frenzy +15%',
    });
  }

  if (active.length === 0) return EMPTY_BONUSES;

  return {
    stimmy,
    frenzy,
    active,
    damageMultiplier: 1 + stimmy,
    payoutMultiplier: 1 + stimmy,
    critChanceBonus: frenzy,
  };
}

export function applyStimmyDamage(baseDamage: number, bonuses: HoldBonuses): number {
  return Math.floor(baseDamage * bonuses.damageMultiplier);
}

export function applyCrashPayout(baseProceeds: number, bonuses: HoldBonuses): { total: number; frenzyProc: boolean } {
  let total = baseProceeds * bonuses.payoutMultiplier;
  const frenzyProc = bonuses.frenzy > 0 && Math.random() < bonuses.frenzy;
  if (frenzyProc) {
    total *= 1 + bonuses.frenzy;
  }
  return { total, frenzyProc };
}

export function computeBattleLoot(baseLoot: number, bonuses: HoldBonuses): number {
  return parseFloat((baseLoot * bonuses.payoutMultiplier).toFixed(3));
}
