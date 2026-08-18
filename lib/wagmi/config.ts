'use client';

import { createConfig, http } from 'wagmi';
import { injected } from '@wagmi/core';
import { mainnet, base, polygon, arbitrum, optimism, bsc } from 'wagmi/chains';
// Relative path bypasses package exports so we don't load the Coinbase/Base barrel.
// @ts-expect-error deep file import — not in @wagmi/connectors public exports
import { walletConnect } from '../../node_modules/@wagmi/connectors/dist/esm/walletConnect.js';
import { robinhoodChain } from '@/lib/wagmi/chains';
import { getPublicRpcUrl } from '@/lib/chain/public-config';
import { getWalletConnectProjectId } from '@/lib/wallet-connect-ux';
import { REQUIRE_GAME_CHAIN } from '@/lib/launch-surface';

const walletConnectProjectId = getWalletConnectProjectId();

/** Popular networks so WalletConnect does not treat Robinhood as the only allowed chain. */
const identityChains = [mainnet, base, polygon, arbitrum, optimism, bsc, robinhoodChain] as const;

const connectors = [
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
];

export const wagmiConfig = REQUIRE_GAME_CHAIN
  ? createConfig({
      chains: [robinhoodChain],
      connectors,
      transports: {
        [robinhoodChain.id]: http(getPublicRpcUrl()),
      },
      ssr: true,
    })
  : createConfig({
      chains: identityChains,
      connectors,
      transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [polygon.id]: http(),
        [arbitrum.id]: http(),
        [optimism.id]: http(),
        [bsc.id]: http(),
        [robinhoodChain.id]: http(getPublicRpcUrl()),
      },
      ssr: true,
    });

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
