// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Attestation, AttestationRequest, IEAS} from "../interfaces/IEAS.sol";

/// @notice Minimal Ethereum Attestation Service stand-in for tests + the
///         local demo when anvil is NOT running as a fork of Base Sepolia.
///         Stores attestations in memory; UID = keccak256(schema, attester,
///         data, nonce). Schema registration is implicit (anyone can attest
///         with any bytes32 schema id; the vault enforces its expected
///         schema).
contract MockEAS is IEAS {
    mapping(bytes32 => Attestation) private _attestations;
    uint256 private _nonce;

    event Attested(
        address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schema
    );
    event Revoked(
        address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schema
    );

    function attest(AttestationRequest calldata request) external payable returns (bytes32 uid) {
        ++_nonce;
        uid = keccak256(
            abi.encode(request.schema, msg.sender, request.data.data, _nonce, block.timestamp)
        );
        _attestations[uid] = Attestation({
            uid: uid,
            schema: request.schema,
            time: uint64(block.timestamp),
            expirationTime: request.data.expirationTime,
            revocationTime: 0,
            refUID: request.data.refUID,
            recipient: request.data.recipient,
            attester: msg.sender,
            revocable: request.data.revocable,
            data: request.data.data
        });
        emit Attested(request.data.recipient, msg.sender, uid, request.schema);
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _attestations[uid];
    }

    function isAttestationValid(bytes32 uid) external view returns (bool) {
        Attestation memory a = _attestations[uid];
        if (a.uid == bytes32(0)) return false;
        if (a.revocationTime != 0) return false;
        if (a.expirationTime != 0 && a.expirationTime < block.timestamp) return false;
        return true;
    }

    function revoke(bytes32 schema, bytes32 uid) external {
        Attestation storage a = _attestations[uid];
        require(a.uid != bytes32(0), "MockEAS: unknown uid");
        require(a.attester == msg.sender, "MockEAS: not attester");
        require(a.schema == schema, "MockEAS: schema mismatch");
        require(a.revocable, "MockEAS: not revocable");
        a.revocationTime = uint64(block.timestamp);
        emit Revoked(a.recipient, msg.sender, uid, schema);
    }
}
