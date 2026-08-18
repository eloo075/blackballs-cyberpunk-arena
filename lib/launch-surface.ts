/** Launch surface flags — flip these to restore Arena / live Flip without deleting code. */

export const ARENA_ENABLED = false;
export const FLIP_PLAYABLE = false;
export const RANKING_TAB_ENABLED = true;

/**
 * Play-money Crash + weekly prize board. Real tokens are never deposited,
 * withdrawn, or converted from credits. Prizes are paid off-platform after review.
 */
export const DEMO_REWARDS_MODE = true;

/** When true, wallets must be on Robinhood Chain. Off in demo-rewards (address is identity only). */
export const REQUIRE_GAME_CHAIN = !DEMO_REWARDS_MODE;

/** Fake chart/feed players. Off for public launch — only real connected wallets. */
export const SIMULATED_CRASH_PLAYERS = false;

export const FLIP_UNAVAILABLE_MESSAGE = 'Flip is not available yet.';
