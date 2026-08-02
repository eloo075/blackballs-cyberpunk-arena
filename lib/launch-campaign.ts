/** Launch campaign — temporary site lock for First 500 whitelist. */

export const LAUNCH_CAMPAIGN_SPOTS = 500;

export function isLaunchCampaignActive(): boolean {
  return process.env.NEXT_PUBLIC_LAUNCH_CAMPAIGN === 'true';
}

/** Server-side guard (also set LAUNCH_CAMPAIGN=true without NEXT_PUBLIC_ if needed). */
export function isLaunchCampaignLocked(): boolean {
  return (
    process.env.LAUNCH_CAMPAIGN === 'true' ||
    process.env.NEXT_PUBLIC_LAUNCH_CAMPAIGN === 'true'
  );
}

export function normalizeCampaignWallet(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function shortenWallet(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
