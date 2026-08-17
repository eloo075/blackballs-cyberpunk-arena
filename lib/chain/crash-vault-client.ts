/**
 * Server-only CrashVault settlement client (Robinhood Chain / viem).
 * Never import this module from client components.
 */
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CRASH_VAULT_ABI } from './crash-vault-abi';
import {
  getBlackballsDecimals,
  getCrashVaultAddress,
  getRobinhoodChain,
} from './robinhood-chain';
import { DEMO_REWARDS_MODE } from '@/lib/launch-surface';

export interface SettlementResult {
  ok: boolean;
  skipped?: boolean;
  txHash?: Hash;
  error?: string;
  gasUsed?: bigint;
}

export interface SettlementAction {
  type: 'payout' | 'loss';
  player: string;
  /** Human-readable token amount (e.g. 10.5 $BLACKBALLS). */
  amount: number;
  reason?: string;
}

let publicClient: PublicClient | null = null;
let walletClient: WalletClient | null = null;
let vaultAddress: Address | null = null;

export function isVaultEnabled(): boolean {
  if (DEMO_REWARDS_MODE) return false;
  return Boolean(
    process.env.CRASH_VAULT_ADDRESS &&
      process.env.BACKEND_SIGNER_PRIVATE_KEY &&
      process.env.ROBINHOOD_RPC_URL,
  );
}

/** Demo / off-chain wallets — never send on-chain settlement for these. */
export function isOnChainPlayer(address: string): boolean {
  return address.startsWith('0x') && address.length === 42;
}

function shouldSettleOnChain(playerAddress: string): boolean {
  return isVaultEnabled() && isOnChainPlayer(playerAddress);
}

function getPublicClient(): PublicClient {
  if (!publicClient) {
    const chain = getRobinhoodChain();
    publicClient = createPublicClient({
      chain,
      transport: http(process.env.ROBINHOOD_RPC_URL!, { timeout: 15_000 }),
    });
  }
  return publicClient;
}

function getWalletClient(): WalletClient {
  if (!walletClient) {
    const pk = process.env.BACKEND_SIGNER_PRIVATE_KEY;
    if (!pk?.startsWith('0x')) {
      throw new Error('BACKEND_SIGNER_PRIVATE_KEY is missing or invalid');
    }
    const chain = getRobinhoodChain();
    const account = privateKeyToAccount(pk as `0x${string}`);
    walletClient = createWalletClient({
      account,
      chain,
      transport: http(process.env.ROBINHOOD_RPC_URL!, { timeout: 15_000 }),
    });
  }
  return walletClient;
}

function getVault(): Address {
  if (!vaultAddress) {
    vaultAddress = getCrashVaultAddress();
  }
  return vaultAddress;
}

export function toTokenWei(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return BigInt(0);
  const decimals = getBlackballsDecimals();
  return parseUnits(amount.toFixed(Math.min(decimals, 8)), decimals);
}

export function fromTokenWei(amount: bigint): number {
  return parseFloat(formatUnits(amount, getBlackballsDecimals()));
}

function normalizePlayerAddress(address: string): Address {
  if (!address.startsWith('0x') || address.length !== 42) {
    throw new Error(`Invalid player address: ${address}`);
  }
  return address as Address;
}

async function assertNetworkHealthy(): Promise<void> {
  const client = getPublicClient();
  const blockNumber = await client.getBlockNumber();
  if (blockNumber <= BigInt(0)) {
    throw new Error('Robinhood RPC returned invalid block number');
  }

  const gasPrice = await client.getGasPrice();
  if (gasPrice <= BigInt(0)) {
    throw new Error('Robinhood RPC returned invalid gas price');
  }
}

