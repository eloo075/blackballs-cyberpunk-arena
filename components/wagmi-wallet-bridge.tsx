'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';
import { useWallet } from '@/lib/wallet-context';
import { DEMO_REWARDS_MODE } from '@/lib/launch-surface';
import { isVaultConfigured } from '@/lib/chain/public-config';
import { useReferralCapture } from '@/hooks/use-referral-capture';
import { robinhoodChain } from '@/lib/wagmi/chains';
import { WrongNetworkBanner } from '@/components/wrong-network-banner';

/** Sync wagmi wallet into game wallet context when vault mode is active. */
export function WagmiWalletBridge() {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { wallet, connectRealWallet, disconnect, setBlackballsBalance } = useWallet();
  const switchAttemptedFor = useRef<string | null>(null);

  useReferralCapture(isConnected ? address : undefined);

  useEffect(() => {
    if (!DEMO_REWARDS_MODE && !isVaultConfigured()) return;
    if (!isConnected || !address) return;
    if (wallet.address !== address || !wallet.isRealWallet) {
      connectRealWallet(address);
    }
    void fetch('/api/crash/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, boot: true }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && typeof data.balance === 'number') {
          setBlackballsBalance(data.balance);
        }
      })
      .catch(() => {
        /* session sync is best-effort on connect */
      });
  }, [isConnected, address, wallet.address, wallet.isRealWallet, connectRealWallet, setBlackballsBalance]);

  useEffect(() => {
    if (!DEMO_REWARDS_MODE && !isVaultConfigured()) return;
    if (!isConnected || !address || chainId == null || chainId === robinhoodChain.id || !switchChain) {
      return;
    }
    const key = `${address}:${chainId}`;
    if (switchAttemptedFor.current === key) return;
    switchAttemptedFor.current = key;
    switchChain({ chainId: robinhoodChain.id });
  }, [isConnected, address, chainId, switchChain]);

  useEffect(() => {
    if (!DEMO_REWARDS_MODE && !isVaultConfigured()) return;
    if (isConnected || !wallet.isRealWallet) return;
    disconnect();
  }, [isConnected, wallet.isRealWallet, disconnect]);

  useEffect(() => {
    if (!DEMO_REWARDS_MODE && !isVaultConfigured()) return;
    if (!wallet.isRealWallet || wallet.connected) return;
    wagmiDisconnect();
  }, [wallet.isRealWallet, wallet.connected, wagmiDisconnect]);

  return <WrongNetworkBanner />;
}
