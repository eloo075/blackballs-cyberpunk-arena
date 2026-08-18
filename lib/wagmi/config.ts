'use client';

import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { robinhoodChain } from '@/lib/wagmi/chains';
import { getPublicRpcUrl } from '@/lib/chain/public-config';
import { getWalletConnectProjectId } from '@/lib/wallet-connect-ux';

const walletConnectProjectId = getWalletConnectProjectId();

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
              name: 'BlackBalls',
              description: 'Degen Arcade',
              url: 'https://game.blackballs.site',
              icons: ['https://game.blackballs.site/blackballs-logo-transparent.png'],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [robinhoodChain.id]: http(getPublicRpcUrl()),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
