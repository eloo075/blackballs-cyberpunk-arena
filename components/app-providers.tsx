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
import { CompetitiveProvider } from '@/hooks/use-competitive';
import { AchievementToastHost } from '@/components/achievement-toast-host';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <CompetitiveProvider>
            <CrashSpectatorProvider>
              <ReferralUrlCapture />
              <WagmiWalletBridge />
              <SpectatorToastHost />
              <AchievementToastHost />
              {children}
            </CrashSpectatorProvider>
          </CompetitiveProvider>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
