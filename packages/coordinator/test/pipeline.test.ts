/// Unit tests for the coordinator's claim pipeline state machine. Uses
/// hand-rolled mocks for IFactProvider, IVerifierClient, IVaultWriter — no
/// anvil, no http, no contracts. Exercises the branches the end-to-end test
/// can't cover cheaply (timeouts, reverts, partial verifier accepts).

import { type Address, type Hex, encodeAbiParameters } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  type DemoEvent,
  EventBus,
  Kind,
  type SignedAttestation,
  deriveClaimId,
  repoIdFromSlug,
} from "@x502/shared";

import { runClaimPipeline } from "../src/pipeline.js";
import type {
  IFactProvider,
  IVaultWriter,
  IVerifierClient,
  VerifyRequest,
} from "../src/providers.js";
import type { ClaimState } from "../src/types.js";

// ----------------------------------------------------------------------- mocks

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

interface ScriptedVerifierBehavior {
  type: "accept" | "reject" | "timeout" | "throw";
  reason?: string;
  delayMs?: number;
}

class ScriptedVerifierClient implements IVerifierClient {
  public lastReq?: VerifyRequest;
  constructor(
    public readonly agentId: bigint,
    public readonly endpoint: string,
    public readonly behavior: ScriptedVerifierBehavior,
  ) {}

