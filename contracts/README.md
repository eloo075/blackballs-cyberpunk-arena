# CrashVault — Robinhood Chain

Solidity escrow + deflationary burn for the Blackballs crash game.

## Setup

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-commit
forge build
```

## Deploy (Foundry)

```bash
export ROBINHOOD_RPC_URL="https://your-robinhood-l2-rpc"
export DEPLOYER_PRIVATE_KEY="0x..."
export BLACKBALLS_TOKEN_ADDRESS="0x..."
export HOUSE_TREASURY_ADDRESS="0x..."
export BACKEND_SIGNER_ADDRESS="0x..."
export BURN_VIA_NATIVE="false"

forge script script/DeployCrashVault.s.sol:DeployCrashVault \
  --rpc-url $ROBINHOOD_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

## Deploy (viem / TypeScript)

From project root:

```bash
npm install viem dotenv tsx
npx tsx scripts/deploy-crash-vault.ts
```

## Contract API

| Function | Caller | Description |
|----------|--------|-------------|
| `depositWager(amount)` | Player | Approve + escrow $BLACKBALLS |
| `withdrawSession(amount)` | Player | Return unused escrow |
| `payoutWin(player, amount)` | Backend signer | Cash-out payout |
| `processLoss(player, amount, reason)` | Backend signer | Rug / liquidation → 30% burn, 70% treasury |
| `collectRake(amount)` | Backend signer | Rake fee split |

## Events (index these)

- `WagerPlaced(player, amount, newSessionBalance)`
- `PayoutIssued(player, amount, authorizedBy)`
- `PlayerLossProcessed(player, amount, burned, toTreasury, reason)`
- `TokensBurned(amount, viaNativeBurn)`
- `TreasuryFunded(treasury, amount)`

## Security notes

- Rotate `backendSigner` via `setBackendSigner` (owner only).
- Use a dedicated hot wallet for the backend — never the deployer key.
- Prefer a multisig as `owner` on mainnet.
- Set `BURN_VIA_NATIVE=true` only if `$BLACKBALLS` implements `burn(uint256)`.
