/// Unit tests for the EAS-driven pipeline. The watcher is bypassed —
/// tests push attestation UIDs into the inbox directly. End-to-end
/// EAS observation is exercised in the integration / fork tests.

import { type Address, type Hex, encodeAbiParameters } from "viem";
import { describe, expect, it } from "vitest";

import { type DemoEvent, EventBus, Kind, deriveClaimId, repoIdFromSlug } from "@x502/shared";

import { AttestationInbox } from "../src/inbox.js";
import { runClaimPipeline } from "../src/pipeline.js";
import type { IFactProvider, IVaultWriter } from "../src/providers.js";
import type { ClaimState } from "../src/types.js";

class FixedFactProvider implements IFactProvider {
  public requestCount = 0;
  constructor(
    private readonly response: Hex | "timeout",
    private readonly delayMs = 0,
  ) {}
  async requestFact(): Promise<void> {
    this.requestCount++;
  }
  async awaitFact(_claimId: Hex, timeoutMs: number): Promise<Hex> {
    if (this.response === "timeout") {
      await new Promise((res) => setTimeout(res, timeoutMs + 50));
      throw new Error(`fact not delivered within ${timeoutMs}ms`);
    }
    if (this.delayMs > 0) await new Promise((res) => setTimeout(res, this.delayMs));
    return this.response;
  }
}

class ScriptedVault implements IVaultWriter {
  public lastArgs?: Parameters<IVaultWriter["submitPayout"]>[0];
  constructor(private readonly behavior: { type: "ok" | "revert"; reason?: string }) {}
  async submitPayout(args: Parameters<IVaultWriter["submitPayout"]>[0]): Promise<Hex> {
    this.lastArgs = args;
    if (this.behavior.type === "revert") {
      throw new Error(this.behavior.reason ?? "PriceUnderflow()");
    }
    return `0x${"cd".repeat(32)}` as Hex;
  }
}

const REPO_SLUG = "x502-protocol/demo";
const RECIPIENT = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as Address;
const FACT_BLOB = encodeAbiParameters(
  [{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }, { type: "address" }],
  [1, 12345n, `0x${"00".repeat(32)}` as Hex, RECIPIENT],
);
const FACT_HASH = ((): Hex => {
  const { keccak256 } = require("viem") as typeof import("viem");
  return keccak256(FACT_BLOB);
})();

const ATTESTER_101 = "0x1010101010101010101010101010101010101010" as Address;
const ATTESTER_102 = "0x2020202020202020202020202020202020202020" as Address;
const ATTESTER_103 = "0x3030303030303030303030303030303030303030" as Address;

function uidFor(attester: Address, claimId: Hex): Hex {
  // deterministic test UID: keccak(attester || claimId)
  const { keccak256 } = require("viem") as typeof import("viem");
  return keccak256(`${attester}${claimId.slice(2)}` as Hex);
}

