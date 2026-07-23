// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CrashVault} from "../src/CrashVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Foundry deploy script for Robinhood Chain.
 *
 * Usage:
 *   cd contracts
 *   forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-commit
 *   forge script script/DeployCrashVault.s.sol:DeployCrashVault \
 *     --rpc-url $ROBINHOOD_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 */
contract DeployCrashVault is Script {
    function run() external {
        address token = vm.envAddress("BLACKBALLS_TOKEN_ADDRESS");
        address treasury = vm.envAddress("HOUSE_TREASURY_ADDRESS");
        address backendSigner = vm.envAddress("BACKEND_SIGNER_ADDRESS");
        bool burnViaNative = vm.envOr("BURN_VIA_NATIVE", bool(false));

        vm.startBroadcast();

        CrashVault vault = new CrashVault(
            IERC20(token),
            treasury,
            backendSigner,
            burnViaNative
        );

        vm.stopBroadcast();

        console2.log("CrashVault deployed at:", address(vault));
        console2.log("BLACKBALLS token:", token);
        console2.log("House treasury:", treasury);
        console2.log("Backend signer:", backendSigner);
        console2.log("Burn via native burn():", burnViaNative);
    }
}
