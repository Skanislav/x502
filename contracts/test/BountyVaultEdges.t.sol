// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {Attestations} from "../src/lib/Attestations.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {MockGitHubFactProvider} from "../src/mocks/MockGitHubFactProvider.sol";

/// Edge cases on top of BountyVault.t.sol — paid-event emission shape,
/// all-N-of-N signing, and cross-repo collision protection.
contract BountyVaultEdgesTest is Test {
    BountyVault internal vault;
    MockUSDC internal usdc;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;

    address internal claimant = makeAddr("claimant");
    address internal otherClaimant = makeAddr("otherClaimant");

    uint256 internal constant N_AGENTS = 3;
    uint256[] internal agentIds;
    uint256[] internal agentKeys;
    address[] internal agentWallets;

    bytes32 internal constant REPO_A = keccak256("github.com/owner/repo-a");
    bytes32 internal constant REPO_B = keccak256("github.com/owner/repo-b");
    uint256 internal constant DEPOSIT = 1_000_000_000;
    uint256 internal constant OUTCOME_FEE = 100_000;

    BountyVault.Prices internal prices = BountyVault.Prices({
        report: 5_000_000, triage: 2_000_000, fix: 50_000_000, docsTests: 30_000_000
    });

    /// Re-declare the vault's events at the test-contract level so vm.expectEmit
    /// can match them — solc requires the typed selector come from a contract
    /// that declares it.
    event Paid(
        bytes32 indexed claimId,
        bytes32 indexed repoId,
        BountyVault.Kind kind,
        address recipient,
        uint256 amount,
        uint256[] agentIds
    );

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockAgentRegistry();
        factProvider = new MockGitHubFactProvider();
        vault = new BountyVault(IERC20(address(usdc)), registry, factProvider);

        agentIds = new uint256[](N_AGENTS);
        agentKeys = new uint256[](N_AGENTS);
        agentWallets = new address[](N_AGENTS);
        for (uint256 i; i < N_AGENTS; ++i) {
            (address w, uint256 k) = makeAddrAndKey(string.concat("agent", vm.toString(i)));
            agentIds[i] = 200 + i;
            agentKeys[i] = k;
            agentWallets[i] = w;
            registry.setAgentWallet(agentIds[i], w);
        }

        // Two repos owned by separate addresses; each funded with $1000.
        _configureAndFund(REPO_A, makeAddr("ownerA"));
        _configureAndFund(REPO_B, makeAddr("ownerB"));
    }

    // ---------- payment math: all-N-of-N sign ----------

    function test_payout_allNSign_paysEveryVerifier() public {
        uint256 externalId = 1;
        BountyVault.Kind kind = BountyVault.Kind.Fix;
        bytes32 cid = Attestations.claimId(REPO_A, externalId, uint8(kind));

        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);

        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
        });

        bytes[] memory sigs = new bytes[](N_AGENTS);
        for (uint256 i; i < N_AGENTS; ++i) {
            sigs[i] = _sign(agentKeys[i], att);
        }

        vault.payout(
            REPO_A, externalId, kind, claimant, deadline, keccak256(factBlob), agentIds, sigs
        );

        // Every verifier got their fee
        for (uint256 i; i < N_AGENTS; ++i) {
            assertEq(usdc.balanceOf(agentWallets[i]), OUTCOME_FEE, "all verifiers paid");
        }
        assertEq(
            usdc.balanceOf(claimant),
            prices.fix - N_AGENTS * OUTCOME_FEE,
            "claimant gets price - sum(fees)"
        );
    }

    // ---------- event emission ----------

    function test_payout_emitsPaidEvent() public {
        uint256 externalId = 2;
        BountyVault.Kind kind = BountyVault.Kind.Fix;
        bytes32 cid = Attestations.claimId(REPO_A, externalId, uint8(kind));
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

        vm.expectEmit(true, true, false, true, address(vault));
        emit Paid(cid, REPO_A, kind, claimant, prices.fix - 2 * OUTCOME_FEE, ids);

        vault.payout(REPO_A, externalId, kind, claimant, deadline, keccak256(factBlob), ids, sigs);
    }

    // ---------- cross-repo collision protection ----------

    function test_sameExternalIdAndKind_acrossRepos_doesNotCollide() public {
        // Same externalId + kind in two different repos must produce different
        // claimIds (because repoId is part of the hash) and thus not trip the
        // one-shot fuse on the second payout.
        uint256 externalId = 99;
        BountyVault.Kind kind = BountyVault.Kind.Fix;

        bytes32 cidA = Attestations.claimId(REPO_A, externalId, uint8(kind));
        bytes32 cidB = Attestations.claimId(REPO_B, externalId, uint8(kind));
        assertTrue(cidA != cidB, "claimIds must differ across repos");

        _payHappy(REPO_A, externalId, claimant);
        _payHappy(REPO_B, externalId, otherClaimant);

        assertTrue(vault.isPaid(cidA));
        assertTrue(vault.isPaid(cidB));
        assertEq(usdc.balanceOf(claimant), prices.fix - 2 * OUTCOME_FEE);
        assertEq(usdc.balanceOf(otherClaimant), prices.fix - 2 * OUTCOME_FEE);
    }

    // ---------- claimId derivation: kind isolation ----------

    function test_sameExternalIdDifferentKind_doesNotCollide() public {
        // Same repo + same externalId, different kinds → different claimIds,
        // both can be paid.
        uint256 externalId = 7;
        bytes32 cidFix = Attestations.claimId(REPO_A, externalId, uint8(BountyVault.Kind.Fix));
        bytes32 cidDocs =
            Attestations.claimId(REPO_A, externalId, uint8(BountyVault.Kind.DocsTests));
        assertTrue(cidFix != cidDocs);

        _payHappyKind(REPO_A, externalId, BountyVault.Kind.Fix, claimant);
        _payHappyKind(REPO_A, externalId, BountyVault.Kind.DocsTests, claimant);

        assertTrue(vault.isPaid(cidFix));
        assertTrue(vault.isPaid(cidDocs));
        assertEq(
            usdc.balanceOf(claimant),
            (prices.fix - 2 * OUTCOME_FEE) + (prices.docsTests - 2 * OUTCOME_FEE)
        );
    }

    // ---------- helpers ----------

    function _configureAndFund(bytes32 repoId, address owner) internal {
        vm.prank(owner);
        vault.configureRepo(repoId, agentIds, 2, prices, OUTCOME_FEE);

        usdc.mint(owner, DEPOSIT);
        vm.startPrank(owner);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(repoId, DEPOSIT);
        vm.stopPrank();
    }

    function _payHappy(bytes32 repoId, uint256 externalId, address recipient) internal {
        _payHappyKind(repoId, externalId, BountyVault.Kind.Fix, recipient);
    }

    function _payHappyKind(
        bytes32 repoId,
        uint256 externalId,
        BountyVault.Kind kind,
        address recipient
    ) internal {
        bytes32 cid = Attestations.claimId(repoId, externalId, uint8(kind));
        bytes memory factBlob = abi.encode(uint8(1), uint64(0), bytes32(0), recipient);
        if (!_isReady(cid)) factProvider.mockFulfill(cid, factBlob);
        uint256 deadline = block.timestamp + 1 hours;
        Attestations.Attestation memory att = Attestations.Attestation({
            claimId: cid, recipient: recipient, deadline: deadline, factHash: keccak256(factBlob)
        });
        uint256[] memory ids = new uint256[](2);
        ids[0] = agentIds[0];
        ids[1] = agentIds[1];
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(agentKeys[0], att);
        sigs[1] = _sign(agentKeys[1], att);
        vault.payout(repoId, externalId, kind, recipient, deadline, keccak256(factBlob), ids, sigs);
    }

    function _isReady(bytes32 cid) internal view returns (bool ready) {
        (ready,) = factProvider.getFact(cid);
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
