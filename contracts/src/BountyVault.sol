// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {Attestation as EasAttestation, IEAS} from "./interfaces/IEAS.sol";
import {IGitHubFactProvider} from "./interfaces/IGitHubFactProvider.sol";
import {Attestations} from "./lib/Attestations.sol";
import {FactBlob} from "./lib/FactBlob.sol";

/// @title  BountyVault — x502 settlement contract.
/// @notice Repo owners deposit USDC and configure per-kind prices + a trusted
///         set of ERC-8004 verifier agents (M-of-N). Anyone can call
///         `payout(...)` once threshold EAS attestations exist for the
///         claim; the vault validates each attestation against its global
///         x502 schema, pays the claimant the price minus per-verifier
///         outcome fees, which go to each attester's address.
///         One-shot per `claimId`.
///
/// @dev    Verification uses Ethereum Attestation Service. Each verifier
///         identity attests to the (claimId, factHash, accept=true) tuple
///         under the vault's `schemaUID`. The vault re-fetches each
///         attestation by UID and validates schema, revocation, claim
///         binding, and trust before settling.
contract BountyVault is ReentrancyGuard {
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
    IEAS public immutable eas;

    /// EAS schema UID for x502 verifier attestations. Registered once by the
    /// deployer in EAS's SchemaRegistry; attestations under any other schema
    /// are rejected by `payout`.
    /// Schema string: "bytes32 claimId,bytes32 factHash,bool accept"
    bytes32 public immutable schemaUID;

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
        address[] attesters
    );

    error NotRepoOwner();
    error RepoNotConfigured();
    error AlreadyPaid(bytes32 claimId);
    error DeadlineExpired();
    error InsufficientAttestations();
    error DuplicateAttester(address attester);
    error UntrustedAttester(address attester);
    error WrongSchema(bytes32 schema);
    error AttestationRevoked(bytes32 uid);
    error AttestationDeclined(bytes32 uid);
    error AttestationClaimMismatch(bytes32 uid);
    error AttestationFactMismatch(bytes32 uid);
    error AttestationExpired(bytes32 uid);
    error UnknownAttestation(bytes32 uid);
    error FactNotReady();
    error FactHashMismatch();
    error FactStatusNotOk(uint8 status);
    error FactMergeMissing();
    error RecipientNotBound(address recipient, address bound);
    error InsufficientRepoBalance();
    error ThresholdZero();
    error PriceUnderflow();

    constructor(
        IERC20 _usdc,
        IAgentRegistry _registry,
        IGitHubFactProvider _facts,
        IEAS _eas,
        bytes32 _schemaUID
    ) {
        usdc = _usdc;
        agentRegistry = _registry;
        factProvider = _facts;
        eas = _eas;
        schemaUID = _schemaUID;
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

    // ---------- payout (permissionless) ----------

    /// @notice Settle a claim once threshold EAS attestations exist for it.
    ///         Permissionless — anyone (claimant, verifier, bot) can call.
    ///         The vault is the only on-chain trust boundary.
    function payout(
        bytes32 repoId,
        uint256 externalId,
        Kind kind,
        address recipient,
        uint256 deadline,
        bytes32 factHash,
        bytes32[] calldata attestationUIDs
    ) external nonReentrant {
        if (block.timestamp > deadline) revert DeadlineExpired();

        RepoConfig storage cfg = _repos[repoId];
        if (!cfg.exists) revert RepoNotConfigured();
        if (attestationUIDs.length < cfg.threshold) revert InsufficientAttestations();

        bytes32 claimId = Attestations.claimId(repoId, externalId, uint8(kind));
        if (isPaid[claimId]) revert AlreadyPaid(claimId);

        // Fact gating
        (bool ready, bytes memory factBlob) = factProvider.getFact(claimId);
        if (!ready) revert FactNotReady();
        if (keccak256(factBlob) != factHash) revert FactHashMismatch();

        FactBlob.Fact memory fb = FactBlob.decode(factBlob);
        if (fb.status != 1) revert FactStatusNotOk(fb.status);
        if ((kind == Kind.Fix || kind == Kind.DocsTests) && fb.mergedBlock == 0) {
            revert FactMergeMissing();
        }
        // Bind payout recipient to the wallet committed in the GH issue/PR
        // body (`<!-- x502:0xWALLET -->`). The fact oracle parses this into
        // `ghAuthorBinding`. Without this check, `payout` is permissionless
        // and a bystander observing threshold UIDs could submit with their
        // own recipient and steal the bounty.
        if (recipient == address(0) || recipient != fb.ghAuthorBinding) {
            revert RecipientNotBound(recipient, fb.ghAuthorBinding);
        }

        // Validate each attestation (schema, revocation, claim/fact binding,
        // trust, dedup) and collect attester addresses for outcome fees.
        address[] memory attesters = _validateAttestations(cfg, claimId, factHash, attestationUIDs);

        // Compute payouts
        uint256 price = _priceOf(cfg, kind);
        uint256 totalOutcomeFees = cfg.outcomeFeePerVerifier * attesters.length;
        if (totalOutcomeFees >= price) revert PriceUnderflow();
        uint256 claimantAmount = price - totalOutcomeFees;
        if (cfg.balance < price) revert InsufficientRepoBalance();

        // Effects
        isPaid[claimId] = true;
        cfg.balance -= price;

        // Interactions
        for (uint256 i; i < attesters.length; ++i) {
            usdc.safeTransfer(attesters[i], cfg.outcomeFeePerVerifier);
        }
        usdc.safeTransfer(recipient, claimantAmount);

        emit Paid(claimId, repoId, kind, recipient, claimantAmount, attesters);
    }

    function _validateAttestations(
        RepoConfig storage cfg,
        bytes32 claimId,
        bytes32 factHash,
        bytes32[] calldata uids
    ) internal view returns (address[] memory attesters) {
        attesters = new address[](uids.length);
        address[] memory trustedSet = _resolveTrustedSet(cfg);

        for (uint256 i; i < uids.length; ++i) {
            EasAttestation memory att = eas.getAttestation(uids[i]);
            if (att.uid == bytes32(0)) revert UnknownAttestation(uids[i]);
            if (att.schema != schemaUID) revert WrongSchema(att.schema);
            if (att.revocationTime != 0) revert AttestationRevoked(uids[i]);
            if (att.expirationTime != 0 && att.expirationTime < block.timestamp) {
                revert AttestationExpired(uids[i]);
            }

            (bytes32 attClaimId, bytes32 attFactHash, bool accept) =
                abi.decode(att.data, (bytes32, bytes32, bool));
            if (attClaimId != claimId) revert AttestationClaimMismatch(uids[i]);
            if (attFactHash != factHash) revert AttestationFactMismatch(uids[i]);
            if (!accept) revert AttestationDeclined(uids[i]);

            // dedup against earlier attesters
            for (uint256 j; j < i; ++j) {
                if (attesters[j] == att.attester) revert DuplicateAttester(att.attester);
            }

            // trust check — attester must equal the wallet bound to one of
            // the repo's trusted agentIds in the ERC-8004 registry.
            bool found;
            for (uint256 k; k < trustedSet.length; ++k) {
                if (trustedSet[k] == att.attester) {
                    found = true;
                    break;
                }
            }
            if (!found) revert UntrustedAttester(att.attester);

            attesters[i] = att.attester;
        }
    }

    function _resolveTrustedSet(RepoConfig storage cfg) internal view returns (address[] memory) {
        uint256 n = cfg.trustedAgents.length;
        address[] memory addrs = new address[](n);
        for (uint256 i; i < n; ++i) {
            addrs[i] = agentRegistry.getAgentWallet(cfg.trustedAgents[i]);
        }
        return addrs;
    }

    function _priceOf(RepoConfig storage cfg, Kind kind) internal view returns (uint256) {
        if (kind == Kind.Report) return cfg.prices.report;
        if (kind == Kind.Triage) return cfg.prices.triage;
        if (kind == Kind.Fix) return cfg.prices.fix;
        return cfg.prices.docsTests;
    }

    // ---------- views ----------

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
