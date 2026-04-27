// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IGitHubFactProvider} from "../interfaces/IGitHubFactProvider.sol";

/// @notice Test-only fact provider that returns immediately. Production impl
///         (GitHubFactReceiver wrapping Chainlink Functions) takes ~30-90s
///         on Base Sepolia; the coordinator must treat both as async.
contract MockGitHubFactProvider is IGitHubFactProvider {
    struct Fact {
        bool ready;
        bytes blob;
    }

    mapping(bytes32 => Fact) private _facts;
    mapping(bytes32 => bytes32) public lastRequestId;
    uint256 private _nonce;

    function requestFact(
        bytes32 claimId,
        string calldata,
        /*repo*/
        uint256,
        /*externalId*/
        uint8 /*kind*/
    )
        external
        override
        returns (bytes32 requestId)
    {
        _nonce++;
        requestId = keccak256(abi.encode(claimId, _nonce, block.timestamp));
        lastRequestId[claimId] = requestId;
    }

    /// @notice Test helper: oracle-side fulfillment. In production this is the
    ///         Chainlink Functions DON callback.
    function mockFulfill(bytes32 claimId, bytes calldata factBlob) external {
        _facts[claimId] = Fact({ready: true, blob: factBlob});
        emit FactFulfilled(claimId, lastRequestId[claimId], factBlob, "");
    }

    function getFact(bytes32 claimId)
        external
        view
        override
        returns (bool ready, bytes memory factBlob)
    {
        Fact memory f = _facts[claimId];
        return (f.ready, f.blob);
    }
}
