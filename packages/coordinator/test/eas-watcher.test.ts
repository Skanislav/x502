/// Watcher unit tests. We bypass `start()` (which subscribes to viem
/// contract events) and drive `handleLog` directly with synthetic logs +
/// a stubbed `readContract`, since the routing logic — schema/revocation
/// filtering, factHash gating, inbox push — is what we want to lock in.

import { type Address, type Hex, type PublicClient, encodeAbiParameters, keccak256 } from "viem";
import { describe, expect, it, vi } from "vitest";

import { EasAttestationWatcher } from "../src/adapters/eas-watcher.js";
import { AttestationInbox } from "../src/inbox.js";
import type { ClaimState } from "../src/types.js";

const SCHEMA = `0x${"11".repeat(32)}` as Hex;
const EAS_ADDR = "0x000000000000000000000000000000000000eEaa" as Address;
const ATTESTER = "0x1010101010101010101010101010101010101010" as Address;
const CLAIM_ID = `0x${"42".repeat(32)}` as Hex;
const RECIPIENT = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as Address;
const FACT_BLOB = encodeAbiParameters(
  [{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }, { type: "address" }],
  [1, 1n, `0x${"00".repeat(32)}` as Hex, RECIPIENT],
);
const STATE_FACT_HASH = keccak256(FACT_BLOB);
const WRONG_FACT_HASH = keccak256(`0xdeadbeef` as Hex);

function makeState(): ClaimState {
  return {
    claimId: CLAIM_ID,
    repoId: `0x${"99".repeat(32)}` as Hex,
    request: {
      repoSlug: "x/y",
      externalId: 1n,
      kind: 0,
      recipient: RECIPIENT,
    },
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    status: "verifying",
    attestationUIDs: [],
    factBlob: FACT_BLOB,
    factHash: STATE_FACT_HASH,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

interface MockAttestation {
  uid: Hex;
  schema: Hex;
  revocationTime: bigint;
  attester: Address;
  data: Hex;
}

function makeWatcher(args: {
  inbox: AttestationInbox;
  attestation: MockAttestation;
  state?: ClaimState;
  logger?: { warn: (msg: string) => void };
  events?: { publish: (e: unknown) => void };
}): EasAttestationWatcher {
  const publicClient = {
    readContract: vi.fn().mockResolvedValue(args.attestation),
    watchContractEvent: vi.fn(),
  } as unknown as PublicClient;

  return new EasAttestationWatcher(
    publicClient,
    EAS_ADDR,
    SCHEMA,
    args.inbox,
    () => args.state,
    args.events as never,
    args.logger,
  );
}

async function deliverLog(
  watcher: EasAttestationWatcher,
  uid: Hex,
  attester: Address,
): Promise<void> {
  // handleLog is private; tests reach through the type to verify routing.
  await (watcher as unknown as {
    handleLog: (log: { args: { uid?: Hex; attester?: Address } }) => Promise<void>;
  }).handleLog({ args: { uid, attester } });
}

describe("EasAttestationWatcher.handleLog", () => {
  it("drops attestations whose decoded factHash does not match state.factHash", async () => {
    const inbox = new AttestationInbox();
    const warn = vi.fn();
    const events = { publish: vi.fn() };
    const uid = `0x${"aa".repeat(32)}` as Hex;

    const watcher = makeWatcher({
      inbox,
      attestation: {
        uid,
        schema: SCHEMA,
        revocationTime: 0n,
        attester: ATTESTER,
        data: encodeAbiParameters(
          [{ type: "bytes32" }, { type: "bytes32" }, { type: "bool" }],
          [CLAIM_ID, WRONG_FACT_HASH, true],
        ),
      },
      state: makeState(),
      logger: { warn },
      events,
    });

    await deliverLog(watcher, uid, ATTESTER);

    expect(inbox.isOpen(CLAIM_ID)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`eas-watcher: attestation ${uid} factHash`),
    );
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("forwards the decoded factHash through to inbox.push when it matches state", async () => {
    const inbox = new AttestationInbox();
    const events = { publish: vi.fn() };
    const uid = `0x${"bb".repeat(32)}` as Hex;
    const state = makeState();

    // Open a waiter so the push is accepted.
    const waiterPromise = inbox.await({
      claimId: CLAIM_ID,
      factHash: STATE_FACT_HASH,
      threshold: 1,
      trustedAttesters: new Set([ATTESTER.toLowerCase()]),
      timeoutMs: 1_000,
    });

    const watcher = makeWatcher({
      inbox,
      attestation: {
        uid,
        schema: SCHEMA,
        revocationTime: 0n,
        attester: ATTESTER,
        data: encodeAbiParameters(
          [{ type: "bytes32" }, { type: "bytes32" }, { type: "bool" }],
          [CLAIM_ID, STATE_FACT_HASH, true],
        ),
      },
      state,
      events,
    });

    const pushSpy = vi.spyOn(inbox, "push");
    await deliverLog(watcher, uid, ATTESTER);
    const observedUIDs = await waiterPromise;

    expect(pushSpy).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      factHash: STATE_FACT_HASH,
      uid,
      attester: ATTESTER,
    });
    expect(observedUIDs).toEqual([uid]);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attestation.observed", uid }),
    );
  });
});
