// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IFunctionsClient {
    function handleOracleFulfillment(bytes32 requestId, bytes memory response, bytes memory err) external;
}

/// @notice Stand-in for Chainlink's FunctionsRouter, used by forge tests.
///         Records every sendRequest call and lets the test trigger
///         fulfillment by calling `fulfill(consumer, requestId, ...)`.
contract MockFunctionsRouter {
    uint256 public requestCounter;

    struct LastRequest {
        uint64 subscriptionId;
        bytes data;
        uint16 dataVersion;
        uint32 callbackGasLimit;
        bytes32 donId;
    }

    LastRequest public last;

    event Sent(bytes32 indexed requestId);

    function sendRequest(
        uint64 subscriptionId,
        bytes calldata data,
        uint16 dataVersion,
        uint32 callbackGasLimit,
        bytes32 donId
    ) external returns (bytes32 requestId) {
        requestCounter++;
        requestId = bytes32(requestCounter);
        last = LastRequest({
            subscriptionId: subscriptionId,
            data: data,
            dataVersion: dataVersion,
            callbackGasLimit: callbackGasLimit,
            donId: donId
        });
        emit Sent(requestId);
    }

    /// @notice Test-only: simulate the DON delivering a response.
    function fulfill(address consumer, bytes32 requestId, bytes calldata response, bytes calldata err) external {
        IFunctionsClient(consumer).handleOracleFulfillment(requestId, response, err);
    }
}
