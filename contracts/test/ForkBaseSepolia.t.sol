// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {AttestationRequest, AttestationRequestData, IEAS} from "../src/interfaces/IEAS.sol";
import {ISchemaRegistry} from "../src/interfaces/ISchemaRegistry.sol";
import {Attestations} from "../src/lib/Attestations.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {MockGitHubFactProvider} from "../src/mocks/MockGitHubFactProvider.sol";

/// @title  Fork tests — Base Sepolia.
/// @notice Drives the same happy-path the in-memory test exercises, but
///         against the real USDC + real EAS predeploys on Base Sepolia.
///         Registers the x502 schema in EAS's SchemaRegistry as part of
///         setUp (idempotent — SchemaRegistry returns the existing UID via
///         getSchema if already registered).
///
///         Skipped automatically if `BASE_SEPOLIA_RPC_URL` is unset, so this
///         file is safe to commit and run in CI without network access.
///         To run locally:
///           BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
///             forge test --match-contract ForkBaseSepolia -vvv
contract ForkBaseSepoliaTest is Test {
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    /// EAS + SchemaRegistry are both Optimism predeploys on Base + Base
    /// Sepolia at sequential addresses. https://docs.attest.org/
    address internal constant EAS_BASE_SEPOLIA = 0x4200000000000000000000000000000000000021;
    address internal constant SCHEMA_REGISTRY_BASE_SEPOLIA =
        0x4200000000000000000000000000000000000020;

    /// Canonical x502 schema string. Vault rejects attestations under any
    /// other schemaUID.
    string internal constant X502_SCHEMA = "bytes32 claimId,bytes32 factHash,bool accept";

    BountyVault internal vault;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;
    bytes32 internal schemaUID;

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

        // Register the x502 schema (idempotent — try-then-read).
        schemaUID = _ensureSchemaRegistered();

        registry = new MockAgentRegistry();
        factProvider = new MockGitHubFactProvider();
        vault = new BountyVault(
            IERC20(USDC_BASE_SEPOLIA), registry, factProvider, IEAS(EAS_BASE_SEPOLIA), schemaUID
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

    function _ensureSchemaRegistered() internal returns (bytes32 uid) {
        ISchemaRegistry reg = ISchemaRegistry(SCHEMA_REGISTRY_BASE_SEPOLIA);
        // EAS computes the UID as keccak256(abi.encodePacked(schema, resolver, revocable)).
        uid = keccak256(abi.encodePacked(X502_SCHEMA, address(0), true));
        // Already registered? then we're done.
        if (reg.getSchema(uid).uid == uid) return uid;
        // Otherwise register. Returns the same UID computed above.
        try reg.register(X502_SCHEMA, address(0), true) returns (bytes32 actual) {
            require(actual == uid, "schema UID mismatch after register");
        } catch {
            // Race-on-fork edge case: someone else registered in the same
            // block. Re-check.
            require(reg.getSchema(uid).uid == uid, "schema register failed");
        }
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
        AttestationRequest memory req = AttestationRequest({schema: schemaUID, data: data});
        vm.prank(attester);
        uid = IEAS(EAS_BASE_SEPOLIA).attest(req);
    }
}
