/**
 * Deploy CrashVault to Robinhood Chain using viem.
 *
 * Prerequisites:
 *   1. cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
 *   2. forge build
 *   3. npm install viem dotenv (in project root)
 *
 * Environment (.env):
 *   ROBINHOOD_RPC_URL=https://rpc.robinhood.chain  (your L2 RPC)
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   BLACKBALLS_TOKEN_ADDRESS=0x...
 *   HOUSE_TREASURY_ADDRESS=0x...
 *   BACKEND_SIGNER_ADDRESS=0x...
 *   BURN_VIA_NATIVE=false
 *
 * Run:
 *   npx tsx scripts/deploy-crash-vault.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

const ARTIFACT_PATH = path.join(
  process.cwd(),
  'contracts',
  'out',
  'CrashVault.sol',
  'CrashVault.json',
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function loadArtifact(): { abi: readonly unknown[]; bytecode: Hex } {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(
      `Artifact not found at ${ARTIFACT_PATH}. Run: cd contracts && forge build`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  return { abi: raw.abi, bytecode: raw.bytecode.object as Hex };
}

async function main() {
  const rpcUrl = requireEnv('ROBINHOOD_RPC_URL');
  const privateKey = requireEnv('DEPLOYER_PRIVATE_KEY') as Hex;
  const tokenAddress = requireEnv('BLACKBALLS_TOKEN_ADDRESS') as Hex;
  const treasuryAddress = requireEnv('HOUSE_TREASURY_ADDRESS') as Hex;
  const backendSigner = requireEnv('BACKEND_SIGNER_ADDRESS') as Hex;
  const burnViaNative = process.env.BURN_VIA_NATIVE === 'true';

  const robinhoodChain = defineChain({
    id: Number(process.env.ROBINHOOD_CHAIN_ID ?? 46630),
    name: 'Robinhood Chain',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(rpcUrl),
  });

  const { abi, bytecode } = loadArtifact();

  console.log('Deploying CrashVault...');
  console.log('  Deployer:       ', account.address);
  console.log('  Token:          ', tokenAddress);
  console.log('  Treasury:       ', treasuryAddress);
  console.log('  Backend signer: ', backendSigner);
  console.log('  Burn mode:      ', burnViaNative ? 'native burn()' : 'DEAD address');

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [tokenAddress, treasuryAddress, backendSigner, burnViaNative],
  });

  console.log('  Tx hash:        ', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const vaultAddress = receipt.contractAddress;

  if (!vaultAddress) {
    throw new Error('Deployment failed — no contract address in receipt');
  }

  console.log('\nCrashVault deployed at:', vaultAddress);
  console.log('Block:', receipt.blockNumber.toString());

  const vaultAbi = parseAbi([
    'function blackballsToken() view returns (address)',
    'function houseTreasury() view returns (address)',
    'function backendSigner() view returns (address)',
    'function BURN_BPS() view returns (uint256)',
  ]);

  const [token, treasury, signer, burnBps] = await publicClient.multicall({
    contracts: [
      { address: vaultAddress, abi: vaultAbi, functionName: 'blackballsToken' },
      { address: vaultAddress, abi: vaultAbi, functionName: 'houseTreasury' },
      { address: vaultAddress, abi: vaultAbi, functionName: 'backendSigner' },
      { address: vaultAddress, abi: vaultAbi, functionName: 'BURN_BPS' },
    ],
  });

  console.log('\nOn-chain verification:');
  console.log('  blackballsToken:', token.result);
  console.log('  houseTreasury:  ', treasury.result);
  console.log('  backendSigner:  ', signer.result);
  console.log('  BURN_BPS:       ', burnBps.result?.toString(), '(3000 = 30%)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
