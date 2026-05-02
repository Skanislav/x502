// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal subset of the Ethereum Attestation Service interface that
///         BountyVault needs at payout time. Mirrors the canonical EAS
///         contract at https://github.com/ethereum-attestation-service/eas-contracts
///         so a vault deployed to Base / Base Sepolia can talk directly to
///         the real EAS at its standard address, and a vault deployed to
///         anvil can talk to MockEAS in this repo.
struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64 time;
    uint64 expirationTime;
    uint64 revocationTime;
    bytes32 refUID;
    address recipient;
    address attester;
    bool revocable;
    bytes data;
}

struct AttestationRequestData {
    address recipient;
    uint64 expirationTime;
    bool revocable;
    bytes32 refUID;
    bytes data;
    uint256 value;
}

struct AttestationRequest {
    bytes32 schema;
    AttestationRequestData data;
}

interface IEAS {
    function attest(AttestationRequest calldata request) external payable returns (bytes32);
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
    function isAttestationValid(bytes32 uid) external view returns (bool);
    function revoke(bytes32 schema, bytes32 uid) external;
}
