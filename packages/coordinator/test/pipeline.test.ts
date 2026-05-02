/// Unit tests for the inbox-driven pipeline. Verifiers are no longer pulled
/// (the Hono fan-out is gone); they push signed attestations to the
/// coordinator's `/attestation` endpoint, which routes them into the inbox.
/// Pipeline awaits inbox.

import { type Address, type Hex, encodeAbiParameters } from "viem";
import { describe, expect, it } from "vitest";

import {
  type DemoEvent,
  EventBus,
  Kind,
  type SignedAttestation,
  deriveClaimId,
  repoIdFromSlug,
} from "@x502/shared";

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
    attestations: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeAttestation(
  claimId: Hex,
  agentId: bigint,
  factHash: Hex,
  recipient: Address,
  deadline: bigint,
): SignedAttestation {
  return {
    agentId,
    signature: `0x${agentId.toString(16).padStart(2, "0").repeat(65)}` as Hex,
    attestation: { claimId, recipient, deadline, factHash },
  };
}

describe("runClaimPipeline (inbox-driven)", () => {
  it("waits on the inbox and pays once threshold attestations arrive", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();
    const events = new EventBus();
    const seen: DemoEvent[] = [];
    events.subscribe((e) => seen.push(e));

    const trusted = new Set(["101", "102", "103"]);
    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 2,
      trustedAgentIds: trusted,
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 1_000,
      events,
    });

    // Wait until the inbox is open (i.e. fact has been delivered).
    await waitFor(() => inbox.isOpen(state.claimId), 1_000);

    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 102n, FACT_HASH, RECIPIENT, state.deadline),
    );
    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 101n, FACT_HASH, RECIPIENT, state.deadline),
    );

    await pipelinePromise;
    expect(state.status).toBe("paid");
    expect(state.attestations).toHaveLength(2);
    // Sorted by agentId ascending.
    expect(state.attestations.map((a) => a.agentId)).toEqual([101n, 102n]);
    expect(seen.map((e) => e.type)).toContain("fact.requested");
    expect(seen.map((e) => e.type)).toContain("fact.delivered");
    expect(seen.map((e) => e.type)).toContain("payout.confirmed");
  });

  it("rejects an attestation whose agentId is not in the trusted set", async () => {
    const state = makeState(7n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 1,
      trustedAgentIds: new Set(["101"]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 200,
      events: undefined,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    const r = inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 999n, FACT_HASH, RECIPIENT, state.deadline),
    );
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/trusted set/);

    // Add the trusted one — pipeline completes.
    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 101n, FACT_HASH, RECIPIENT, state.deadline),
    );
    await pipelinePromise;
    expect(state.status).toBe("paid");
  });

  it("rejects an attestation whose factHash disagrees with the delivered fact", async () => {
    const state = makeState(8n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 1,
      trustedAgentIds: new Set(["101"]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 200,
      events: undefined,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    const wrongHash = `0x${"ee".repeat(32)}` as Hex;
    const r = inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 101n, wrongHash, RECIPIENT, state.deadline),
    );
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/factHash/);

    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 101n, FACT_HASH, RECIPIENT, state.deadline),
    );
    await pipelinePromise;
    expect(state.status).toBe("paid");
  });

  it("dedups by agentId", async () => {
    const state = makeState(9n);
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const vault = new ScriptedVault({ type: "ok" });
    const inbox = new AttestationInbox();

    const pipelinePromise = runClaimPipeline(state, {
      factProvider,
      vault,
      inbox,
      threshold: 2,
      trustedAgentIds: new Set(["101", "102"]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 200,
      events: undefined,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 101n, FACT_HASH, RECIPIENT, state.deadline),
    );
    const dup = inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 101n, FACT_HASH, RECIPIENT, state.deadline),
    );
    expect(dup.accepted).toBe(false);
    expect(dup.reason).toMatch(/already received/);

    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 102n, FACT_HASH, RECIPIENT, state.deadline),
    );
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
      trustedAgentIds: new Set(["101", "102"]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 50,
      events: undefined,
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
      trustedAgentIds: new Set(["101", "102"]),
      factTimeoutMs: 1_000,
      attestationTimeoutMs: 1_000,
      events: undefined,
    });

    await waitFor(() => inbox.isOpen(state.claimId), 1_000);
    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 101n, FACT_HASH, RECIPIENT, state.deadline),
    );
    inbox.push(
      state.claimId,
      makeAttestation(state.claimId, 102n, FACT_HASH, RECIPIENT, state.deadline),
    );
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
        trustedAgentIds: new Set(["101"]),
        factTimeoutMs: 50,
        attestationTimeoutMs: 1_000,
        events: undefined,
      }),
    ).rejects.toThrow(/fact not delivered/);
    expect(vault.lastArgs).toBeUndefined();
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
