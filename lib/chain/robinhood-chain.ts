import { defineChain } from 'viem';

export function getRobinhoodChain() {
  const rpcUrl = process.env.ROBINHOOD_RPC_URL;
  if (!rpcUrl) {
    throw new Error('ROBINHOOD_RPC_URL is not configured');
  }

  return defineChain({
    id: Number(process.env.ROBINHOOD_CHAIN_ID ?? 46630),
    name: 'Robinhood Chain',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });
}

export function getBlackballsDecimals(): number {
  return Number(process.env.BLACKBALLS_DECIMALS ?? 18);
}

export function getCrashVaultAddress(): `0x${string}` {
  const address = process.env.CRASH_VAULT_ADDRESS;
  if (!address || !address.startsWith('0x')) {
    throw new Error('CRASH_VAULT_ADDRESS is not configured');
  }
  return address as `0x${string}`;
}
