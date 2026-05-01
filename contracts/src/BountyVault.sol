// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IGitHubFactProvider} from "./interfaces/IGitHubFactProvider.sol";
import {Attestations} from "./lib/Attestations.sol";
import {FactBlob} from "./lib/FactBlob.sol";

/// @title  BountyVault — x502 settlement contract.
/// @notice Repo owners deposit USDC and configure per-kind prices + a trusted
///         set of ERC-8004 verifier agents (M-of-N). Anyone can submit a
///         payout bundle of (Chainlink-Functions fact + M verifier sigs);
///         the vault pays the claimant the price minus per-verifier outcome
///         fees, which go to each signing verifier's `getAgentWallet` address.
///         One-shot per `claimId`.
contract BountyVault is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Kind {
        Report,
        Triage,
        Fix,
        DocsTests
    }

    struct Prices {
        uint256 report;
        uint256 triage;
        uint256 fix;
        uint256 docsTests;
    }

    struct RepoConfig {
        address owner;
        uint256 balance;
        uint256[] trustedAgents;
        uint8 threshold;
        Prices prices;
        uint256 outcomeFeePerVerifier;
        bool exists;
    }

    IERC20 public immutable usdc;
    IAgentRegistry public immutable agentRegistry;
    IGitHubFactProvider public immutable factProvider;

    mapping(bytes32 => RepoConfig) private _repos;
    mapping(bytes32 => bool) public isPaid;

    event RepoConfigured(bytes32 indexed repoId, address indexed owner, uint8 threshold);
    event Deposited(bytes32 indexed repoId, address indexed from, uint256 amount);
    event Withdrawn(bytes32 indexed repoId, address indexed to, uint256 amount);
    event Paid(
        bytes32 indexed claimId,
        bytes32 indexed repoId,
        Kind kind,
        address recipient,
        uint256 amount,
        uint256[] agentIds
    );

    error NotRepoOwner();
    error RepoNotConfigured();
    error AlreadyPaid(bytes32 claimId);
    error DeadlineExpired();
    error InsufficientSignatures();
    error DuplicateSigner(uint256 agentId);
    error UntrustedAgent(uint256 agentId);
    error InvalidSignature(uint256 agentId);
    error FactNotReady();
    error FactHashMismatch();
    error FactStatusNotOk(uint8 status);
    error FactMergeMissing();
    error InsufficientRepoBalance();
    error LengthMismatch();
    error ThresholdZero();
    error PriceUnderflow();

    constructor(IERC20 _usdc, IAgentRegistry _registry, IGitHubFactProvider _facts)
        EIP712("x502", "1")
    {
        usdc = _usdc;
        agentRegistry = _registry;
        factProvider = _facts;
    }

    // ---------- repo lifecycle ----------

    function configureRepo(
        bytes32 repoId,
        uint256[] calldata trustedAgents,
        uint8 threshold,
        Prices calldata prices,
        uint256 outcomeFeePerVerifier
    ) external {
        RepoConfig storage cfg = _repos[repoId];
        if (cfg.exists) {
            if (cfg.owner != msg.sender) revert NotRepoOwner();
        } else {
            cfg.owner = msg.sender;
            cfg.exists = true;
        }
        if (threshold == 0) revert ThresholdZero();

        cfg.trustedAgents = trustedAgents;
        cfg.threshold = threshold;
        cfg.prices = prices;
        cfg.outcomeFeePerVerifier = outcomeFeePerVerifier;

        emit RepoConfigured(repoId, cfg.owner, threshold);
    }

    function deposit(bytes32 repoId, uint256 amount) external {
        RepoConfig storage cfg = _repos[repoId];
        if (!cfg.exists) revert RepoNotConfigured();
        cfg.balance += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(repoId, msg.sender, amount);
    }

    function withdraw(bytes32 repoId, uint256 amount) external nonReentrant {
        RepoConfig storage cfg = _repos[repoId];
        if (cfg.owner != msg.sender) revert NotRepoOwner();
        if (cfg.balance < amount) revert InsufficientRepoBalance();
        cfg.balance -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(repoId, msg.sender, amount);
    }

    // ---------- payout ----------

    struct PayoutLocals {
        bytes32 claimId;
        bytes32 digest;
        bytes factBlob;
        uint256 totalOutcomeFees;
        uint256 claimantAmount;
    }

    function payout(
        bytes32 repoId,
        uint256 externalId,
        Kind kind,
        address recipient,
        uint256 deadline,
        bytes32 factHash,
        uint256[] calldata agentIds,
        bytes[] calldata signatures
    ) external nonReentrant {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (agentIds.length != signatures.length) revert LengthMismatch();

        RepoConfig storage cfg = _repos[repoId];
        if (!cfg.exists) revert RepoNotConfigured();
        if (agentIds.length < cfg.threshold) revert InsufficientSignatures();

        PayoutLocals memory L;
        L.claimId = Attestations.claimId(repoId, externalId, uint8(kind));
        if (isPaid[L.claimId]) revert AlreadyPaid(L.claimId);

        // Fact gating
        bool ready;
        (ready, L.factBlob) = factProvider.getFact(L.claimId);
        if (!ready) revert FactNotReady();
        if (keccak256(L.factBlob) != factHash) revert FactHashMismatch();

        // The DON's source.js returns status=1 only when its kind-specific rules
        // pass (see chainlink/source-core.js::decideFact). Reject status=0 here
        // so the vault enforces the objective half of the two-layer design.
        FactBlob.Fact memory fb = FactBlob.decode(L.factBlob);
        if (fb.status != 1) revert FactStatusNotOk(fb.status);
        if ((kind == Kind.Fix || kind == Kind.DocsTests) && fb.mergedBlock == 0) {
            revert FactMergeMissing();
        }

        // Verify M-of-N signatures
        L.digest = hashAttestation(
            Attestations.Attestation({
                claimId: L.claimId, recipient: recipient, deadline: deadline, factHash: factHash
            })
        );
        _verifySignatures(cfg, agentIds, signatures, L.digest);

        // Compute payouts
        uint256 price = _priceOf(cfg, kind);
        L.totalOutcomeFees = cfg.outcomeFeePerVerifier * agentIds.length;
        if (L.totalOutcomeFees >= price) revert PriceUnderflow();
        L.claimantAmount = price - L.totalOutcomeFees;
        if (cfg.balance < price) revert InsufficientRepoBalance();

        // Effects
        isPaid[L.claimId] = true;
        cfg.balance -= price;

        // Interactions
        for (uint256 i; i < agentIds.length; ++i) {
            address w = agentRegistry.getAgentWallet(agentIds[i]);
            usdc.safeTransfer(w, cfg.outcomeFeePerVerifier);
        }
        usdc.safeTransfer(recipient, L.claimantAmount);

        emit Paid(L.claimId, repoId, kind, recipient, L.claimantAmount, agentIds);
    }

    function _verifySignatures(
        RepoConfig storage cfg,
        uint256[] calldata agentIds,
        bytes[] calldata signatures,
        bytes32 digest
    ) internal view {
        // Mark seen agents in transient memory; check trust + dedup + sig.
        // O(N*M) trust check is fine — both arrays are small (≤ ~10).
        for (uint256 i; i < agentIds.length; ++i) {
            uint256 id = agentIds[i];

            // Dedup against earlier entries
            for (uint256 j; j < i; ++j) {
                if (agentIds[j] == id) revert DuplicateSigner(id);
            }

            // Trust check
            if (!_isTrusted(cfg, id)) revert UntrustedAgent(id);

            // Signature check (EIP-1271 aware via SignatureChecker)
            address signer = agentRegistry.getAgentWallet(id);
            if (!SignatureChecker.isValidSignatureNow(signer, digest, signatures[i])) {
                revert InvalidSignature(id);
            }
        }
    }

    function _isTrusted(RepoConfig storage cfg, uint256 agentId) internal view returns (bool) {
        uint256 n = cfg.trustedAgents.length;
        for (uint256 i; i < n; ++i) {
            if (cfg.trustedAgents[i] == agentId) return true;
        }
        return false;
    }

    function _priceOf(RepoConfig storage cfg, Kind kind) internal view returns (uint256) {
        if (kind == Kind.Report) return cfg.prices.report;
        if (kind == Kind.Triage) return cfg.prices.triage;
        if (kind == Kind.Fix) return cfg.prices.fix;
        return cfg.prices.docsTests;
    }

    // ---------- views ----------

    function hashAttestation(Attestations.Attestation memory att) public view returns (bytes32) {
        return _hashTypedDataV4(Attestations.hashStruct(att));
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function repoOwnerOf(bytes32 repoId) external view returns (address) {
        return _repos[repoId].owner;
    }

    function balanceOf(bytes32 repoId) external view returns (uint256) {
        return _repos[repoId].balance;
    }

    function priceOf(bytes32 repoId, Kind kind) external view returns (uint256) {
        return _priceOf(_repos[repoId], kind);
    }

    function thresholdOf(bytes32 repoId) external view returns (uint8) {
        return _repos[repoId].threshold;
    }

    function trustedAgentsOf(bytes32 repoId) external view returns (uint256[] memory) {
        return _repos[repoId].trustedAgents;
    }

    function outcomeFeeOf(bytes32 repoId) external view returns (uint256) {
        return _repos[repoId].outcomeFeePerVerifier;
    }
}