async function sendPayout(player: Address, amount: bigint): Promise<SettlementResult> {
  if (!isVaultEnabled()) return { ok: true, skipped: true };

  try {
    await assertNetworkHealthy();
    const client = getWalletClient();
    const pub = getPublicClient();
    const vault = getVault();
    const account = client.account;
    if (!account) throw new Error('Backend signer account unavailable');

    const { request } = await pub.simulateContract({
      account,
      address: vault,
      abi: CRASH_VAULT_ABI,
      functionName: 'payoutWin',
      args: [player, amount],
    });

    const txHash = await client.writeContract(request);
    console.info(`[CrashVault] payoutWin submitted tx=${txHash}`);

    const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    if (receipt.status !== 'success') {
      return { ok: false, txHash, error: 'transaction reverted' };
    }

    console.info(`[CrashVault] payoutWin confirmed tx=${txHash} gas=${receipt.gasUsed.toString()}`);
    return { ok: true, txHash, gasUsed: receipt.gasUsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown settlement error';
    console.error('[CrashVault] payoutWin failed:', message);
    return { ok: false, error: message };
  }
}

async function sendLoss(player: Address, amount: bigint, reason: string): Promise<SettlementResult> {
  if (!isVaultEnabled()) return { ok: true, skipped: true };

  try {
    await assertNetworkHealthy();
    const client = getWalletClient();
    const pub = getPublicClient();
    const vault = getVault();
    const account = client.account;
    if (!account) throw new Error('Backend signer account unavailable');

    const { request } = await pub.simulateContract({
      account,
      address: vault,
      abi: CRASH_VAULT_ABI,
      functionName: 'processLoss',
      args: [player, amount, reason],
    });

    const txHash = await client.writeContract(request);
    console.info(`[CrashVault] processLoss submitted tx=${txHash} reason=${reason}`);

    const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    if (receipt.status !== 'success') {
      return { ok: false, txHash, error: 'transaction reverted' };
    }

    console.info(`[CrashVault] processLoss confirmed tx=${txHash} gas=${receipt.gasUsed.toString()}`);
    return { ok: true, txHash, gasUsed: receipt.gasUsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown settlement error';
    console.error('[CrashVault] processLoss failed:', message);
    return { ok: false, error: message };
  }
}

/** Read on-chain escrow session balance for a player. */
export async function getSessionBalance(playerAddress: string): Promise<bigint> {
  if (!isVaultEnabled()) return BigInt(0);

  const player = normalizePlayerAddress(playerAddress);
  const balance = await getPublicClient().readContract({
    address: getVault(),
    abi: CRASH_VAULT_ABI,
    functionName: 'sessionBalanceOf',
    args: [player],
  });

  return balance;
}

/** Verify player has enough escrow before opening a wager. */
export async function verifyEscrowForWager(
  playerAddress: string,
  wagerAmount: number,
): Promise<{ ok: boolean; error?: string; sessionBalance?: number }> {
  if (!shouldSettleOnChain(playerAddress)) {
    return { ok: true };
  }

  try {
    await assertNetworkHealthy();
    const required = toTokenWei(wagerAmount);
    const available = await getSessionBalance(playerAddress);

    if (available < required) {
      return {
        ok: false,
        error: 'insufficient vault escrow — deposit $BLACKBALLS first',
        sessionBalance: fromTokenWei(available),
      };
    }

    return { ok: true, sessionBalance: fromTokenWei(available) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'vault connectivity error';
    return { ok: false, error: message };
  }
}

/** Authorize payoutWin on CrashVault. */
export async function executePayout(
  playerAddress: string,
  amount: bigint,
): Promise<SettlementResult> {
  if (amount <= BigInt(0)) return { ok: true, skipped: true };

  const player = normalizePlayerAddress(playerAddress);
  return sendPayout(player, amount);
}

/** Authorize processLoss on CrashVault (30% burn / 70% treasury). */
export async function executeLoss(
  playerAddress: string,
  amount: bigint,
  reason: string,
): Promise<SettlementResult> {
  if (amount <= BigInt(0)) return { ok: true, skipped: true };

  const player = normalizePlayerAddress(playerAddress);
  return sendLoss(player, amount, reason);
}

/** Dispatch a game-level settlement action. */
export async function processSettlement(action: SettlementAction): Promise<SettlementResult> {
  if (!shouldSettleOnChain(action.player)) {
    return { ok: true, skipped: true };
  }

  const wei = toTokenWei(action.amount);
  if (action.type === 'payout') {
    return executePayout(action.player, wei);
  }
  return executeLoss(action.player, wei, action.reason ?? 'LOSS');
}

/** Fire-and-forget settlement for tick-loop events (rug / liquidation). */
export function dispatchSettlement(action: SettlementAction): void {
  if (!shouldSettleOnChain(action.player)) {
    return;
  }

  void processSettlement(action)
    .then(result => {
      if (!result.ok && !result.skipped) {
        console.error('[CrashVault] async settlement failed', action, result.error);
      }
    })
    .catch(err => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[CrashVault] async settlement error', action, message);
    });
}
