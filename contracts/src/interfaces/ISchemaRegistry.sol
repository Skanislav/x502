// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal subset of EAS's SchemaRegistry. Mirrors the canonical
///         contract at https://github.com/ethereum-attestation-service/eas-contracts
///         so production deploys can register the x502 schema once, then
///         hardcode the resulting UID into the vault constructor.
///
///         schemaUID = keccak256(abi.encodePacked(schema, resolver, revocable))
///         register() reverts if the schema is already registered with the
///         same parameters.
interface ISchemaRegistry {
    struct SchemaRecord {
        bytes32 uid;
        address resolver;
        bool revocable;
        string schema;
    }

    function register(string calldata schema, address resolver, bool revocable) external returns (bytes32);

    function getSchema(bytes32 uid) external view returns (SchemaRecord memory);
}
