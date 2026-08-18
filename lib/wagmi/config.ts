'use client';

import { createConfig, http } from 'wagmi';
import { injected } from '@wagmi/core';
// Relative path bypasses package exports so we don't load the Coinbase/Base barrel.
// @ts-expect-error deep file import — not in @wagmi/connectors public exports
import { walletConnect } from '../../node_modules/@wagmi/connectors/dist/esm/walletConnect.js';
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
