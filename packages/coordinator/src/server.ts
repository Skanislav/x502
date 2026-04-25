import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";

import { deriveClaimId, Kind, type KindName } from "@x502/shared";

import {
  type IFactProvider,
  type IPaymentGate,
  type IRepoRegistry,
  type IVaultWriter,
  type IVerifierClient,
  NoopPaymentGate,
} from "./providers.js";
import { runClaimPipeline } from "./pipeline.js";
import type { ClaimRequestBody, ClaimState } from "./types.js";

const KindByName: Record<KindName, Kind> = {
  report: Kind.Report,
  triage: Kind.Triage,
  fix: Kind.Fix,
  docs_tests: Kind.DocsTests,
};

export interface CoordinatorOptions {
  factProvider: IFactProvider;
  vault: IVaultWriter;
  repoRegistry: IRepoRegistry;
  /// All known verifiers. Each claim's repo config narrows to a trusted subset.
  verifiers: IVerifierClient[];
  paymentGate?: IPaymentGate;
  /// How long the pipeline will wait for the Chainlink Functions fact.
  factTimeoutMs?: number;
  /// How long the pipeline will wait for each verifier.
  verifierTimeoutMs?: number;
  /// EIP-712 attestation deadline window (now + windowSec).
  deadlineWindowSec?: number;
  /// Poll Retry-After hint, in seconds.
  pollRetryAfterSec?: number;
}

interface PostClaimBody {
  repoSlug: unknown;
  externalId: unknown;
  kind: unknown;
  recipient: unknown;
  agentIdReveal?: unknown;
  saltReveal?: unknown;
}

function parseClaim(b: PostClaimBody): ClaimRequestBody {
  if (typeof b.repoSlug !== "string" || !b.repoSlug.includes("/"))
    throw new Error("repoSlug must be 'owner/repo'");
  if (typeof b.externalId !== "string" && typeof b.externalId !== "number")
    throw new Error("externalId required");
  if (typeof b.kind !== "string" || !(b.kind in KindByName))
    throw new Error(`kind must be one of ${Object.keys(KindByName).join(", ")}`);
  if (typeof b.recipient !== "string" || !isAddress(b.recipient))
    throw new Error("recipient must be 0x-address");
  return {
    repoSlug: b.repoSlug,
    externalId: BigInt(b.externalId as string | number),
    kind: KindByName[b.kind as KindName],
    recipient: b.recipient as Address,
    agentIdReveal: b.agentIdReveal !== undefined ? BigInt(b.agentIdReveal as string | number) : undefined,
    saltReveal: b.saltReveal !== undefined ? (b.saltReveal as Hex) : undefined,
  };
}

export interface Coordinator {
  app: Hono;
  /// In-memory claim store (exposed for tests / introspection).
  claims: Map<Hex, ClaimState>;
}

export function buildCoordinator(opts: CoordinatorOptions): Coordinator {
  const paymentGate = opts.paymentGate ?? new NoopPaymentGate();
  const factTimeoutMs = opts.factTimeoutMs ?? 120_000;
  const verifierTimeoutMs = opts.verifierTimeoutMs ?? 30_000;
  const deadlineWindowSec = opts.deadlineWindowSec ?? 30 * 60;
  const pollRetryAfterSec = opts.pollRetryAfterSec ?? 5;

  const claims = new Map<Hex, ClaimState>();
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({ ok: true, knownClaims: claims.size, verifiers: opts.verifiers.length }),
  );

  app.post("/claim", async (c) => {
    const gateResp = await paymentGate.check(c.req.raw.headers);
    if (gateResp) return gateResp;

    let parsed: ClaimRequestBody;
    try {
      parsed = parseClaim((await c.req.json()) as PostClaimBody);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }

    const repo = opts.repoRegistry.resolve(parsed.repoSlug);
    if (!repo) return c.json({ error: `unknown repo ${parsed.repoSlug}` }, 404);

    const claimId = deriveClaimId(repo.repoId, parsed.externalId, parsed.kind);
    if (claims.has(claimId)) {
      const existing = claims.get(claimId)!;
      return c.json({
        claimId,
        pollUrl: `/payout/${claimId}`,
        status: existing.status,
        note: "claim already in flight",
      });
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineWindowSec);
    const state: ClaimState = {
      claimId,
      repoId: repo.repoId,
      request: parsed,
      deadline,
      status: "verifying",
      attestations: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    claims.set(claimId, state);

    // Filter verifiers to the repo's trusted set
    const trusted = new Set(repo.trustedAgentIds.map((id) => id.toString()));
    const repoVerifiers = opts.verifiers.filter((v) => trusted.has(v.agentId.toString()));
    if (repoVerifiers.length < repo.threshold) {
      state.status = "failed";
      state.error = `repo trusts ${repo.trustedAgentIds.length} agents, coordinator only knows ${repoVerifiers.length}`;
      return c.json({ error: state.error }, 503);
    }

    // Fire pipeline; do NOT await — return poll URL immediately.
    runClaimPipeline(state, {
      factProvider: opts.factProvider,
      verifiers: repoVerifiers,
      vault: opts.vault,
      threshold: repo.threshold,
      factTimeoutMs,
      verifierTimeoutMs,
    }).catch((e) => {
      state.status = "failed";
      state.error = `pipeline crashed: ${(e as Error).message}`;
      state.updatedAt = Date.now();
    });

    return c.json({ claimId, pollUrl: `/payout/${claimId}`, status: state.status }, 200);
  });

  app.get("/payout/:claimId", (c) => {
    const claimId = c.req.param("claimId") as Hex;
    const state = claims.get(claimId);
    if (!state) return c.json({ error: "unknown claimId" }, 404);

    if (state.status === "paid") {
      return c.json({
        status: "paid",
        txHash: state.txHash,
        claimId,
        recipient: state.request.recipient,
      });
    }
    if (state.status === "failed") {
      // Use 410 Gone — claim cannot be revived.
      return c.json({ status: "failed", error: state.error, claimId }, 410);
    }
    // Pending: 202 + Retry-After
    return c.json(
      { status: state.status, claimId, factReady: state.factHash !== undefined, sigs: state.attestations.length },
      202,
      { "Retry-After": String(pollRetryAfterSec) },
    );
  });

  return { app, claims };
}
