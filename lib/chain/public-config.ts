/** Client-safe chain + contract addresses (NEXT_PUBLIC_* only). */

export function isVaultConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CRASH_VAULT_ADDRESS &&
      process.env.NEXT_PUBLIC_BLACKBALLS_TOKEN_ADDRESS &&
      process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL,
  );
}

export function getPublicVaultAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_CRASH_VAULT_ADDRESS;
  if (!addr?.startsWith('0x')) return null;
  return addr as `0x${string}`;
}

export function getPublicTokenAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_BLACKBALLS_TOKEN_ADDRESS;
  if (!addr?.startsWith('0x')) return null;
  return addr as `0x${string}`;
}

export function getPublicChainId(): number {
  return Number(process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_ID ?? 46630);
}

export function getPublicRpcUrl(): string {
  return process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? 'https://rpc.robinhood.chain';
}

export function getPublicTokenDecimals(): number {
  return Number(process.env.NEXT_PUBLIC_BLACKBALLS_DECIMALS ?? 18);
}