function makeState(externalId = 42n): ClaimState {
  const repoId = repoIdFromSlug(REPO_SLUG);
  const kind = Kind.Fix;
  const claimId = deriveClaimId(repoId, externalId, kind);
  return {
    claimId,
    repoId,
    request: { repoSlug: REPO_SLUG, externalId, kind, recipient: RECIPIENT },
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    status: "verifying",
    attestationUIDs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("runClaimPipeline (EAS inbox)", () => {
  it("waits on the inbox and pays once threshold UIDs arrive", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();
    const events = new EventBus();
    const seen: DemoEvent[] = [];
    events.subscribe((e) => seen.push(e));

    const trusted = new Set([ATTESTER_101, ATTESTER_102, ATTESTER_103].map((a) => a.toLowerCase()));
    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 2,
      trustedAttesters: trusted,
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 1_000,
      events,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);

    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_102, state.claimId),
      attester: ATTESTER_102,
    });
    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_101, state.claimId),
      attester: ATTESTER_101,
    });

    await pipelinePromise;
    expect(state.status).toBe("paid");
    expect(state.attestationUIDs).toHaveLength(2);
    // Sorted by attester address ascending — 101 < 102.
    expect(state.attestationUIDs[0]).toBe(uidFor(ATTESTER_101, state.claimId));
    expect(state.attestationUIDs[1]).toBe(uidFor(ATTESTER_102, state.claimId));
    expect(seen.map((e) => e.type)).toContain("fact.requested");
    expect(seen.map((e) => e.type)).toContain("fact.delivered");
    expect(seen.map((e) => e.type)).toContain("payout.confirmed");
  });

  it("rejects an attestation whose attester is not in the trusted set", async () => {
    const state = makeState(7n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 1,
      trustedAttesters: new Set([ATTESTER_101.toLowerCase()]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 200,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    const rogue = "0x9999999999999999999999999999999999999999" as Address;
    const r = inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(rogue, state.claimId),
      attester: rogue,
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/not trusted/);

    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_101, state.claimId),
      attester: ATTESTER_101,
    });
    await pipelinePromise;
    expect(state.status).toBe("paid");
  });

  it("rejects pushes whose factHash disagrees with the delivered fact", async () => {
    const state = makeState(8n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 1,
      trustedAttesters: new Set([ATTESTER_101.toLowerCase()]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 200,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    const wrongHash = `0x${"ee".repeat(32)}` as Hex;
    const r = inbox.push({
      claimId: state.claimId,
      factHash: wrongHash,
      uid: uidFor(ATTESTER_101, state.claimId),
      attester: ATTESTER_101,
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/factHash/);

    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_101, state.claimId),
      attester: ATTESTER_101,
    });
    await pipelinePromise;
    expect(state.status).toBe("paid");
  });

  it("dedups by attester address", async () => {
    const state = makeState(9n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 2,
      trustedAttesters: new Set([ATTESTER_101.toLowerCase(), ATTESTER_102.toLowerCase()]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 200,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_101, state.claimId),
      attester: ATTESTER_101,
    });
    const dup = inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: `0x${"ff".repeat(32)}` as Hex,
      attester: ATTESTER_101,
    });
    expect(dup.accepted).toBe(false);
    expect(dup.reason).toMatch(/already seen/);

    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_102, state.claimId),
      attester: ATTESTER_102,
    });
    await pipelinePromise;
    expect(state.status).toBe("paid");
  });

  it("times out with a clear error when threshold is not reached", async () => {
    const state = makeState(10n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    await runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 2,
      trustedAttesters: new Set([ATTESTER_101.toLowerCase(), ATTESTER_102.toLowerCase()]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 50,
    });

    expect(state.status).toBe("failed");
    expect(state.error).toMatch(/attestation timeout/);
    expect(vault.lastArgs).toBeUndefined();
  });

  it("propagates vault revert into a failed state", async () => {
    const state = makeState(11n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({
      type: "revert",
      reason: "execution reverted: AlreadyPaid()",
    });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 2,
      trustedAttesters: new Set([ATTESTER_101.toLowerCase(), ATTESTER_102.toLowerCase()]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 1_000,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_101, state.claimId),
      attester: ATTESTER_101,
    });
    inbox.push({
      claimId: state.claimId,
      factHash: FACT_HASH,
      uid: uidFor(ATTESTER_102, state.claimId),
      attester: ATTESTER_102,
    });
    await pipelinePromise;

    expect(state.status).toBe("failed");
    expect(state.error).toContain("vault.payout reverted");
    expect(state.error).toContain("AlreadyPaid");
  });

  it("fails when the fact provider times out", async () => {
    const state = makeState(12n);
    const factProvider = new FixedFactProvider("timeout");
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    await expect(
      runClaimPipeline(state, {
        factProvider,
        vault,
        inbox,
        threshold: 1,
        trustedAttesters: new Set([ATTESTER_101.toLowerCase()]),
        factTimeoutMs: 50,
        attestationTimeoutMs: 1_000,
      }),
    ).rejects.toThrow(/fact not delivered/);
    expect(vault.lastArgs).toBeUndefined();
  });

  it("submits attestationUIDs (not signatures) to the vault", async () => {
    const state = makeState(13n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 2,
      trustedAttesters: new Set([ATTESTER_101.toLowerCase(), ATTESTER_102.toLowerCase()]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 1_000,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    const uid1 = uidFor(ATTESTER_101, state.claimId);
    const uid2 = uidFor(ATTESTER_102, state.claimId);
    inbox.push({ claimId: state.claimId, factHash: FACT_HASH, uid: uid1, attester: ATTESTER_101 });
    inbox.push({ claimId: state.claimId, factHash: FACT_HASH, uid: uid2, attester: ATTESTER_102 });
    await pipelinePromise;

    expect(vault.lastArgs?.attestationUIDs).toEqual([uid1, uid2]);
    expect(vault.lastArgs?.factHash).toBe(state.factHash);
  });
});

async function waitFor(pred: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}
