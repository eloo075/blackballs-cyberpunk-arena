'use client';

import { useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWallet } from '@/lib/wallet-context';
import { isVaultConfigured } from '@/lib/chain/public-config';
import { useReferralCapture } from '@/hooks/use-referral-capture';

/** Sync wagmi wallet into game wallet context when vault mode is active. */
export function WagmiWalletBridge() {
  const { address, isConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { wallet, connectRealWallet, disconnect } = useWallet();

  useReferralCapture(isConnected ? address : undefined);

  useEffect(() => {
    if (!isVaultConfigured()) return;
    if (!isConnected || !address) return;
    if (wallet.address === address && wallet.isRealWallet) return;
    connectRealWallet(address);
    void fetch('/api/crash/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, balance: 0, stimmy: 0, frenzy: 0 }),
    }).catch(() => {
      /* session sync is best-effort on connect */
    });
  }, [isConnected, address, wallet.address, wallet.isRealWallet, connectRealWallet]);

  useEffect(() => {
    if (!isVaultConfigured()) return;
    if (isConnected || !wallet.isRealWallet) return;
    disconnect();
  }, [isConnected, wallet.isRealWallet, disconnect]);

  useEffect(() => {
    if (!isVaultConfigured()) return;
    if (!wallet.isRealWallet || wallet.connected) return;
    wagmiDisconnect();
  }, [wallet.isRealWallet, wallet.connected, wagmiDisconnect]);

  return null;
}
