import { defineChain } from 'viem';
import { getPublicChainId, getPublicRpcUrl } from '@/lib/chain/public-config';

export const robinhoodChain = defineChain({
  id: getPublicChainId(),
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [getPublicRpcUrl()] },
  },
});
