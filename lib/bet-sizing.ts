/** USD-first bet sizing — convert to BlackBalls at display / input time only. */

export const FALLBACK_USD_PER_TOKEN = 0.00042;

/** Suggested / preset reference wager in BlackBalls (not the initial field value). */
export const DEFAULT_BET_BB = 1000;
/** Minimum openable wager — 0 / leading-zero drafts cannot buy. */
export const MIN_BET_BB = 1;

/** Quick-pick wager sizes in BlackBalls. */
export const BET_BB_PRESETS = [100, 500, 1000, 2500, 5000] as const;

/** Quick-pick wager sizes in USD (legacy helpers / display). */
export const BET_USD_PRESETS = [0.25, 1, 5, 10, 25] as const;

export const BET_USD_DEFAULT = 1;
export const BET_USD_MIN = 0.1;

export function usdToTokens(usd: number, usdPerToken: number): number {
  if (!Number.isFinite(usd) || usd <= 0 || usdPerToken <= 0) return 0;
  const tokens = usd / usdPerToken;
  return Math.floor(tokens * 1000) / 1000;
}

export function tokensToUsd(tokens: number, usdPerToken: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0 || usdPerToken <= 0) return 0;
  return tokens * usdPerToken;
}

/** Initial wager on enter — always 0; player must type or pick an amount. */
export function defaultBetAmount(_usdPerToken: number = FALLBACK_USD_PER_TOKEN): number {
  void _usdPerToken;
  return 0;
}

/** Initial affordable wager — 0 until the player chooses an amount. */
export function affordableBetAmount(_usdPerToken: number, balance: number): number {
  void _usdPerToken;
  void balance;
  return 0;
}

/** True when the typed wager can open a position (rejects 0 / drafts starting with 0). */
export function isBuyableWagerDraft(draft: string, amount: number): boolean {
  const t = draft.trim();
  if (!t || t === '.') return false;
  // "0", "0.5", "00", etc. — any draft that starts with 0 is not buyable.
  if (t.startsWith('0')) return false;
  if (!Number.isFinite(amount) || amount < MIN_BET_BB) return false;
  return true;
}

export function clampBetToBalance(amount: number, balance: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.floor(Math.min(amount, balance) * 1000) / 1000;
}

/** Smart decimals for token amounts (large counts at low token prices). */
export function betAmountDecimals(usdPerToken: number): number {
  if (usdPerToken <= 0) return 3;
  const oneDollar = usdToTokens(1, usdPerToken);
  if (oneDollar >= 10_000) return 0;
  if (oneDollar >= 1_000) return 1;
  if (oneDollar >= 100) return 2;
  return 3;
}

export function formatBetUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.00';
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

export function formatBetTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return '0';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 10_000) return `${(tokens / 1_000).toFixed(1)}K`;
  if (tokens >= 1_000) return tokens.toFixed(0);
  if (tokens >= 1) return tokens.toFixed(2);
  if (tokens >= 0.01) return tokens.toFixed(3);
  return tokens.toFixed(4);
}

export function formatUsdPreset(usd: number): string {
  if (usd >= 1) return `$${usd}`;
  return `$${usd.toFixed(2)}`;
}
