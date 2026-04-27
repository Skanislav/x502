// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {Attestations} from "../src/lib/Attestations.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {MockGitHubFactProvider} from "../src/mocks/MockGitHubFactProvider.sol";

/// @title  Fork tests — Base Sepolia.
/// @notice Drives the same happy-path the in-memory test exercises, but
///         against the real USDC contract on Base Sepolia. The mock agent
///         registry + mock fact provider stay (registering on the real
///         ERC-8004 + the Chainlink Functions DON callback aren't in fork
///         scope; those are unit-tested elsewhere).
///
///         Skipped automatically if `BASE_SEPOLIA_RPC_URL` is unset, so this
///         file is safe to commit and run in CI without network access.
///         To run locally:
///           BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
///             forge test --match-contract ForkBaseSepolia -vvv
contract ForkBaseSepoliaTest is Test {
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    BountyVault internal vault;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;

    address internal repoOwner = makeAddr("repoOwner");
    address internal claimant = makeAddr("claimant");

    bytes32 internal constant REPO_ID = keccak256("github.com/skanislav/x502");
    uint256 internal constant DEPOSIT = 1_000_000_000; // $1000 (6dp)
    uint256 internal constant OUTCOME_FEE = 100_000; // $0.10 per verifier

    BountyVault.Prices internal defaultPrices = BountyVault.Prices({
        report: 5_000_000, triage: 2_000_000, fix: 50_000_000, docsTests: 30_000_000
    });

    uint256[] internal agentIds;
    uint256[] internal agentKeys;
    address[] internal agentWallets;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);

        registry = new MockAgentRegistry();
        factProvider = new MockGitHubFactProvider();
        vault = new BountyVault(IERC20(USDC_BASE_SEPOLIA), registry, factProvider);

        for (uint256 i; i < 3; ++i) {
            string memory label = string.concat("agent", vm.toString(i));
            (address w, uint256 k) = makeAddrAndKey(label);
            agentIds.push(100 + i);
            agentKeys.push(k);
            agentWallets.push(w);
            registry.setAgentWallet(100 + i, w);
        }

        vm.prank(repoOwner);
        vault.configureRepo(REPO_ID, agentIds, 2, defaultPrices, OUTCOME_FEE);

        // Mint real USDC to the repo owner via the storage-poke cheatcode.
        // For Circle USDC on Base Sepolia, the balance mapping is at slot 9 of
        // the proxy's storage layout; forge's `deal` cheatcode handles that
        // automatically by binary-searching the layout.
        deal(USDC_BASE_SEPOLIA, repoOwner, DEPOSIT);

        vm.startPrank(repoOwner);
        IERC20(USDC_BASE_SEPOLIA).approve(address(vault), type(uint256).max);
        vault.deposit(REPO_ID, DEPOSIT);
        vm.stopPrank();
    }

    function test_fork_payout_happyPath_kindFix() public {
        uint256 externalId = 42;
        BountyVault.Kind kind = BountyVault.Kind.Fix;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(kind));

        bytes memory factBlob =
            abi.encode(uint8(1), uint64(123_456), bytes32(uint256(0xABCD)), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 30 minutes;
        bytes32 factHash = keccak256(factBlob);
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: factHash
        });

        uint256[] memory signingAgents = new uint256[](2);
        signingAgents[0] = agentIds[0];
        signingAgents[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);

        IERC20 usdc = IERC20(USDC_BASE_SEPOLIA);
        uint256 priorClaimant = usdc.balanceOf(claimant);
        uint256 priorAgent0 = usdc.balanceOf(agentWallets[0]);
        uint256 priorAgent1 = usdc.balanceOf(agentWallets[1]);

        vault.payout(REPO_ID, externalId, kind, claimant, deadline, factHash, signingAgents, sigs);

        assertEq(usdc.balanceOf(agentWallets[0]) - priorAgent0, OUTCOME_FEE, "agent0 fee");
        assertEq(usdc.balanceOf(agentWallets[1]) - priorAgent1, OUTCOME_FEE, "agent1 fee");
        assertEq(
            usdc.balanceOf(claimant) - priorClaimant,
            defaultPrices.fix - 2 * OUTCOME_FEE,
            "claimant payout = price - sum(outcomeFees)"
        );
        assertEq(vault.balanceOf(REPO_ID), DEPOSIT - defaultPrices.fix, "repo balance debited");
        assertTrue(vault.isPaid(cid), "claim marked paid");
    }

    function test_fork_usdcMetadata() public view {
        // Sanity: real USDC on Base Sepolia is 6 decimals.
        // We use a low-level static call to keep the test independent of any
        // ERC20Detailed import surface.
        (bool ok, bytes memory data) =
            USDC_BASE_SEPOLIA.staticcall(abi.encodeWithSignature("decimals()"));
        require(ok, "decimals() call failed");
        assertEq(abi.decode(data, (uint8)), 6);
    }

    function _sign(uint256 key, Attestations.Attestation memory att)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = vault.hashAttestation(att);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
