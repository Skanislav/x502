// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Async oracle that delivers GitHub state on-chain, keyed by claimId.
///         Real impl wraps Chainlink Functions (~30-90s on Base Sepolia).
///         Mock impl exposes a test-only fulfillment hook.
interface IGitHubFactProvider {
    /// @notice Request a fact for a given claim. Idempotent per claimId.
    /// @return requestId Implementation-defined identifier; useful for traceability.
    function requestFact(bytes32 claimId, string calldata repo, uint256 externalId, uint8 kind)
        external
        returns (bytes32 requestId);

    /// @notice Read the delivered fact, if any. `ready` is false until the oracle fulfills.
    function getFact(bytes32 claimId) external view returns (bool ready, bytes memory factBlob);

    /// @notice Emitted exactly once per claimId when the oracle fulfills.
    event FactFulfilled(bytes32 indexed claimId, bytes32 indexed requestId, bytes factBlob, bytes err);
}
