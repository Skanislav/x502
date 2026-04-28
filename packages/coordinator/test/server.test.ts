/// HTTP-handler unit tests for the coordinator. Same mock-based approach as
/// pipeline.test.ts — no anvil, no http port. We exercise via Hono's
/// `app.request()` and assert response status + headers + bodies for the
/// branches the integration test doesn't cover (bad input, unknown repo,
/// unknown claim, polling state machine, dedup).

import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";

import { Kind, type SignedAttestation, deriveClaimId, repoIdFromSlug } from "@x502/shared";

import { StaticRepoRegistry } from "../src/adapters/repo-registry.js";
import type {
  IFactProvider,
  IVaultWriter,
  IVerifierClient,
  VerifyRequest,
} from "../src/providers.js";
import { buildCoordinator } from "../src/server.js";

const RECIPIENT = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as Address;
const REPO_SLUG = "x502-protocol/demo";
const FACT_BLOB = `0x${"11".repeat(32)}` as Hex;
const TX_HASH = `0x${"cd".repeat(32)}` as Hex;

class ImmediateFactProvider implements IFactProvider {
  async requestFact(): Promise<void> {}
  async awaitFact(): Promise<Hex> {
    return FACT_BLOB;
  }
}

/// Never resolves the fact — keeps claims pinned in `verifying` so we can
/// assert the polling response shape.
class NeverFactProvider implements IFactProvider {
  async requestFact(): Promise<void> {}
  awaitFact(): Promise<Hex> {
    return new Promise(() => {});
  }
}

class AcceptVerifier implements IVerifierClient {
  constructor(
    public readonly agentId: bigint,
    public readonly endpoint: string,
  ) {}
  async verify(req: VerifyRequest): Promise<SignedAttestation> {
    return {
      agentId: this.agentId,
      signature: `0x${"ab".repeat(65)}` as Hex,
      attestation: {
        claimId: req.repoId,
        recipient: req.recipient,
        deadline: req.deadline,
        factHash: req.factHash,
      },
    };
  }
}

class OkVault implements IVaultWriter {
  async submitPayout(): Promise<Hex> {
    return TX_HASH;
  }
}

function makeCoord(opts?: {
  factProvider?: IFactProvider;
  verifiers?: IVerifierClient[];
}) {
  const repoRegistry = new StaticRepoRegistry();
  repoRegistry.add(REPO_SLUG, 2, [101n, 102n, 103n]);
  return buildCoordinator({
    factProvider: opts?.factProvider ?? new ImmediateFactProvider(),
    vault: new OkVault(),
    repoRegistry,
    verifiers: opts?.verifiers ?? [
      new AcceptVerifier(101n, "v1"),
      new AcceptVerifier(102n, "v2"),
      new AcceptVerifier(103n, "v3"),
    ],
    factTimeoutMs: 1_000,
    verifierTimeoutMs: 1_000,
    deadlineWindowSec: 60,
    pollRetryAfterSec: 1,
  });
}

