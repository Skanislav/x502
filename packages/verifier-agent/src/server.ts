import { Hono } from "hono";
import { type Address, type Hex, isAddress, isHex } from "viem";
import {
  deriveClaimId,
  Kind,
  type Attestation,
} from "@x502/shared";

import type { DecisionPolicy } from "./decide.js";
import { signAttestation, type SignerConfig } from "./sign.js";

export interface VerifierServerOptions {
  signer: SignerConfig;
  policy: DecisionPolicy;
  /// Slug used for logging + decision context. The agent only verifies for
  /// claims whose repo matches this. Coordinator still re-checks repo binding
  /// onchain via the vault config.
  repoSlugResolver: (repoId: Hex) => string | undefined;
}

interface VerifyBody {
  repoId: unknown;
  externalId: unknown;
  kind: unknown;
  recipient: unknown;
  deadline: unknown;
  factHash: unknown;
  agentIdReveal?: unknown;
  saltReveal?: unknown;
}

function parseBody(b: VerifyBody) {
  if (!isHex(b.repoId) || (b.repoId as string).length !== 66) throw new Error("bad repoId");
  if (typeof b.externalId !== "string" && typeof b.externalId !== "number")
    throw new Error("bad externalId");
  if (typeof b.kind !== "number" || ![0, 1, 2, 3].includes(b.kind)) throw new Error("bad kind");
  if (!isAddress(b.recipient as string)) throw new Error("bad recipient");
  if (typeof b.deadline !== "string" && typeof b.deadline !== "number")
    throw new Error("bad deadline");
  if (!isHex(b.factHash) || (b.factHash as string).length !== 66) throw new Error("bad factHash");
  return {
    repoId: b.repoId as Hex,
    externalId: BigInt(b.externalId as string | number),
    kind: b.kind as Kind,
    recipient: b.recipient as Address,
    deadline: BigInt(b.deadline as string | number),
    factHash: b.factHash as Hex,
    agentIdReveal: b.agentIdReveal !== undefined ? BigInt(b.agentIdReveal as string | number) : undefined,
    saltReveal: b.saltReveal !== undefined ? (b.saltReveal as Hex) : undefined,
  };
}

export function buildVerifierApp(opts: VerifierServerOptions) {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({
      ok: true,
      agentId: opts.signer.agentId.toString(),
      address: opts.signer.account.address,
      vault: opts.signer.vault,
      chainId: opts.signer.chainId,
    }),
  );

  app.post("/verify", async (c) => {
    let parsed: ReturnType<typeof parseBody>;
    try {
      parsed = parseBody((await c.req.json()) as VerifyBody);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }

    const repoSlug = opts.repoSlugResolver(parsed.repoId);
    if (!repoSlug) return c.json({ error: "unknown repoId" }, 404);

    const decision = await opts.policy.decide({
      repoSlug,
      externalId: parsed.externalId,
      kind: parsed.kind,
      recipient: parsed.recipient,
      factHash: parsed.factHash,
      agentIdReveal: parsed.agentIdReveal,
      saltReveal: parsed.saltReveal,
    });

    if (!decision.accept) {
      return c.json({ accepted: false, reason: decision.reason }, 403);
    }

    const claimId = deriveClaimId(parsed.repoId, parsed.externalId, parsed.kind);
    const attestation: Attestation = {
      claimId,
      recipient: parsed.recipient,
      deadline: parsed.deadline,
      factHash: parsed.factHash,
    };

    const signed = await signAttestation(opts.signer, attestation);
    return c.json(
      {
        accepted: true,
        reason: decision.reason,
        agentId: signed.agentId.toString(),
        signature: signed.signature,
        attestation: {
          claimId: attestation.claimId,
          recipient: attestation.recipient,
          deadline: attestation.deadline.toString(),
          factHash: attestation.factHash,
        },
      },
      200,
    );
  });

  return app;
}
