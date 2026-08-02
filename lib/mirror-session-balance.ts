import 'server-only';

import { getManager } from '@/lib/crash-manager';
import { getFlipManager } from '@/lib/flip-manager';

/** Keep Flip server balance aligned after Crash balance changes. */
export function mirrorCrashBalanceToFlip(address: string, balance: number): void {
  if (!address || address === 'BOT') return;
  getFlipManager().applyPeerBalance(address, balance);
}

/** Keep Crash server balance aligned after Flip balance changes. */
export function mirrorFlipBalanceToCrash(address: string, balance: number): void {
  if (!address || address === 'BOT') return;
  getManager().applyPeerBalance(address, balance);
}
