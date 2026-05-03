import { EventBus, Kind, type KindName, deriveClaimId } from "@x502/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { type Address, type Hex, isAddress } from "viem";

import { AttestationInbox } from "./inbox.js";
import { runClaimPipeline } from "./pipeline.js";
import {
  type IFactProvider,
  type IPaymentGate,
  type IRepoRegistry,
  type IVaultWriter,
  NoopPaymentGate,
} from "./providers.js";
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
  paymentGate?: IPaymentGate;
  /// How long the pipeline will wait for the Chainlink Functions fact.
  factTimeoutMs?: number;
  /// How long the pipeline will wait for verifiers to publish EAS
  /// attestations after the fact has been delivered. Verifiers are humans
  /// driving `claude` locally, so this is generous (default 5 min).
  attestationTimeoutMs?: number;
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
    agentIdReveal:
      b.agentIdReveal !== undefined ? BigInt(b.agentIdReveal as string | number) : undefined,
    saltReveal: b.saltReveal !== undefined ? (b.saltReveal as Hex) : undefined,
  };
}

export interface Coordinator {
  app: Hono;
  /// In-memory claim store (exposed for tests / introspection).
  claims: Map<Hex, ClaimState>;
  /// Event bus the demo UI subscribes to via SSE. Tests can subscribe directly.
  events: EventBus;
  /// Per-claim attestation inbox. The EAS event watcher (in main.ts)
  /// pushes observed attestations here; tests can drive it directly.
  inbox: AttestationInbox;
}

export function buildCoordinator(opts: CoordinatorOptions): Coordinator {
  const paymentGate = opts.paymentGate ?? new NoopPaymentGate();
  const factTimeoutMs = opts.factTimeoutMs ?? 120_000;
  const attestationTimeoutMs = opts.attestationTimeoutMs ?? 5 * 60_000;
  const deadlineWindowSec = opts.deadlineWindowSec ?? 30 * 60;
  const pollRetryAfterSec = opts.pollRetryAfterSec ?? 5;

  const claims = new Map<Hex, ClaimState>();
  const events = new EventBus();
  const inbox = new AttestationInbox();
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["content-type"],
    }),
  );

  paymentGate.apply(app);

  app.get("/health", (c) => c.json({ ok: true, knownClaims: claims.size }));

  app.post("/claim", async (c) => {
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
      attestationUIDs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    claims.set(claimId, state);

    events.publish({
      type: "claim.opened",
      claimId,
      repoSlug: parsed.repoSlug,
      kind: parsed.kind,
      recipient: parsed.recipient,
      ts: Date.now(),
    });

    runClaimPipeline(state, {
      factProvider: opts.factProvider,
      vault: opts.vault,
      inbox,
      threshold: repo.threshold,
      trustedAttesters: new Set(repo.trustedAttesters.map((a) => a.toLowerCase())),
      factTimeoutMs,
      attestationTimeoutMs,
      events,
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
      return c.json({ status: "failed", error: state.error, claimId }, 410);
    }
    return c.json(
      {
        status: state.status,
        claimId,
        factReady: state.factHash !== undefined,
        sigs: inbox.countOf(claimId),
      },
      202,
      { "Retry-After": String(pollRetryAfterSec) },
    );
  });

  /// Verifier-side skills call this to discover claims they should attest.
  /// Returns claims where:
  ///   - state is `verifying` (not yet paid/failed)
  ///   - the fact has been delivered (so the skill knows the factHash)
  ///   - this agentId is in the repo's trusted set
  app.get("/pending-claims/:agentId", (c) => {
    const idStr = c.req.param("agentId");
    let agentId: bigint;
    try {
      agentId = BigInt(idStr);
    } catch {
      return c.json({ error: "agentId must be a bigint string" }, 400);
    }
    const pending: Array<{
      claimId: Hex;
      repoSlug: string;
      externalId: string;
      kind: number;
      recipient: Address;
      deadline: string;
      factHash: Hex;
      agentIdReveal?: string;
      saltReveal?: Hex;
    }> = [];
    for (const state of claims.values()) {
      if (state.status !== "verifying") continue;
      if (!state.factHash) continue;
      const slug = opts.repoRegistry.resolveSlug(state.repoId);
      if (!slug) continue;
      const repo = opts.repoRegistry.resolve(slug);
      if (!repo) continue;
      if (!repo.trustedAgentIds.some((id) => id === agentId)) continue;
      pending.push({
        claimId: state.claimId,
        repoSlug: slug,
        externalId: state.request.externalId.toString(),
        kind: state.request.kind,
        recipient: state.request.recipient,
        deadline: state.deadline.toString(),
        factHash: state.factHash,
        agentIdReveal: state.request.agentIdReveal?.toString(),
        saltReveal: state.request.saltReveal,
      });
    }
    return c.json({ agentId: idStr, pending });
  });

  app.get("/events", (c) =>
    streamSSE(c, async (stream) => {
      const sub = events.subscribe((event) => {
        stream.writeSSE({ data: JSON.stringify(event) }).catch(() => {
          /* writer closed — handled below */
        });
      });
      stream.onAbort(() => sub.close());
      await new Promise<void>((res) => {
        stream.onAbort(() => res());
      });
    }),
  );

  return { app, claims, events, inbox };
}
