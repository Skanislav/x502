// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {Attestations} from "../src/lib/Attestations.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {MockGitHubFactProvider} from "../src/mocks/MockGitHubFactProvider.sol";

contract BountyVaultTest is Test {
    BountyVault internal vault;
    MockUSDC internal usdc;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;

    address internal repoOwner = makeAddr("repoOwner");
    address internal claimant = makeAddr("claimant");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant N_AGENTS = 3;
    uint256[] internal agentIds;
    uint256[] internal agentKeys;
    address[] internal agentWallets;

    bytes32 internal constant REPO_ID = keccak256("github.com/x502-protocol/demo");
    uint256 internal constant DEPOSIT = 1_000_000_000; // $1000 (6dp)
    uint256 internal constant OUTCOME_FEE = 100_000; // $0.10 per verifier

    BountyVault.Prices internal defaultPrices = BountyVault.Prices({
        report: 5_000_000, // $5
        triage: 2_000_000, // $2
        fix: 50_000_000, // $50
        docsTests: 30_000_000 // $30
    });

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockAgentRegistry();
        factProvider = new MockGitHubFactProvider();
        vault = new BountyVault(IERC20(address(usdc)), registry, factProvider);

        // 3 verifier agent identities
        agentIds = new uint256[](N_AGENTS);
        agentKeys = new uint256[](N_AGENTS);
        agentWallets = new address[](N_AGENTS);
        for (uint256 i; i < N_AGENTS; ++i) {
            string memory label = string.concat("agent", vm.toString(i));
            (address w, uint256 k) = makeAddrAndKey(label);
            agentIds[i] = 100 + i;
            agentKeys[i] = k;
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

    function test_configure_setsOwnerAndPrices() public view {
        assertEq(vault.repoOwnerOf(REPO_ID), repoOwner);
        assertEq(vault.balanceOf(REPO_ID), DEPOSIT);
        assertEq(vault.priceOf(REPO_ID, BountyVault.Kind.Fix), defaultPrices.fix);
        assertEq(vault.priceOf(REPO_ID, BountyVault.Kind.Triage), defaultPrices.triage);
    }

    function test_payout_happyPath_kindFix() public {
        uint256 externalId = 42;
        BountyVault.Kind kind = BountyVault.Kind.Fix;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(kind));

        // Oracle delivers the fact
        bytes memory factBlob =
            abi.encode(uint8(1), uint64(123_456), bytes32(uint256(0xABCD)), claimant);
        factProvider.mockFulfill(cid, factBlob);

        // Two of three agents sign
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

    // ---------- dedup / replay ----------

    function test_payout_revertsOnReplay() public {
        _payFix(42);

        // Build a duplicate payout call inline so vm.expectRevert anchors on vault.payout.
        bytes32 cid = Attestations.claimId(REPO_ID, 42, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });
        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);

        vm.expectRevert(abi.encodeWithSelector(BountyVault.AlreadyPaid.selector, cid));
        vault.payout(
            REPO_ID, 42, BountyVault.Kind.Fix, claimant, deadline, keccak256(factBlob), ids, sigs
        );
    }

    // ---------- signature checks ----------

    function test_payout_revertsBelowThreshold() public {
        uint256 externalId = 7;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });

        uint256[] memory ids = new uint256[](1);
        ids[0] = agentIds[0];
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = _sign(agentKeys[0], att);

        vm.expectRevert(BountyVault.InsufficientSignatures.selector);
        vault.payout(
            REPO_ID,
            externalId,
            BountyVault.Kind.Fix,
            claimant,
            deadline,
            keccak256(factBlob),
            ids,
            sigs
        );
    }

    function test_payout_revertsOnDuplicateSigners() public {
        uint256 externalId = 8;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });

        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[0]; // dup
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[0], att);

        vm.expectRevert(abi.encodeWithSelector(BountyVault.DuplicateSigner.selector, agentIds[0]));
        vault.payout(
            REPO_ID,
            externalId,
            BountyVault.Kind.Fix,
            claimant,
            deadline,
            keccak256(factBlob),
            ids,
            sigs
        );
    }

    function test_payout_revertsOnUntrustedSigner() public {
        uint256 externalId = 9;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 untrustedId = 999;
        (address w, uint256 k) = makeAddrAndKey("untrusted");
        registry.setAgentWallet(untrustedId, w);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });

        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = untrustedId;
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(k, att);

        vm.expectRevert(abi.encodeWithSelector(BountyVault.UntrustedAgent.selector, untrustedId));
        vault.payout(
            REPO_ID,
            externalId,
            BountyVault.Kind.Fix,
            claimant,
            deadline,
            keccak256(factBlob),
            ids,
            sigs
        );
    }

    function test_payout_revertsOnInvalidSignature() public {
        uint256 externalId = 10;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });

        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[2], att); // claims to be agent1, signed by agent2

        vm.expectRevert(abi.encodeWithSelector(BountyVault.InvalidSignature.selector, agentIds[1]));
        vault.payout(
            REPO_ID,
            externalId,
            BountyVault.Kind.Fix,
            claimant,
            deadline,
            keccak256(factBlob),
            ids,
            sigs
        );
    }

    // ---------- fact gating ----------

    function test_payout_revertsWhenFactNotReady() public {
        uint256 externalId = 11;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        // intentionally do NOT fulfill

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 factHash = keccak256("anything");
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: factHash
        });

        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);

        vm.expectRevert(BountyVault.FactNotReady.selector);
        vault.payout(
            REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, ids, sigs
        );
    }

    function test_payout_revertsOnFactHashMismatch() public {
        uint256 externalId = 12;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        factProvider.mockFulfill(cid, abi.encode(uint8(1), uint64(0), bytes32(0), claimant));

        bytes32 wrongFactHash = keccak256("different");
        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: wrongFactHash
        });

        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);

        vm.expectRevert(BountyVault.FactHashMismatch.selector);
        vault.payout(
            REPO_ID, externalId, BountyVault.Kind.Fix, claimant, deadline, wrongFactHash, ids, sigs
        );
    }

    // ---------- deadline ----------

    function test_payout_revertsAfterDeadline() public {
        uint256 externalId = 13;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });

        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);

        vm.warp(deadline + 1);
        vm.expectRevert(BountyVault.DeadlineExpired.selector);
        vault.payout(
            REPO_ID,
            externalId,
            BountyVault.Kind.Fix,
            claimant,
            deadline,
            keccak256(factBlob),
            ids,
            sigs
        );
    }

    // ---------- balance ----------

    function test_payout_revertsOnInsufficientBalance() public {
        // Drain repo to below fix price
        vm.startPrank(repoOwner);
        vault.withdraw(REPO_ID, DEPOSIT - defaultPrices.fix + 1);
        vm.stopPrank();

        uint256 externalId = 14;
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });
        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);

        vm.expectRevert(BountyVault.InsufficientRepoBalance.selector);
        vault.payout(
            REPO_ID,
            externalId,
            BountyVault.Kind.Fix,
            claimant,
            deadline,
            keccak256(factBlob),
            ids,
            sigs
        );
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

    // ---------- helpers ----------

    function _sign(uint256 key, Attestations.Attestation memory att)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = vault.hashAttestation(att);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _payFix(uint256 externalId) internal {
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        if (!_isReady(cid)) factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });
        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);

        vault.payout(
            REPO_ID,
            externalId,
            BountyVault.Kind.Fix,
            claimant,
            deadline,
            keccak256(factBlob),
            ids,
            sigs
        );
    }

    function _isReady(bytes32 cid) internal view returns (bool ready) {
        (ready,) = factProvider.getFact(cid);
    }
}
