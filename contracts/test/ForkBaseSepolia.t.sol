// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {AttestationRequest, AttestationRequestData, IEAS} from "../src/interfaces/IEAS.sol";
import {Attestations} from "../src/lib/Attestations.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {MockGitHubFactProvider} from "../src/mocks/MockGitHubFactProvider.sol";

/// @title  Fork tests — Base Sepolia.
/// @notice Drives the same happy-path the in-memory test exercises, but
///         against the real USDC contract AND the real EAS contract on
///         Base Sepolia. The mock agent registry + mock fact provider stay
///         (they aren't in fork scope).
///
///         Skipped automatically if `BASE_SEPOLIA_RPC_URL` is unset, so this
///         file is safe to commit and run in CI without network access.
///         To run locally:
///           BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
///             forge test --match-contract ForkBaseSepolia -vvv
contract ForkBaseSepoliaTest is Test {
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    /// EAS deployed by Optimism + Base across all Superchain L2s at this
    /// predeployed address. https://docs.attest.org/docs/quick--start/contracts
    address internal constant EAS_BASE_SEPOLIA = 0x4200000000000000000000000000000000000021;

    /// Schema UID for our x502 attestation schema. The deploy script registers
    /// the schema once per chain via SchemaRegistry; here we hard-code a
    /// placeholder UID and the test just verifies it round-trips through the
    /// vault's storage. The full schema-registry round trip is covered by a
    /// separate integration test; what matters here is that the vault talks
    /// to the real EAS contract correctly.
    bytes32 internal constant SCHEMA_UID =
        0x4f9ca77f49adb91dba80a37edcfdfd3a572cd7e3893afba98e9b76e35d33a73a;

    BountyVault internal vault;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;

    address internal repoOwner = makeAddr("repoOwner");
    address internal claimant = makeAddr("claimant");

    bytes32 internal constant REPO_ID = keccak256("github.com/skanislav/x502");
    uint256 internal constant DEPOSIT = 1_000_000_000;
    uint256 internal constant OUTCOME_FEE = 100_000;

    BountyVault.Prices internal defaultPrices = BountyVault.Prices({
        report: 5_000_000,
        triage: 2_000_000,
        fix: 50_000_000,
        docsTests: 30_000_000
    });

    uint256[] internal agentIds;
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
        vault = new BountyVault(
            IERC20(USDC_BASE_SEPOLIA), registry, factProvider, IEAS(EAS_BASE_SEPOLIA), SCHEMA_UID
        );

        for (uint256 i; i < 3; ++i) {
            address w = makeAddr(string.concat("agent", vm.toString(i)));
            agentIds.push(100 + i);
            agentWallets.push(w);
            registry.setAgentWallet(100 + i, w);
        }

        vm.prank(repoOwner);
        vault.configureRepo(REPO_ID, agentIds, 2, defaultPrices, OUTCOME_FEE);

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

        // Attest under the vault's schema via the real EAS contract.
        // Note: the schema must already exist in EAS's SchemaRegistry on
        // Base Sepolia for these calls to succeed. The deploy script handles
        // registration in production; for the fork test we expect the env to
        // have been pre-configured (see deploy/eas-register.ts).
        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        IERC20 usdc = IERC20(USDC_BASE_SEPOLIA);
        uint256 priorClaimant = usdc.balanceOf(claimant);
        uint256 priorAgent0 = usdc.balanceOf(agentWallets[0]);
        uint256 priorAgent1 = usdc.balanceOf(agentWallets[1]);

        vault.payout(REPO_ID, externalId, kind, claimant, deadline, factHash, uids);

        assertEq(usdc.balanceOf(agentWallets[0]) - priorAgent0, OUTCOME_FEE, "agent0 fee");
        assertEq(usdc.balanceOf(agentWallets[1]) - priorAgent1, OUTCOME_FEE, "agent1 fee");
        assertEq(
            usdc.balanceOf(claimant) - priorClaimant,
            defaultPrices.fix - 2 * OUTCOME_FEE,
            "claimant payout"
        );
        assertEq(vault.balanceOf(REPO_ID), DEPOSIT - defaultPrices.fix, "repo balance debited");
        assertTrue(vault.isPaid(cid), "claim marked paid");
    }

    function test_fork_usdcMetadata() public view {
        (bool ok, bytes memory data) =
            USDC_BASE_SEPOLIA.staticcall(abi.encodeWithSignature("decimals()"));
        require(ok, "decimals() call failed");
        assertEq(abi.decode(data, (uint8)), 6);
    }

    function _attest(address attester, bytes32 cid, bytes32 factHash, bool accept)
        internal
        returns (bytes32 uid)
    {
        AttestationRequestData memory data = AttestationRequestData({
            recipient: address(0),
            expirationTime: 0,
            revocable: true,
            refUID: bytes32(0),
            data: abi.encode(cid, factHash, accept),
            value: 0
        });
        AttestationRequest memory req = AttestationRequest({schema: SCHEMA_UID, data: data});
        vm.prank(attester);
        uid = IEAS(EAS_BASE_SEPOLIA).attest(req);
    }
}
