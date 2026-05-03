// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

import {IGitHubFactProvider} from "./interfaces/IGitHubFactProvider.sol";

/// @title  GitHubFactReceiver — Chainlink Functions consumer.
/// @notice Production impl of `IGitHubFactProvider` for x502.
///         The owner sets the JS source and Functions config (subscription,
///         DON ID, secrets slot, callback gas). `requestFact` packages the
///         caller-supplied (repo, externalId, kind) as args, the DON runs
///         the source, and the response is stored on chain keyed by
///         `claimId`. Vault checks `keccak256(factBlob) == factHash` at
///         payout time, so the DON's signed bytes are the source of truth.
contract GitHubFactReceiver is FunctionsClient, IGitHubFactProvider {
    using FunctionsRequest for FunctionsRequest.Request;

    struct Config {
        uint64 subscriptionId;
        uint32 callbackGasLimit;
        bytes32 donId;
        uint8 secretsSlotId;
        uint64 secretsVersion;
    }

    struct Fact {
        bool ready;
        bytes blob;
    }

    address public owner;
    address public authorizer;
    string public source;
    Config public config;

    mapping(bytes32 => Fact) private _facts;
    mapping(bytes32 => bytes32) public requestIdOf; // claimId → last requestId
    mapping(bytes32 => bytes32) public claimIdOfRequest; // requestId → claimId

    event ConfigUpdated(uint64 subscriptionId, bytes32 donId, uint32 callbackGasLimit);
    event SourceUpdated(uint256 sourceLen);
    event AuthorizerSet(address indexed authorizer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotAuthorizer();
    error UnknownRequest();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorizer() {
        if (msg.sender != authorizer) revert NotAuthorizer();
        _;
    }

    constructor(address router_, address owner_) FunctionsClient(router_) {
        owner = owner_;
        authorizer = owner_;
        emit OwnershipTransferred(address(0), owner_);
        emit AuthorizerSet(owner_);
    }

    // ---------- ownership / config ----------

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setAuthorizer(address newAuthorizer) external onlyOwner {
        authorizer = newAuthorizer;
        emit AuthorizerSet(newAuthorizer);
    }

    function setSource(string calldata src) external onlyOwner {
        source = src;
        emit SourceUpdated(bytes(src).length);
    }

    function setConfig(
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        bytes32 donId,
        uint8 secretsSlotId,
        uint64 secretsVersion
    ) external onlyOwner {
        config = Config({
            subscriptionId: subscriptionId,
            callbackGasLimit: callbackGasLimit,
            donId: donId,
            secretsSlotId: secretsSlotId,
            secretsVersion: secretsVersion
        });
        emit ConfigUpdated(subscriptionId, donId, callbackGasLimit);
    }

    // ---------- IGitHubFactProvider ----------

    function requestFact(bytes32 claimId, string calldata repo, uint256 externalId, uint8 kind)
        external
        override
        onlyAuthorizer
        returns (bytes32 requestId)
    {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);

        // DON-hosted secrets contain the GitHub PAT (lifted to 5k/h rate limit).
        if (config.secretsVersion > 0) {
            req.addDONHostedSecrets(config.secretsSlotId, config.secretsVersion);
        }

        string[] memory args = new string[](3);
        args[0] = repo; // "owner/repo"
        args[1] = _uintToString(externalId);
        args[2] = _uintToString(uint256(kind));
        req.setArgs(args);

        requestId = _sendRequest(req.encodeCBOR(), config.subscriptionId, config.callbackGasLimit, config.donId);
        requestIdOf[claimId] = requestId;
        claimIdOfRequest[requestId] = claimId;
    }

    function getFact(bytes32 claimId) external view override returns (bool ready, bytes memory factBlob) {
        Fact memory f = _facts[claimId];
        return (f.ready, f.blob);
    }

    // ---------- Chainlink callback ----------

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        bytes32 claimId = claimIdOfRequest[requestId];
        if (claimId == bytes32(0)) revert UnknownRequest();
        delete claimIdOfRequest[requestId];

        if (err.length == 0) {
            _facts[claimId] = Fact({ready: true, blob: response});
        }
        // On error, leave the fact unset; coordinator will retry or fail the claim.

        emit FactFulfilled(claimId, requestId, response, err);
    }

    // ---------- helpers ----------

    function _uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 digits;
        while (tmp != 0) {
            digits++;
            tmp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (v != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(v % 10)));
            v /= 10;
        }
        return string(buffer);
    }
}
