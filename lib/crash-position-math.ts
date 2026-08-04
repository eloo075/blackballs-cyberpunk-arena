/** Minimum live margin (BB) — below this we close fully instead of leaving dust. */
export const MIN_LIVE_POSITION_BB = 0.01;

export function splitPartialCashout(
  margin: number,
  percent: number,
): { closeMargin: number; remaining: number; fullClose: boolean } {
  const pct = Math.min(1, Math.max(0.01, percent));
  let closeMargin = parseFloat((margin * pct).toFixed(3));
  let remaining = parseFloat((margin - closeMargin).toFixed(3));

  if (pct >= 0.999) {
    return { closeMargin: margin, remaining: 0, fullClose: true };
  }

  if (remaining > 0 && remaining < MIN_LIVE_POSITION_BB) {
    closeMargin = margin;
    remaining = 0;
    return { closeMargin, remaining, fullClose: true };
  }

  if (closeMargin <= 0) {
    return { closeMargin: 0, remaining: margin, fullClose: false };
  }

  return { closeMargin, remaining, fullClose: false };
}
