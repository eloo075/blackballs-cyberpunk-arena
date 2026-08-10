/** Truncated display name used on chart trade tags (must match server pushTag). */
export function playerMarkerName(address: string): string {
  if (!address) return 'PLAYER';
  if (address.startsWith('0x') && address.length > 10) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  const clean = address.replace(/^demo[-_:]?/i, '');
  return clean.length > 12 ? `${clean.slice(0, 10)}…` : clean || 'PLAYER';
}
