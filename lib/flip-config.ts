/** Flip mode configuration — rake & limits easy to tune. */

export const FLIP_CONFIG = {
  /** Base rake for non-holders (3%). */
  BASE_RAKE: 0.03,
  /** Reduced rake for $BlackBalls holders (1.5%). Set to 0 for zero-rake promo. */
  HOLDER_RAKE: 0.015,
  /** Minimum wager in $BlackBalls. */
  MIN_BET: 0.01,
  /** Max bet without holding $BlackBalls. */
  MAX_BET: 100,
  /** Max bet for $BlackBalls holders. */
  HOLDER_MAX_BET: 500,
  /** Dogpile round length before auto-flip (seconds). */
  DOGPILE_ROUND_SEC: 30,
  /** Coin flip animation duration (ms). */
  FLIP_ANIM_MS: 3200,
  /** 1v1 wait before instant bot fill (demo / low traffic). */
  BOT_MATCH_MS: 400,
  /** History entries kept. */
  MAX_HISTORY: 100,
  /** Hall of fame threshold (profit BB). */
  HOF_MIN_PROFIT: 50,
  DEFAULT_CLIENT_SEED: 'blackballs-flip',
} as const;

export function flipRakeRate(holdsBlackballs: boolean): number {
  return holdsBlackballs ? FLIP_CONFIG.HOLDER_RAKE : FLIP_CONFIG.BASE_RAKE;
}

export function flipMaxBet(holdsBlackballs: boolean): number {
  return holdsBlackballs ? FLIP_CONFIG.HOLDER_MAX_BET : FLIP_CONFIG.MAX_BET;
}

export function rakeLabel(rate: number): string {
  return `${(rate * 100).toFixed(rate < 0.01 ? 1 : 1)}%`.replace('.0%', '%');
}
