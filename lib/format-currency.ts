/** Visible currency label across Crash, Flip, and Arena UI. */
export const CURRENCY_LABEL = 'BlackBalls';

export function formatAmount(amount: number, decimals = 3): string {
  return amount.toFixed(decimals);
}

export function withCurrency(amount: number, decimals = 3): string {
  return `${formatAmount(amount, decimals)} ${CURRENCY_LABEL}`;
}