  async verify(req: VerifyRequest): Promise<SignedAttestation | { rejected: string }> {
    this.lastReq = req;
    const { type, reason, delayMs = 0 } = this.behavior;
    if (delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
    if (type === "reject") return { rejected: reason ?? "rejected" };
    if (type === "throw") throw new Error(reason ?? "verifier crashed");
    if (type === "timeout") {
      await new Promise(() => {}); // hang forever; pipeline's verifierTimeoutMs will race us
      throw new Error("unreachable");
    }
    return {
      agentId: this.agentId,
      signature: `0x${"ab".repeat(65)}` as Hex,
      attestation: {
        claimId: req.repoId, // value unused by pipeline
        recipient: req.recipient,
        deadline: req.deadline,
        factHash: req.factHash,
      },
    };
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

// ---------------------------------------------------------------------- helper

const REPO_SLUG = "x502-protocol/demo";
const FACT_BLOB = `0x${"11".repeat(32)}` as Hex;
const RECIPIENT = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as Address;

function makeState(): ClaimState {
  const repoId = repoIdFromSlug(REPO_SLUG);
  const externalId = 42n;
  const kind = Kind.Fix;
  const claimId = deriveClaimId(repoId, externalId, kind);
  return {
    claimId,
    repoId,
    request: {
      repoSlug: REPO_SLUG,
      externalId,
      kind,
      recipient: RECIPIENT,
    },
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    status: "verifying",
    attestations: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// -------------------------------------------------------------------- pipeline

describe("runClaimPipeline", () => {
  it("happy path: 2-of-3 accept → paid", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
      new ScriptedVerifierClient(103n, "v3", { type: "reject", reason: "lol no" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.status).toBe("paid");
    expect(state.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(state.attestations).toHaveLength(2);
    expect(factProvider.requestCount).toBe(1);
    expect(vault.lastArgs?.attestations).toHaveLength(2);
    // Sorted by agentId for reproducibility
    expect(vault.lastArgs?.attestations.map((a) => a.agentId)).toEqual([101n, 102n]);
  });

  it("clears verifier timeout timers after fast successful verification", async () => {
    vi.useFakeTimers();
    try {
      const state = makeState();
      const factProvider = new FixedFactProvider(FACT_BLOB);
      const verifiers = [
        new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
        new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
      ];
      const vault = new ScriptedVault({ type: "ok" });

      await runClaimPipeline(state, {
        factProvider,
        verifiers,
        vault,
        threshold: 2,
        factTimeoutMs: 1_000,
        verifierTimeoutMs: 1_000,
      });

      expect(state.status).toBe("paid");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("trims to exactly `threshold` even when more verifiers accept", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
      new ScriptedVerifierClient(103n, "v3", { type: "accept" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.attestations).toHaveLength(2);
    // Lowest agentIds chosen
    expect(vault.lastArgs?.attestations.map((a) => a.agentId)).toEqual([101n, 102n]);
  });

  it("sorts accepted verifier attestations by agentId when responses arrive out of order", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(103n, "v3", { type: "accept", delayMs: 1 }),
      new ScriptedVerifierClient(101n, "v1", { type: "accept", delayMs: 30 }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept", delayMs: 10 }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 3,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.status).toBe("paid");
    expect(state.attestations.map((a) => a.agentId)).toEqual([101n, 102n, 103n]);
    expect(vault.lastArgs?.attestations.map((a) => a.agentId)).toEqual([101n, 102n, 103n]);
  });

  it("fails with insufficient signatures when only 1-of-3 accepts", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "reject", reason: "stale" }),
      new ScriptedVerifierClient(103n, "v3", { type: "reject", reason: "untrusted" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.status).toBe("failed");
    expect(state.error).toContain("insufficient verifier signatures: 1/2");
    expect(state.error).toContain("stale");
    expect(vault.lastArgs).toBeUndefined();
  });

  it("fails with rejection details when all verifiers reject", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "reject", reason: "stale" }),
      new ScriptedVerifierClient(102n, "v2", { type: "reject", reason: "untrusted" }),
      new ScriptedVerifierClient(103n, "v3", { type: "reject", reason: "duplicate" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.status).toBe("failed");
    expect(state.error).toContain("insufficient verifier signatures: 0/2");
    expect(state.error).toContain("stale");
    expect(state.error).toContain("untrusted");
    expect(state.error).toContain("duplicate");
    expect(vault.lastArgs).toBeUndefined();
  });

  it("counts verifier timeouts in insufficient-signature error details", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "timeout" }),
      new ScriptedVerifierClient(103n, "v3", { type: "reject", reason: "untrusted" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 50,
    });

    expect(state.status).toBe("failed");
    expect(state.error).toContain("insufficient verifier signatures: 1/2");
    expect(state.error).toContain("verifier timeout");
    expect(state.error).toContain("untrusted");
    expect(vault.lastArgs).toBeUndefined();
  });

  it("fails when fact provider times out", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider("timeout");
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await expect(
      runClaimPipeline(state, {
        factProvider,
        verifiers,
        vault,
        threshold: 2,
        factTimeoutMs: 50,
        verifierTimeoutMs: 1_000,
      }),
    ).rejects.toThrow(/fact not delivered/);
    expect(vault.lastArgs).toBeUndefined();
  });

  it("succeeds when one verifier hangs but two return in time", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
      new ScriptedVerifierClient(103n, "v3", { type: "timeout" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 50,
    });

    expect(state.status).toBe("paid");
    expect(vault.lastArgs?.attestations.map((a) => a.agentId)).toEqual([101n, 102n]);
  });

  it("survives a verifier that throws", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
      new ScriptedVerifierClient(103n, "v3", { type: "throw", reason: "boom" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.status).toBe("paid");
  });

  it("transitions to failed when vault.submitPayout reverts", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
    ];
    const vault = new ScriptedVault({
      type: "revert",
      reason: "execution reverted: AlreadyPaid()",
    });

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.status).toBe("failed");
    expect(state.error).toContain("vault.payout reverted");
    expect(state.error).toContain("AlreadyPaid");
  });

  it("publishes fact.requested + fact.delivered + payout events when an event bus is provided", async () => {
    const state = makeState();
    const factBlob = encodeAbiParameters(
      [{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }, { type: "address" }],
      [1, 12345n, `0x${"00".repeat(32)}` as Hex, RECIPIENT],
    );
    const factProvider = new FixedFactProvider(factBlob);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });
    const events = new EventBus();
    const seen: DemoEvent[] = [];
    events.subscribe((e) => seen.push(e));

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
      events,
    });

    const types = seen.map((e) => e.type);
    expect(types).toContain("fact.requested");
    expect(types).toContain("fact.delivered");
    expect(types).toContain("payout.submitted");
    expect(types).toContain("payout.confirmed");

    const delivered = seen.find((e) => e.type === "fact.delivered");
    if (delivered?.type !== "fact.delivered") throw new Error("missing fact.delivered");
    expect(delivered.status).toBe(1);
    expect(delivered.mergedBlock).toBe("12345");
    expect(delivered.ghAuthorBinding.toLowerCase()).toBe(RECIPIENT.toLowerCase());
  });

  it("does not throw when event-bus decoding fails on a malformed fact blob", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const verifiers = [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
    ];
    const vault = new ScriptedVault({ type: "ok" });
    const events = new EventBus();
    const seen: DemoEvent[] = [];
    events.subscribe((e) => seen.push(e));

    await runClaimPipeline(state, {
      factProvider,
      verifiers,
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
      events,
    });

    expect(state.status).toBe("paid");
    // fact.requested still fires (it does not depend on decoding); the
    // fact.delivered emit is best-effort and may be skipped.
    expect(seen.map((e) => e.type)).toContain("fact.requested");
    expect(seen.map((e) => e.type)).toContain("payout.confirmed");
  });

  it("each verifier receives the resolved factHash, not a guess", async () => {
    const state = makeState();
    const factProvider = new FixedFactProvider(FACT_BLOB);
    const v1 = new ScriptedVerifierClient(101n, "v1", { type: "accept" });
    const v2 = new ScriptedVerifierClient(102n, "v2", { type: "accept" });
    const vault = new ScriptedVault({ type: "ok" });

    await runClaimPipeline(state, {
      factProvider,
      verifiers: [v1, v2],
      vault,
      threshold: 2,
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });

    expect(state.factHash).toBeDefined();
    expect(v1.lastReq?.factHash).toBe(state.factHash);
    expect(v2.lastReq?.factHash).toBe(state.factHash);
  });
});
