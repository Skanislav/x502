// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {GitHubFactReceiver} from "../src/GitHubFactReceiver.sol";
import {MockFunctionsRouter} from "../src/mocks/MockFunctionsRouter.sol";

contract GitHubFactReceiverTest is Test {
    MockFunctionsRouter internal router;
    GitHubFactReceiver internal receiver;

    address internal owner = makeAddr("owner");
    address internal authorizer = makeAddr("authorizer");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant CLAIM_ID = keccak256("claim/42/fix");

    event SourceUpdated(uint256 sourceLen);
    event AuthorizerSet(address indexed authorizer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        router = new MockFunctionsRouter();
        receiver = new GitHubFactReceiver(address(router), owner);

        vm.startPrank(owner);
        receiver.setSource("return Functions.encodeUint256(0)");
        receiver.setConfig({
            subscriptionId: 7,
            callbackGasLimit: 300_000,
            donId: bytes32("fun-base-sepolia-1"),
            secretsSlotId: 0,
            secretsVersion: 0
        });
        receiver.setAuthorizer(authorizer);
        vm.stopPrank();
    }

    function test_constructor_setsOwnerAndInitialAuthorizer() public {
        MockFunctionsRouter freshRouter = new MockFunctionsRouter();
        GitHubFactReceiver freshReceiver = new GitHubFactReceiver(address(freshRouter), owner);

        assertEq(freshReceiver.owner(), owner);
        assertEq(freshReceiver.authorizer(), owner);

        vm.prank(owner);
        freshReceiver.setSource("return Functions.encodeUint256(0)");

        vm.prank(owner);
        bytes32 requestId = freshReceiver.requestFact(CLAIM_ID, "foo/bar", 0, 2);

        assertEq(freshReceiver.requestIdOf(CLAIM_ID), requestId);
        assertEq(freshReceiver.claimIdOfRequest(requestId), CLAIM_ID);
    }

    function test_setup_setsCurrentOwnerAndAuthorizer() public view {
        assertEq(receiver.owner(), owner);
        assertEq(receiver.authorizer(), authorizer);
    }

    function test_transferOwnership_emitsAndChangesOwner() public {
        address newOwner = makeAddr("newOwner");

        vm.expectEmit(true, true, false, true, address(receiver));
        emit OwnershipTransferred(owner, newOwner);

        vm.prank(owner);
        receiver.transferOwnership(newOwner);

        assertEq(receiver.owner(), newOwner);
    }

    function test_setSource_emitsLengthAndStoresSource() public {
        string memory src = "return Functions.encodeUint256(1)";

        vm.expectEmit(false, false, false, true, address(receiver));
        emit SourceUpdated(bytes(src).length);

        vm.prank(owner);
        receiver.setSource(src);

        assertEq(receiver.source(), src);
    }

    function test_setAuthorizer_emitsAndStoresAuthorizer() public {
        address newAuthorizer = makeAddr("newAuthorizer");

        vm.expectEmit(true, false, false, true, address(receiver));
        emit AuthorizerSet(newAuthorizer);

        vm.prank(owner);
        receiver.setAuthorizer(newAuthorizer);

        assertEq(receiver.authorizer(), newAuthorizer);
    }

    function test_setConfig_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(GitHubFactReceiver.NotOwner.selector);
        receiver.setConfig(1, 100_000, bytes32("x"), 0, 0);
    }

    function test_requestFact_revertsForUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(GitHubFactReceiver.NotAuthorizer.selector);
        receiver.requestFact(CLAIM_ID, "foo/bar", 42, 2);
    }

    function test_requestFact_storesRequestId() public {
        vm.prank(authorizer);
        bytes32 requestId = receiver.requestFact(CLAIM_ID, "foo/bar", 42, 2);

        assertEq(receiver.requestIdOf(CLAIM_ID), requestId);
        assertEq(receiver.claimIdOfRequest(requestId), CLAIM_ID);

        // Args were CBOR-encoded into `last.data` — we don't decode CBOR here,
        // but the router recorded the subId / donId / gas correctly.
        (uint64 subId,, /* dataVersion */ uint32 gas, bytes32 donId) = _readLastRouterCall();
        assertEq(subId, 7);
        assertEq(gas, 300_000);
        assertEq(donId, bytes32("fun-base-sepolia-1"));
    }

    function test_requestFact_allowsZeroExternalIdAndUsesSecretsConfig() public {
        vm.prank(owner);
        receiver.setConfig({
            subscriptionId: 11,
            callbackGasLimit: 400_000,
            donId: bytes32("fun-base-sepolia-2"),
            secretsSlotId: 3,
            secretsVersion: 9
        });

        bytes32 claimId = keccak256("claim/zero/fix");

        vm.prank(authorizer);
        bytes32 requestId = receiver.requestFact(claimId, "foo/bar", 0, 2);

        assertEq(receiver.requestIdOf(claimId), requestId);
        assertEq(receiver.claimIdOfRequest(requestId), claimId);

        (uint64 subId, bytes memory data, uint16 dataVersion, uint32 gas, bytes32 donId) = router.last();
        assertEq(subId, 11);
        assertGt(data.length, 0);
        assertEq(dataVersion, 1);
        assertEq(gas, 400_000);
        assertEq(donId, bytes32("fun-base-sepolia-2"));
    }

    function test_getFact_emptyState() public view {
        (bool ready, bytes memory blob) = receiver.getFact(keccak256("missing"));

        assertFalse(ready);
        assertEq(blob.length, 0);
    }

    function test_fulfill_storesFactAndEmits() public {
        vm.prank(authorizer);
        bytes32 requestId = receiver.requestFact(CLAIM_ID, "foo/bar", 42, 2);

        bytes memory factBlob = abi.encode(uint8(1), uint64(123), bytes32(uint256(0xAB)), address(0xBEEF));

        vm.expectEmit(true, true, false, true, address(receiver));
        emit IGitHubFactProviderEvent.FactFulfilled(CLAIM_ID, requestId, factBlob, "");

        router.fulfill(address(receiver), requestId, factBlob, "");

        (bool ready, bytes memory blob) = receiver.getFact(CLAIM_ID);
        assertTrue(ready);
        assertEq(keccak256(blob), keccak256(factBlob));

        // request → claim mapping cleared after fulfillment
        assertEq(receiver.claimIdOfRequest(requestId), bytes32(0));
    }

    function test_fulfill_onErrorLeavesFactUnset() public {
        vm.prank(authorizer);
        bytes32 requestId = receiver.requestFact(CLAIM_ID, "foo/bar", 42, 2);

        router.fulfill(address(receiver), requestId, "", "rate limit");

        (bool ready,) = receiver.getFact(CLAIM_ID);
        assertFalse(ready);
    }

    function test_fulfill_revertsOnUnknownRequest() public {
        vm.expectRevert(GitHubFactReceiver.UnknownRequest.selector);
        router.fulfill(address(receiver), bytes32(uint256(999)), "x", "");
    }

    function test_fulfill_revertsForNonRouter() public {
        vm.prank(authorizer);
        bytes32 requestId = receiver.requestFact(CLAIM_ID, "foo/bar", 42, 2);

        vm.expectRevert();
        receiver.handleOracleFulfillment(requestId, "x", "");
    }

    function _readLastRouterCall() internal view returns (uint64, uint16, uint32, bytes32) {
        (uint64 subId,, uint16 dv, uint32 gas, bytes32 donId) = router.last();
        return (subId, dv, gas, donId);
    }
}

/// Hack to import the IGitHubFactProvider event for `vm.expectEmit`.
interface IGitHubFactProviderEvent {
    event FactFulfilled(bytes32 indexed claimId, bytes32 indexed requestId, bytes factBlob, bytes err);
}
