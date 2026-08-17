/** Demo / play-money credits — off-chain only. Never priced in USD. Never withdrawable. */
export const DEMO_STARTING_BB = 10_000;
export const DEMO_REFILL_BB = 10_000;
export const DEMO_MIN_BALANCE = 1;
/** Daily refill is allowed only when liquid credits are at or below this. */
export const DEMO_REFILL_ELIGIBLE_BELOW = 100;
export const DEMO_REFILL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MAX_NEW_ACCOUNTS_PER_IP_PER_DAY = 3;

/** True for a never-played empty account that should receive DEMO_STARTING_BB. */
export function shouldGrantStartingCredits(account: {
  balance: number;
  roundsPlayed?: number;
  hasPosition?: boolean;
  entryPending?: boolean;
}): boolean {
  if (account.hasPosition || account.entryPending) return false;
  if ((account.roundsPlayed ?? 0) > 0) return false;
  return !Number.isFinite(account.balance) || account.balance <= 0;
}
