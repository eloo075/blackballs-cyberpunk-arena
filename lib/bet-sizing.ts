/** USD-first bet sizing — convert to BlackBalls at display / input time only. */

export const FALLBACK_USD_PER_TOKEN = 0.00042;

/** Quick-pick wager sizes in USD (min ~$0.25, normal $1–$25). */
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

export function defaultBetAmount(usdPerToken: number = FALLBACK_USD_PER_TOKEN): number {
  const bb = usdToTokens(BET_USD_DEFAULT, usdPerToken);
  return bb > 0 ? bb : 0.01;
}

/** Pick a default wager that never exceeds the player's balance (demo-safe). */
export function affordableBetAmount(usdPerToken: number, balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0.01;
  const ideal = usdToTokens(BET_USD_DEFAULT, usdPerToken);
  const minimum = Math.min(usdToTokens(BET_USD_MIN, usdPerToken), balance);
  /** Never default to full balance — use ~10% or $0.25 worth, whichever is smaller. */
  const softCap = Math.min(balance, Math.max(1, Math.min(usdToTokens(0.25, usdPerToken), balance * 0.1)));
  let pick = Math.min(Math.max(ideal, minimum), softCap);
  if (pick <= 0) pick = Math.min(0.01, balance);
  if (pick > balance) pick = balance;
  return Math.floor(pick * 1000) / 1000;
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
