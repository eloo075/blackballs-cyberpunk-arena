'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { WalletProvider } from '@/lib/wallet-context';
import { wagmiConfig } from '@/lib/wagmi/config';
import { WagmiWalletBridge } from '@/components/wagmi-wallet-bridge';
import { ReferralUrlCapture } from '@/components/referral-url-capture';
import { CrashSpectatorProvider } from '@/components/crash-spectator-provider';
import { SpectatorToastHost } from '@/components/SpectatorToastHost';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <CrashSpectatorProvider>
            <ReferralUrlCapture />
            <WagmiWalletBridge />
            <SpectatorToastHost />
            {children}
          </CrashSpectatorProvider>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
