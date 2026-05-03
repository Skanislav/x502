// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Canonical decoder for the bytes blob returned by the GitHub fact
///         oracle (Chainlink Functions DON or local mock). Encoded in
///         `chainlink/source.js` as
///         `abi.encode(uint8 status, uint64 mergedBlock, bytes32 labelMask, address ghAuthorBinding)`.
library FactBlob {
    struct Fact {
        uint8 status;
        uint64 mergedBlock;
        bytes32 labelMask;
        address ghAuthorBinding;
    }

    function decode(bytes memory blob) internal pure returns (Fact memory) {
        (uint8 status, uint64 mergedBlock, bytes32 labelMask, address binding) =
            abi.decode(blob, (uint8, uint64, bytes32, address));
        return Fact({status: status, mergedBlock: mergedBlock, labelMask: labelMask, ghAuthorBinding: binding});
    }
}
