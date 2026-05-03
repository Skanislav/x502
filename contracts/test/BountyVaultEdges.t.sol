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

/// Edge cases on top of BountyVault.t.sol — all-N attestations,
/// Paid-event emission shape, cross-repo + cross-kind collision protection,
/// and repo lifecycle edges. Same EAS-driven settlement model.
contract BountyVaultEdgesTest is Test {
    BountyVault internal vault;
    MockUSDC internal usdc;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;
    MockEAS internal eas;

    address internal claimant = makeAddr("claimant");
    address internal otherClaimant = makeAddr("otherClaimant");

    uint256 internal constant N_AGENTS = 3;
    uint256[] internal agentIds;
    address[] internal agentWallets;

    bytes32 internal constant REPO_A = keccak256("github.com/owner/repo-a");
    bytes32 internal constant REPO_B = keccak256("github.com/owner/repo-b");
    bytes32 internal constant SCHEMA_UID =
        keccak256("x502:bytes32 claimId,bytes32 factHash,bool accept");
    uint256 internal constant DEPOSIT = 1_000_000_000;
    uint256 internal constant OUTCOME_FEE = 100_000;

    BountyVault.Prices internal prices = BountyVault.Prices({
        report: 5_000_000,
        triage: 2_000_000,
        fix: 50_000_000,
        docsTests: 30_000_000
    });

    event Paid(
        bytes32 indexed claimId,
        bytes32 indexed repoId,
        BountyVault.Kind kind,
        address recipient,
        uint256 amount,
        address[] attesters
    );

    event Withdrawn(bytes32 indexed repoId, address indexed to, uint256 amount);

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
            address w = makeAddr(string.concat("agent", vm.toString(i)));
            agentIds[i] = 200 + i;
            agentWallets[i] = w;
            registry.setAgentWallet(agentIds[i], w);
        }

        _configureAndFund(REPO_A, makeAddr("ownerA"));
        _configureAndFund(REPO_B, makeAddr("ownerB"));
    }

    // ---------- payment math: all-N-of-N attestations ----------

    function test_payout_allNAttestations_paysEveryAttester() public {
        uint256 externalId = 1;
        bytes32 cid = Attestations.claimId(REPO_A, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](N_AGENTS);
        for (uint256 i; i < N_AGENTS; ++i) {
            uids[i] = _attest(agentWallets[i], cid, factHash, true);
        }

        vault.payout(REPO_A, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);

        for (uint256 i; i < N_AGENTS; ++i) {
            assertEq(usdc.balanceOf(agentWallets[i]), OUTCOME_FEE, "all attesters paid");
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
        bytes32 cid = Attestations.claimId(REPO_A, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        address[] memory expectedAttesters = new address[](2);
        expectedAttesters[0] = agentWallets[0];
        expectedAttesters[1] = agentWallets[1];

        vm.expectEmit(true, true, false, true, address(vault));
        emit Paid(
            cid,
            REPO_A,
            BountyVault.Kind.Fix,
            claimant,
            prices.fix - 2 * OUTCOME_FEE,
            expectedAttesters
        );
        vault.payout(REPO_A, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    // ---------- cross-repo collision protection ----------

    function test_sameExternalIdAndKind_acrossRepos_doesNotCollide() public {
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

    function test_sameExternalIdDifferentKind_doesNotCollide() public {
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

    // ---------- repo lifecycle edges ----------

    function test_configureRepo_revertsForThresholdZero() public {
        vm.prank(makeAddr("thresholdZeroOwner"));
        vm.expectRevert(BountyVault.ThresholdZero.selector);
        vault.configureRepo(
            keccak256("github.com/owner/threshold-zero"), agentIds, 0, prices, OUTCOME_FEE
        );
    }

    function test_deposit_revertsForUnconfiguredRepo() public {
        address depositor = makeAddr("unconfiguredDepositor");
        bytes32 repoId = keccak256("github.com/owner/unconfigured");

        usdc.mint(depositor, DEPOSIT);
        vm.startPrank(depositor);
        usdc.approve(address(vault), DEPOSIT);
        vm.expectRevert(BountyVault.RepoNotConfigured.selector);
        vault.deposit(repoId, DEPOSIT);
        vm.stopPrank();
    }

    function test_withdraw_revertsWhenBalanceTooLow() public {
        vm.prank(makeAddr("ownerA"));
        vm.expectRevert(BountyVault.InsufficientRepoBalance.selector);
        vault.withdraw(REPO_A, DEPOSIT + 1);
    }

    function test_withdraw_succeedsForRepoOwner() public {
        address ownerA = makeAddr("ownerA");
        uint256 amount = 123_456;

        vm.expectEmit(true, true, false, true, address(vault));
        emit Withdrawn(REPO_A, ownerA, amount);

        vm.prank(ownerA);
        vault.withdraw(REPO_A, amount);

        assertEq(vault.balanceOf(REPO_A), DEPOSIT - amount);
        assertEq(usdc.balanceOf(ownerA), amount);
    }

    function test_payout_revertsOnPriceUnderflow() public {
        BountyVault.Prices memory lowPrices =
            BountyVault.Prices({report: 1, triage: 1, fix: OUTCOME_FEE * 2, docsTests: 1});

        vm.prank(makeAddr("ownerA"));
        vault.configureRepo(REPO_A, agentIds, 2, lowPrices, OUTCOME_FEE);

        uint256 externalId = 502;
        bytes32 cid = Attestations.claimId(REPO_A, externalId, uint8(BountyVault.Kind.Fix));
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);

        vm.expectRevert(BountyVault.PriceUnderflow.selector);
        vault.payout(REPO_A, externalId, BountyVault.Kind.Fix, claimant, deadline, factHash, uids);
    }

    // ---------- views ----------

    function test_views_coverRepoConfigAndSchema() public view {
        assertEq(vault.thresholdOf(REPO_A), 2);
        assertEq(vault.outcomeFeeOf(REPO_A), OUTCOME_FEE);
        assertEq(vault.schemaUID(), SCHEMA_UID);

        uint256[] memory trustedAgents = vault.trustedAgentsOf(REPO_A);
        assertEq(trustedAgents.length, agentIds.length);
        for (uint256 i; i < agentIds.length; ++i) {
            assertEq(trustedAgents[i], agentIds[i]);
        }

        assertEq(vault.priceOf(REPO_A, BountyVault.Kind.Report), prices.report);
        assertEq(vault.priceOf(REPO_A, BountyVault.Kind.Triage), prices.triage);
        assertEq(vault.priceOf(REPO_A, BountyVault.Kind.Fix), prices.fix);
        assertEq(vault.priceOf(REPO_A, BountyVault.Kind.DocsTests), prices.docsTests);
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
        bytes memory factBlob = abi.encode(uint8(1), uint64(1), bytes32(0), recipient);
        if (!_isReady(cid)) factProvider.mockFulfill(cid, factBlob);
        bytes32 factHash = keccak256(factBlob);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32[] memory uids = new bytes32[](2);
        uids[0] = _attest(agentWallets[0], cid, factHash, true);
        uids[1] = _attest(agentWallets[1], cid, factHash, true);
        vault.payout(repoId, externalId, kind, recipient, deadline, factHash, uids);
    }

    function _isReady(bytes32 cid) internal view returns (bool ready) {
        (ready,) = factProvider.getFact(cid);
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
        uid = eas.attest(req);
    }
}
