// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BountyVault} from "../src/BountyVault.sol";
import {Attestations} from "../src/lib/Attestations.sol";
import {ERC6492SignatureChecker} from "../src/lib/ERC6492SignatureChecker.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {MockGitHubFactProvider} from "../src/mocks/MockGitHubFactProvider.sol";

import {
    MockSmartWallet,
    MockSmartWalletFactory,
    NoOpSmartWalletFactory
} from "./helpers/SmartWalletMocks.sol";

/// @notice Exercises the BountyVault signature check across the three signer
///         shapes the protocol now accepts:
///           1. EOA — covered exhaustively in BountyVault.t.sol; spot-checked here
///           2. Deployed ERC-1271 smart wallet
///           3. Counterfactual ERC-6492 wrapped sig (vault deploys + verifies)
///
///         The 1claw remote-mode roadmap depends on (3) — without it,
///         smart-account verifier signers can't sign the first claim before
///         their wallet has been deployed.
contract BountyVaultErc6492Test is Test {
    BountyVault internal vault;
    MockUSDC internal usdc;
    MockAgentRegistry internal registry;
    MockGitHubFactProvider internal factProvider;
    MockSmartWalletFactory internal walletFactory;

    address internal repoOwner = makeAddr("repoOwner");
    address internal claimant = makeAddr("claimant");

    bytes32 internal constant REPO_ID = keccak256("github.com/x502-protocol/erc6492-demo");
    uint256 internal constant DEPOSIT = 1_000_000_000;
    uint256 internal constant OUTCOME_FEE = 100_000;

    BountyVault.Prices internal defaultPrices = BountyVault.Prices({
        report: 5_000_000,
        triage: 2_000_000,
        fix: 50_000_000,
        docsTests: 30_000_000
    });

    // The two trust slots: one EOA verifier (101) + one smart-wallet verifier (102).
    uint256 internal constant EOA_AGENT_ID = 101;
    uint256 internal constant SMART_AGENT_ID = 102;
    uint256 internal eoaKey;
    address internal eoaWallet;
    uint256 internal smartOwnerKey;
    address internal smartOwner;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockAgentRegistry();
        factProvider = new MockGitHubFactProvider();
        walletFactory = new MockSmartWalletFactory();
        vault = new BountyVault(IERC20(address(usdc)), registry, factProvider);

        (eoaWallet, eoaKey) = makeAddrAndKey("eoa-verifier");
        (smartOwner, smartOwnerKey) = makeAddrAndKey("smart-owner");

        registry.setAgentWallet(EOA_AGENT_ID, eoaWallet);
        // SMART_AGENT_ID's wallet is set per-test (deployed vs counterfactual).

        uint256[] memory trusted = new uint256[](2);
        trusted[0] = EOA_AGENT_ID;
        trusted[1] = SMART_AGENT_ID;

        vm.prank(repoOwner);
        vault.configureRepo(REPO_ID, trusted, 2, defaultPrices, OUTCOME_FEE);

        usdc.mint(repoOwner, DEPOSIT);
        vm.startPrank(repoOwner);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(REPO_ID, DEPOSIT);
        vm.stopPrank();
    }

    // ---------- happy paths ----------

    /// @notice Path 2: smart wallet already deployed → bare EOA owner sig is
    ///         passed straight through; SignatureChecker recognizes the
    ///         signer has code and routes to ERC-1271.
    function test_payout_acceptsErc1271FromDeployedSmartWallet() public {
        bytes32 salt = bytes32(uint256(0x1271));
        address smartAddr = walletFactory.deploy(smartOwner, salt);
        registry.setAgentWallet(SMART_AGENT_ID, smartAddr);

        bytes memory factBlob = _deliverFact(42, BountyVault.Kind.Fix);

        (uint256 deadline, bytes32 factHash, Attestations.Attestation memory att) =
            _attestation(42, BountyVault.Kind.Fix, factBlob);

        uint256[] memory ids = new uint256[](2);
        ids[0] = EOA_AGENT_ID;
        ids[1] = SMART_AGENT_ID;
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(eoaKey, att);
        sigs[1] = _sign(smartOwnerKey, att); // owner's EOA sig — wallet's isValidSignature accepts.

        uint256 priorClaimant = usdc.balanceOf(claimant);
        vault.payout(REPO_ID, 42, BountyVault.Kind.Fix, claimant, deadline, factHash, ids, sigs);

        assertEq(
            usdc.balanceOf(claimant) - priorClaimant,
            defaultPrices.fix - 2 * OUTCOME_FEE,
            "smart-wallet signer accepted via ERC-1271"
        );
    }

    /// @notice Path 3: smart wallet NOT yet deployed → 6492-wrapped sig with
    ///         the factory call. Vault deploys it, then verifies.
    function test_payout_acceptsErc6492CounterfactualSig() public {
        bytes32 salt = bytes32(uint256(0x6492));
        address predicted = walletFactory.predict(smartOwner, salt);
        registry.setAgentWallet(SMART_AGENT_ID, predicted);
        // Sanity: at this point the predicted address has no code.
        assertEq(predicted.code.length, 0, "predicted wallet must be undeployed");

        bytes memory factBlob = _deliverFact(43, BountyVault.Kind.Fix);

        (uint256 deadline, bytes32 factHash, Attestations.Attestation memory att) =
            _attestation(43, BountyVault.Kind.Fix, factBlob);

        bytes memory innerSig = _sign(smartOwnerKey, att);
        bytes memory factoryCalldata =
            abi.encodeCall(MockSmartWalletFactory.deploy, (smartOwner, salt));
        bytes memory wrappedSig = _wrap6492(address(walletFactory), factoryCalldata, innerSig);

        uint256[] memory ids = new uint256[](2);
        ids[0] = EOA_AGENT_ID;
        ids[1] = SMART_AGENT_ID;
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(eoaKey, att);
        sigs[1] = wrappedSig;

        vault.payout(REPO_ID, 43, BountyVault.Kind.Fix, claimant, deadline, factHash, ids, sigs);

        assertGt(predicted.code.length, 0, "vault deployed the smart wallet during payout");
        assertTrue(
            vault.isPaid(Attestations.claimId(REPO_ID, 43, uint8(BountyVault.Kind.Fix))),
            "claim marked paid"
        );
    }

    // ---------- negative paths ----------

    /// @notice 6492 with a factory that runs successfully but doesn't deploy
    ///         any code at the predicted address must be rejected.
    function test_payout_rejectsErc6492WhenFactoryDoesNotDeploy() public {
        NoOpSmartWalletFactory badFactory = new NoOpSmartWalletFactory();
        // Pretend the registry says agent 102's wallet is some address
        // unrelated to the bad factory's output.
        address fakeWallet = makeAddr("never-deployed");
        registry.setAgentWallet(SMART_AGENT_ID, fakeWallet);
        assertEq(fakeWallet.code.length, 0);

        bytes memory factBlob = _deliverFact(44, BountyVault.Kind.Fix);

        (uint256 deadline, bytes32 factHash, Attestations.Attestation memory att) =
            _attestation(44, BountyVault.Kind.Fix, factBlob);

        bytes memory innerSig = _sign(smartOwnerKey, att);
        bytes memory factoryCalldata =
            abi.encodeCall(NoOpSmartWalletFactory.deploy, (smartOwner, bytes32(0)));
        bytes memory wrappedSig = _wrap6492(address(badFactory), factoryCalldata, innerSig);

        uint256[] memory ids = new uint256[](2);
        ids[0] = EOA_AGENT_ID;
        ids[1] = SMART_AGENT_ID;
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(eoaKey, att);
        sigs[1] = wrappedSig;

        vm.expectRevert(
            abi.encodeWithSelector(BountyVault.InvalidSignature.selector, SMART_AGENT_ID)
        );
        vault.payout(REPO_ID, 44, BountyVault.Kind.Fix, claimant, deadline, factHash, ids, sigs);
    }

    /// @notice 6492 with the right factory deployment but a corrupt inner sig
    ///         (signed by someone other than `owner`) must be rejected.
    function test_payout_rejectsErc6492WithBadInnerSig() public {
        bytes32 salt = bytes32(uint256(0xdead));
        address predicted = walletFactory.predict(smartOwner, salt);
        registry.setAgentWallet(SMART_AGENT_ID, predicted);

        bytes memory factBlob = _deliverFact(45, BountyVault.Kind.Fix);

        (uint256 deadline, bytes32 factHash, Attestations.Attestation memory att) =
            _attestation(45, BountyVault.Kind.Fix, factBlob);

        // Sign with the EOA verifier's key — it's a valid ECDSA sig, but the
        // smart wallet checks against `owner` (smartOwnerKey), not eoaKey.
        bytes memory wrongInner = _sign(eoaKey, att);
        bytes memory factoryCalldata =
            abi.encodeCall(MockSmartWalletFactory.deploy, (smartOwner, salt));
        bytes memory wrappedSig = _wrap6492(address(walletFactory), factoryCalldata, wrongInner);

        uint256[] memory ids = new uint256[](2);
        ids[0] = EOA_AGENT_ID;
        ids[1] = SMART_AGENT_ID;
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(eoaKey, att);
        sigs[1] = wrappedSig;

        vm.expectRevert(
            abi.encodeWithSelector(BountyVault.InvalidSignature.selector, SMART_AGENT_ID)
        );
        vault.payout(REPO_ID, 45, BountyVault.Kind.Fix, claimant, deadline, factHash, ids, sigs);
    }

    // ---------- helpers ----------

    function _deliverFact(uint256 externalId, BountyVault.Kind kind) internal returns (bytes memory) {
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(kind));
        bytes memory factBlob = abi.encode(uint8(1), uint64(123), bytes32(0), claimant);
        factProvider.mockFulfill(cid, factBlob);
        return factBlob;
    }

    function _attestation(uint256 externalId, BountyVault.Kind kind, bytes memory factBlob)
        internal
        view
        returns (uint256 deadline, bytes32 factHash, Attestations.Attestation memory att)
    {
        bytes32 cid = Attestations.claimId(REPO_ID, externalId, uint8(kind));
        deadline = block.timestamp + 1 hours;
        factHash = keccak256(factBlob);
        att = Attestations.Attestation({
            claimId: cid, recipient: claimant, deadline: deadline, factHash: factHash
        });
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

    function _wrap6492(address factory, bytes memory factoryCalldata, bytes memory innerSig)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            abi.encode(factory, factoryCalldata, innerSig),
            ERC6492SignatureChecker.ERC6492_MAGIC
        );
    }
}
