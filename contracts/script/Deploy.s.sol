// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {GitHubFactReceiver} from "../src/GitHubFactReceiver.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IGitHubFactProvider} from "../src/interfaces/IGitHubFactProvider.sol";

/// @title  Deploy script for Base Sepolia (chainId 84532).
/// @dev    Reads env:
///           PRIVATE_KEY               — deployer + repo owner key
///           BASE_SEPOLIA_RPC_URL      — RPC endpoint
///           CHAINLINK_SUBSCRIPTION_ID — Functions sub funded with LINK
///           FUNCTIONS_SOURCE_PATH     — chainlink/source.js (read via vm.readFile)
///           SECRETS_SLOT_ID           — DON-hosted secrets slot (default 0)
///           SECRETS_VERSION           — DON-hosted secrets version (0 = unused)
///           AUTHORIZER                — coordinator wallet allowed to call requestFact
///         Usage:
///           forge script script/Deploy.s.sol \
///             --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
contract Deploy is Script {
    // Base Sepolia (chainId 84532) external addresses
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant FUNCTIONS_ROUTER_BASE_SEPOLIA = 0xf9B8fc078197181C841c296C876945aaa425B278;
    address constant ERC8004_IDENTITY_BASE_SEPOLIA = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    bytes32 constant DON_ID_BASE_SEPOLIA = bytes32("fun-base-sepolia-1");

    function run() external returns (BountyVault vault, GitHubFactReceiver factReceiver) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        uint64 subId = uint64(vm.envUint("CHAINLINK_SUBSCRIPTION_ID"));
        uint8 secretsSlotId = uint8(vm.envOr("SECRETS_SLOT_ID", uint256(0)));
        uint64 secretsVersion = uint64(vm.envOr("SECRETS_VERSION", uint256(0)));
        address authorizer = vm.envOr("AUTHORIZER", deployer);

        string memory sourcePath =
            vm.envOr("FUNCTIONS_SOURCE_PATH", string("../chainlink/source.js"));
        string memory source = vm.readFile(sourcePath);

        vm.startBroadcast(deployerKey);

        factReceiver = new GitHubFactReceiver(FUNCTIONS_ROUTER_BASE_SEPOLIA, deployer);
        factReceiver.setSource(source);
        factReceiver.setConfig({
            subscriptionId: subId,
            callbackGasLimit: 300_000,
            donId: DON_ID_BASE_SEPOLIA,
            secretsSlotId: secretsSlotId,
            secretsVersion: secretsVersion
        });
        factReceiver.setAuthorizer(authorizer);

        vault = new BountyVault(
            IERC20(USDC_BASE_SEPOLIA),
            IAgentRegistry(ERC8004_IDENTITY_BASE_SEPOLIA),
            IGitHubFactProvider(address(factReceiver))
        );

        vm.stopBroadcast();

        console2.log("Network          : Base Sepolia (84532)");
        console2.log("Deployer         :", deployer);
        console2.log("BountyVault      :", address(vault));
        console2.log("GitHubFactReceiver:", address(factReceiver));
        console2.log("USDC             :", USDC_BASE_SEPOLIA);
        console2.log("ERC-8004 Registry:", ERC8004_IDENTITY_BASE_SEPOLIA);
        console2.log("Functions Router :", FUNCTIONS_ROUTER_BASE_SEPOLIA);
        console2.log("Subscription ID  :", subId);
        console2.log("Authorizer       :", authorizer);
        console2.log("");
        console2.log("Add the receiver as a consumer of the subscription:");
        console2.log("  npx @chainlink/functions-toolkit subscription add-consumer \\");
        console2.log("    --subId", subId, "\\");
        console2.log("    --consumer", address(factReceiver));
    }
}
