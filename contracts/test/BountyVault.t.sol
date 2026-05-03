// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {AttestationRequest, AttestationRequestData, IEAS} from "../src/interfaces/IEAS.sol";
import {Attestations} from "../src/lib/Attestations.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {MockEAS} from "../src/mocks/MockEAS.sol";
import {MockGitHubFactProvider} from "../src/mocks/MockGitHubFactProvider.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Unit tests for the EAS-driven settlement path. Each verifier
///         identity attests to (claimId, factHash, accept=true) under the
///         vault's global schemaUID; vault.payout takes the attestation
///         UIDs, fetches them via getAttestation, validates content + trust
///         + dedup, and settles.
contract BountyVaultTest is Test {
    BountyVault internal vault;
    MockUSDC internal usdc;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;
    MockEAS internal eas;

    address internal repoOwner = makeAddr("repoOwner");
    address internal claimant = makeAddr("claimant");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant N_AGENTS = 3;
    uint256[] internal agentIds;
    address[] internal agentWallets;

    bytes32 internal constant REPO_ID = keccak256("github.com/x502-protocol/demo");
    bytes32 internal constant SCHEMA_UID =
        keccak256("x502:bytes32 claimId,bytes32 factHash,bool accept");
    uint256 internal constant DEPOSIT = 1_000_000_000;
    uint256 internal constant OUTCOME_FEE = 100_000;

    BountyVault.Prices internal defaultPrices = BountyVault.Prices({
        report: 5_000_000,
        triage: 2_000_000,
        fix: 50_000_000,
        docsTests: 30_000_000
    });

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockAgentRegistry();
        factProvider = new MockGitHubFactProvider();
        eas = new MockEAS();
        vault = new BountyVault(
            IERC20(address(usdc)), registry, factProvider, IEAS(address(eas)), SCHEMA_UID
        );

        agentIds = new uint256[](N_AGENTS);
        agentWallets = new address[](N_AGENTS);
        for (uint256 i; i < N_AGENTS; ++i) {
            string memory label = string.concat("agent", vm.toString(i));
            address w = makeAddr(label);
            agentIds[i] = 100 + i;
            agentWallets[i] = w;
            registry.setAgentWallet(agentIds[i], w);
        }

        vm.prank(repoOwner);
        vault.configureRepo(REPO_ID, agentIds, 2, defaultPrices, OUTCOME_FEE);

        usdc.mint(repoOwner, DEPOSIT);
        vm.startPrank(repoOwner);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(REPO_ID, DEPOSIT);
        vm.stopPrank();
    }

    // ---------- happy path ----------

    function test_payout_happyPath_kindFix() public {
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

    function test_payout_isPermissionless() public {
        uint256 externalId = 99;
        BountyVault.Kind kind = BountyVault.Kind.Fix;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(kind));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        // A random unrelated address can call payout — vault has no caller gating.
        vm.prank(stranger);
        vault.payout(REPO_ID, externalId, kind, claimant, deadline, factHash, uids);
        assertTrue(vault.isPaid(cid));
    }

    // ---------- replay / dedup ----------

    function test_payout_revertsOnReplay() public {
        uint256 externalId = 42;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);

        bytes32[] memory uids2 = new bytes32[](2);
        uids2[0] = _attest(agentWallets[0], cid, factHash, true);
        uids2[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.expectRevert(abi.encodeWithSelector(BountyVault.AlreadyPaid.selector, cid));
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids2);
    }


    function test_payout_revertsOnDuplicateAttester() public {
        uint256 externalId = 8;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[0], cid, factHash, true); // same attester twice

        vm.expectRevert(
            abi.encodeWithSelector(BountyVault.DuplicateAttester.selector, agentWallets[0])
        );
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsBelowThreshold() public {
        uint256 externalId = 7;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](1);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);

        vm.expectRevert(BountyVault.InsufficientAttestations.selector);
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsOnUntrustedAttester() public {
        uint256 externalId = 9;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        address rogue = makeAddr("rogue");
        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(rogue, cid, factHash, true);

        vm.expectRevert(abi.encodeWithSelector(BountyVault.UntrustedAttester.selector, rogue));
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    // ---------- attestation content ----------

    function test_payout_revertsOnWrongSchema() public {
        uint256 externalId = 10;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 wrongSchema = keccak256("not-x502");
        bytes32 uidWrong = _attestRaw(agentWallets[0], wrongSchema, cid, factHash, true);

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = uidWrong;

        vm.expectRevert(abi.encodeWithSelector(BountyVault.WrongSchema.selector, wrongSchema));
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsOnRevokedAttestation() public {
        uint256 externalId = 11;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 uid0 = _attest(agentWallets[0], cid, factHash, true);
        bytes32 uid1 = _attest(agentWallets[1], cid, factHash, true);

        // Agent 1 changes their mind and revokes.
        vm.prank(agentWallets[1]);
        eas.revoke(SCHEMA_UID, uid1);

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = uid0;
        uids[1] = uid1;
        vm.expectRevert(abi.encodeWithSelector(BountyVault.AttestationRevoked.selector, uid1));
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsOnDeclinedAttestation() public {
        uint256 externalId = 12;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 uid0 = _attest(agentWallets[0], cid, factHash, true);
        bytes32 uidNo = _attest(agentWallets[1], cid, factHash, false); // accept = false

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = uid0;
        uids[1] = uidNo;
        vm.expectRevert(abi.encodeWithSelector(BountyVault.AttestationDeclined.selector, uidNo));
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsOnAttestationFactMismatch() public {
        uint256 externalId = 13;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 stale = keccak256("old fact");
        bytes32 uidStale = _attest(agentWallets[1], cid, stale, true);
        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = uidStale;

        vm.expectRevert(
            abi.encodeWithSelector(BountyVault.AttestationFactMismatch.selector, uidStale)
        );
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsOnAttestationClaimMismatch() public {
        uint256 externalId = 14;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 wrongClaim = keccak256("wrong-claim");
        bytes32 uidWrong = _attest(agentWallets[1], wrongClaim, factHash, true);
        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = uidWrong;

        vm.expectRevert(
            abi.encodeWithSelector(BountyVault.AttestationClaimMismatch.selector, uidWrong)
        );
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsOnUnknownAttestation() public {
        uint256 externalId = 15;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 fake = keccak256("never-attested");
        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = fake;

        vm.expectRevert(abi.encodeWithSelector(BountyVault.UnknownAttestation.selector, fake));
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    // ---------- fact gating ----------

    function test_payout_revertsWhenFactNotReady() public {
        uint256 externalId = 16;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        // intentionally do NOT fulfill
        bytes32 factHash = keccak256("anything");
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.expectRevert(BountyVault.FactNotReady.selector);
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsWhenFactStatusZero() public {
        uint256 externalId = 17;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(0), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.expectRevert(abi.encodeWithSelector(BountyVault.FactStatusNotOk.selector, uint8(0)));
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsWhenMergeMissingForFix() public {
        uint256 externalId = 18;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.expectRevert(BountyVault.FactMergeMissing.selector);
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_allowsZeroMergedBlockForReportKind() public {
        uint256 externalId = 19;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Report));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        uint256 priorClaimant = usdc.balanceOf(claimant);
        vault.payout(
            REPO_ID, externalId, BountyVault.Kind.Report, claimant, deadline, factHash, uids
        );
        assertEq(
            usdc.balanceOf(claimant) - priorClaimant,
            defaultPrices.report - 2 * OUTCOME_FEE,
            "report paid despite mergedBlock=0"
        );
    }

    function test_payout_revertsOnFactHashMismatch() public {
        uint256 externalId = 20;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 wrongFactHash = keccak256("different");
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, wrongFactHash, true);
        uids[1] = _attest(agentWallets[1], cid, wrongFactHash, true);

        vm.expectRevert(BountyVault.FactHashMismatch.selector);
        vault.payout(
            REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, wrongFactHash, uids
        );
    }

    // ---------- deadline / balance ----------

    function test_payout_revertsAfterDeadline() public {
        uint256 externalId = 21;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.warp(deadline + 1);
        vm.expectRevert(BountyVault.DeadlineExpired.selector);
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    function test_payout_revertsOnInsufficientBalance() public {
        vm.startPrank(repoOwner);
        vault.withdraw(REPO_ID, DEPOSIT - defaultPrices.fix + 1);
        vm.stopPrank();

        uint256 externalId = 22;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.expectRevert(BountyVault.InsufficientRepoBalance.selector);
        vault.payout(REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    // ---------- access control ----------

    function test_configure_revertsOnReconfigureByStranger() public {
        uint256[] memory empty = new uint256[](0);
        BountyVault.Prices memory zero = BountyVault.Prices(0, 0, 0, 0);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.NotRepoOwner.selector);
        vault.configureRepo(REPO_ID, empty, 1, zero, 0);
    }

    function test_withdraw_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(BountyVault.NotRepoOwner.selector);
        vault.withdraw(REPO_ID, 1);
    }

    // ---------- recipient binding ----------

    /// @notice The fact's `ghAuthorBinding` is the wallet committed to in the
    ///         GH issue body (`<!-- x502:0xWALLET -->`). Because `payout` is
    ///         permissionless, anyone with threshold UIDs would otherwise be
    ///         able to call it with their own recipient and steal the bounty.
    ///         The vault must reject any caller-supplied recipient that
    ///         doesn't match the binding.
    function test_payout_revertsWhenRecipientDiffersFromAuthorBinding() public {
        uint256 externalId = 23;
        BountyVault.Kind kind = BountyVault.Kind.Fix;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(kind));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        // Stranger tries to redirect the payout to themselves.
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(BountyVault.RecipientNotBound.selector, stranger, claimant)
        );
        vault.payout(REPO_ID, externalId, kind, stranger, deadline, factHash, uids);
    }

    function test_payout_revertsWhenAuthorBindingIsZero() public {
        uint256 externalId = 24;
        BountyVault.Kind kind = BountyVault.Kind.Fix;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(kind));
        // No binding marker in the GH body → ghAuthorBinding decodes as zero.
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), address(0));
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.expectRevert(
            abi.encodeWithSelector(BountyVault.RecipientNotBound.selector, claimant, address(0))
        );
        vault.payout(REPO_ID, externalId, kind, claimant, deadline, factHash, uids);
    }

    // ---------- helpers ----------

    /// @dev Attest under the vault's expected schema with (claimId, factHash, accept).
    function _attest(address attester, bytes32 cid, bytes32 factHash, bool accept)
        internal
        returns (bytes32 uid)
    {
        return _attestRaw(attester, SCHEMA_UID, cid, factHash, accept);
    }

    /// @dev Variant that lets callers force a different schema (negative-path tests).
    function _attestRaw(
        address attester,
        bytes32 schema,
        bytes32 cid,
        bytes32 factHash,
        bool accept
    ) internal returns (bytes32 uid) {
        AttestationRequestData memory data = AttestationRequestData({
            recipient: address(0),
            expirationTime: 0,
            revocable: true,
            refUID: bytes32(0),
            data: abi.encode(cid, factHash, accept),
            value: 0
        });
        AttestationRequest memory req = AttestationRequest({schema: schema, data: data});
        vm.prank(attester);
        uid = eas.attest(req);
    }
}
