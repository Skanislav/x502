/// HTTP-handler unit tests for the coordinator. Inbox-driven flow: claims
/// are pushed in via POST /claim, the inbox waits for verifier-side skill
/// helpers to POST attestations, vault.payout fires once threshold sigs
/// arrive.

import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";

import { Kind, type SignedAttestation, deriveClaimId, repoIdFromSlug } from "@x502/shared";

import { StaticRepoRegistry } from "../src/adapters/repo-registry.js";
import type { IFactProvider, IVaultWriter } from "../src/providers.js";
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

class NeverFactProvider implements IFactProvider {
  async requestFact(): Promise<void> {}
  awaitFact(): Promise<Hex> {
    return new Promise(() => {});
  }
}

class OkVault implements IVaultWriter {
  async submitPayout(): Promise<Hex> {
    return TX_HASH;
  }
}

function makeCoord(opts?: { factProvider?: IFactProvider }) {
  const repoRegistry = new StaticRepoRegistry();
  repoRegistry.add(REPO_SLUG, 2, [101n, 102n, 103n]);
  return buildCoordinator({
    factProvider: opts?.factProvider ?? new ImmediateFactProvider(),
    vault: new OkVault(),
    repoRegistry,
    factTimeoutMs: 1_000,
    attestationTimeoutMs: 1_000,
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

async function postAttestation(coord: ReturnType<typeof makeCoord>, signed: SignedAttestation) {
  return coord.app.request("/attestation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      claimId: signed.attestation.claimId,
      agentId: signed.agentId.toString(),
      signature: signed.signature,
      attestation: {
        claimId: signed.attestation.claimId,
        recipient: signed.attestation.recipient,
        deadline: signed.attestation.deadline.toString(),
        factHash: signed.attestation.factHash,
      },
    }),
  });
}

function fakeAttestation(
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

describe("GET /health", () => {
  it("reports knownClaims", async () => {
    const coord = makeCoord();
    const r = await coord.app.request("/health");
    expect(r.status).toBe(200);
    const j = (await r.json()) as { knownClaims: number };
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

describe("GET /pending-claims/:agentId", () => {
  it("returns claims awaiting an attestation from this agent (fact delivered, in trusted set)", async () => {
    const coord = makeCoord();
    await postClaim(coord, {
      repoSlug: REPO_SLUG,
      externalId: "42",
      kind: "fix",
      recipient: RECIPIENT,
    });

    // wait for the inbox to open (fact delivered)
    await waitFor(
      () =>
        coord.inbox.isOpen.bind(coord.inbox)(
          deriveClaimId(repoIdFromSlug(REPO_SLUG), 42n, Kind.Fix),
        ),
      1_000,
    );

    const r = await coord.app.request("/pending-claims/101");
    expect(r.status).toBe(200);
    const j = (await r.json()) as {
      agentId: string;
      pending: Array<{ claimId: Hex; repoSlug: string; factHash: Hex }>;
    };
    expect(j.pending).toHaveLength(1);
    expect(j.pending[0]!.repoSlug).toBe(REPO_SLUG);
    expect(j.pending[0]!.factHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("excludes claims for repos that don't trust this agent", async () => {
    const coord = makeCoord();
    await postClaim(coord, {
      repoSlug: REPO_SLUG,
      externalId: "42",
      kind: "fix",
      recipient: RECIPIENT,
    });
    await waitFor(
      () =>
        coord.inbox.isOpen.bind(coord.inbox)(
          deriveClaimId(repoIdFromSlug(REPO_SLUG), 42n, Kind.Fix),
        ),
      1_000,
    );

    const r = await coord.app.request("/pending-claims/999");
    const j = (await r.json()) as { pending: unknown[] };
    expect(j.pending).toHaveLength(0);
  });

  it("400s on a non-bigint agentId", async () => {
    const coord = makeCoord();
    const r = await coord.app.request("/pending-claims/abc");
    expect(r.status).toBe(400);
  });
});

describe("POST /attestation", () => {
  it("end-to-end: 2 valid pushes drive the pipeline to paid", async () => {
    const coord = makeCoord();
    const post = (await (
      await postClaim(coord, {
        repoSlug: REPO_SLUG,
        externalId: "42",
        kind: "fix",
        recipient: RECIPIENT,
      })
    ).json()) as { claimId: Hex };

    // Wait for the inbox to open (fact delivered).
    await waitFor(() => coord.inbox.isOpen(post.claimId), 1_000);

    const state = coord.claims.get(post.claimId)!;
    const factHash = state.factHash!;
    const r1 = await postAttestation(
      coord,
      fakeAttestation(post.claimId, 101n, factHash, RECIPIENT, state.deadline),
    );
    expect(r1.status).toBe(200);
    const r2 = await postAttestation(
      coord,
      fakeAttestation(post.claimId, 102n, factHash, RECIPIENT, state.deadline),
    );
    expect(r2.status).toBe(200);

    // Pipeline runs async — poll until paid.
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

  it("409s when the agent is not in the repo's trusted set", async () => {
    const coord = makeCoord();
    const post = (await (
      await postClaim(coord, {
        repoSlug: REPO_SLUG,
        externalId: "44",
        kind: "fix",
        recipient: RECIPIENT,
      })
    ).json()) as { claimId: Hex };
    await waitFor(() => coord.inbox.isOpen(post.claimId), 1_000);
    const state = coord.claims.get(post.claimId)!;
    const r = await postAttestation(
      coord,
      fakeAttestation(post.claimId, 999n, state.factHash!, RECIPIENT, state.deadline),
    );
    expect(r.status).toBe(409);
  });

  it("400s on malformed payloads", async () => {
    const coord = makeCoord();
    const r = await coord.app.request("/attestation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimId: "not-hex" }),
    });
    expect(r.status).toBe(400);
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
});

async function waitFor(pred: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}
