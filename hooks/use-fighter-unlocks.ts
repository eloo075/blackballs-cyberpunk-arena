'use client';

import { useEffect, useMemo } from 'react';
import { useCrashVault } from '@/hooks/useCrashVault';
import { useWallet } from '@/lib/wallet-context';
import { isVaultConfigured } from '@/lib/chain/public-config';
import {
  getFighterUnlockRequirement,
  isFighterUnlocked,
} from '@/lib/fighter-unlocks';
import type { Fighter } from '@/lib/fighters';

/** On-chain + escrow balance for token-gated fighters; refreshes after vault txs. */
export function useFighterUnlocks() {
  const { wallet } = useWallet();
  const vault = useCrashVault();
  const vaultEnabled = isVaultConfigured();

  useEffect(() => {
    if (vaultEnabled && vault.isConnected) {
      void vault.refreshBalances();
    }
  }, [vaultEnabled, vault.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const blackballsBalance = useMemo(() => {
    if (vaultEnabled && vault.isConnected) {
      return vault.walletBalance + vault.sessionBalance;
    }
    return wallet.blackballsBalance;
  }, [
    vaultEnabled,
    vault.isConnected,
    vault.walletBalance,
    vault.sessionBalance,
    wallet.blackballsBalance,
  ]);

  const checkUnlocked = (fighter: Fighter) =>
    isFighterUnlocked(fighter, blackballsBalance);

  const getRequirement = (fighter: Fighter) => getFighterUnlockRequirement(fighter);

  return {
    blackballsBalance,
    vaultEnabled,
    isConnected: wallet.connected || vault.isConnected,
    checkUnlocked,
    getRequirement,
    refreshBalances: vault.refreshBalances,
  };
}