async function postClaim(coord: ReturnType<typeof makeCoord>, body: Record<string, unknown>) {
  return coord.app.request("/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /health", () => {
  it("reports verifier count + claim count", async () => {
    const coord = makeCoord();
    const r = await coord.app.request("/health");
    expect(r.status).toBe(200);
    const j = (await r.json()) as { verifiers: number; knownClaims: number };
    expect(j.verifiers).toBe(3);
    expect(j.knownClaims).toBe(0);
  });
});

describe("POST /claim — input validation", () => {
  it("rejects bad repoSlug", async () => {
    const coord = makeCoord();
    const r = await postClaim(coord, {
      repoSlug: "not-a-slug",
      externalId: "1",
      kind: "report",
      recipient: RECIPIENT,
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toMatch(/repoSlug/);
  });

  it("rejects unknown kind", async () => {
    const coord = makeCoord();
    const r = await postClaim(coord, {
      repoSlug: REPO_SLUG,
      externalId: "1",
      kind: "wat",
      recipient: RECIPIENT,
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toMatch(/kind/);
  });

  it("rejects non-address recipient", async () => {
    const coord = makeCoord();
    const r = await postClaim(coord, {
      repoSlug: REPO_SLUG,
      externalId: "1",
      kind: "fix",
      recipient: "not-an-address",
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toMatch(/recipient/);
  });

  it("404s for unknown repo", async () => {
    const coord = makeCoord();
    const r = await postClaim(coord, {
      repoSlug: "nobody/here",
      externalId: "1",
      kind: "fix",
      recipient: RECIPIENT,
    });
    expect(r.status).toBe(404);
  });

  it("503s when too few trusted verifiers are reachable", async () => {
    // Repo trusts 3 agents but the coordinator only knows 1.
    const repoRegistry = new StaticRepoRegistry();
    repoRegistry.add(REPO_SLUG, 2, [101n, 102n, 103n]);
    const coord = buildCoordinator({
      factProvider: new ImmediateFactProvider(),
      vault: new OkVault(),
      repoRegistry,
      verifiers: [new AcceptVerifier(101n, "v1")],
      factTimeoutMs: 1_000,
      verifierTimeoutMs: 1_000,
    });
    const r = await postClaim(coord, {
      repoSlug: REPO_SLUG,
      externalId: "1",
      kind: "fix",
      recipient: RECIPIENT,
    });
    expect(r.status).toBe(503);
  });
});

describe("POST /claim — successful submission", () => {
  it("returns 200 + claimId + pollUrl", async () => {
    const coord = makeCoord({ factProvider: new NeverFactProvider() });
    const r = await postClaim(coord, {
      repoSlug: REPO_SLUG,
      externalId: "42",
      kind: "fix",
      recipient: RECIPIENT,
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { claimId: Hex; pollUrl: string; status: string };
    const expectedId = deriveClaimId(repoIdFromSlug(REPO_SLUG), 42n, Kind.Fix);
    expect(j.claimId).toBe(expectedId);
    expect(j.pollUrl).toBe(`/payout/${expectedId}`);
    expect(j.status).toBe("verifying");
  });

  it("accepts numeric externalId, numeric agentIdReveal, and saltReveal", async () => {
    const coord = makeCoord({ factProvider: new NeverFactProvider() });
    const saltReveal = `0x${"77".repeat(32)}` as Hex;

    const r = await postClaim(coord, {
      repoSlug: REPO_SLUG,
      externalId: 43,
      kind: "fix",
      recipient: RECIPIENT,
      agentIdReveal: 101,
      saltReveal,
    });

    expect(r.status).toBe(200);
    const j = (await r.json()) as { claimId: Hex };
    const state = coord.claims.get(j.claimId);
    expect(state?.request.externalId).toBe(43n);
    expect(state?.request.agentIdReveal).toBe(101n);
    expect(state?.request.saltReveal).toBe(saltReveal);
  });

  it("dedups concurrent claims by claimId", async () => {
    const coord = makeCoord({ factProvider: new NeverFactProvider() });
    const body = {
      repoSlug: REPO_SLUG,
      externalId: "42",
      kind: "fix",
      recipient: RECIPIENT,
    };
    const first = (await (await postClaim(coord, body)).json()) as { claimId: Hex };
    const second = (await (await postClaim(coord, body)).json()) as {
      claimId: Hex;
      note?: string;
    };
    expect(second.claimId).toBe(first.claimId);
    expect(second.note).toMatch(/already in flight/);
  });
});

describe("GET /payout/:claimId polling", () => {
  it("404s for unknown claimId", async () => {
    const coord = makeCoord();
    const r = await coord.app.request(`/payout/${`0x${"00".repeat(32)}`}`);
    expect(r.status).toBe(404);
  });

  it("202 + Retry-After while verifying", async () => {
    const coord = makeCoord({ factProvider: new NeverFactProvider() });
    const post = (await (
      await postClaim(coord, {
        repoSlug: REPO_SLUG,
        externalId: "42",
        kind: "fix",
        recipient: RECIPIENT,
      })
    ).json()) as { claimId: Hex };

    const r = await coord.app.request(`/payout/${post.claimId}`);
    expect(r.status).toBe(202);
    expect(r.headers.get("Retry-After")).toBe("1");
    const body = (await r.json()) as { status: string; factReady: boolean; sigs: number };
    expect(body.status).toBe("verifying");
    expect(body.factReady).toBe(false);
    expect(body.sigs).toBe(0);
  });

  it("200 with txHash once paid", async () => {
    const coord = makeCoord(); // immediate fact + 3 accept verifiers
    const post = (await (
      await postClaim(coord, {
        repoSlug: REPO_SLUG,
        externalId: "42",
        kind: "fix",
        recipient: RECIPIENT,
      })
    ).json()) as { claimId: Hex };

    // Pipeline runs async — poll a few times until status flips.
    let body: { status: string; txHash?: Hex } | undefined;
    for (let i = 0; i < 30; i++) {
      const r = await coord.app.request(`/payout/${post.claimId}`);
      if (r.status === 200) {
        body = (await r.json()) as { status: string; txHash?: Hex };
        break;
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    expect(body?.status).toBe("paid");
    expect(body?.txHash).toBe(TX_HASH);
  });
});
