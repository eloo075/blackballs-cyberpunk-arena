'use client';

import { createConfig, http } from 'wagmi';
import { injected } from '@wagmi/core';
import { robinhoodChain } from '@/lib/wagmi/chains';
import { getPublicRpcUrl } from '@/lib/chain/public-config';

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [injected()],
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
