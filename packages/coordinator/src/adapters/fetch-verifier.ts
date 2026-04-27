import type { Kind, SignedAttestation } from "@x502/shared";
import type { Address, Hex } from "viem";

import type { IVerifierClient, VerifyRequest } from "../providers.js";

/// Plain fetch-based verifier client. Pluggable `fetchImpl` lets tests inject
/// an in-process Hono `app.request` and lets production swap in
/// `wrapFetchWithPayment(fetch, ...)` from x402-fetch for x402 settlement.
export class FetchVerifierClient implements IVerifierClient {
  constructor(
    public readonly agentId: bigint,
    public readonly endpoint: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(req: VerifyRequest): Promise<SignedAttestation | { rejected: string }> {
    const body = {
      repoId: req.repoId,
      externalId: req.externalId.toString(),
      kind: req.kind,
      recipient: req.recipient,
      deadline: req.deadline.toString(),
      factHash: req.factHash,
      ...(req.agentIdReveal !== undefined ? { agentIdReveal: req.agentIdReveal.toString() } : {}),
      ...(req.saltReveal !== undefined ? { saltReveal: req.saltReveal } : {}),
    };
    const r = await this.fetchImpl(`${this.endpoint}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 200) {
      const j = (await r.json()) as {
        agentId: string;
        signature: Hex;
        attestation: { claimId: Hex; recipient: Address; deadline: string; factHash: Hex };
      };
      return {
        agentId: BigInt(j.agentId),
        signature: j.signature,
        attestation: {
          claimId: j.attestation.claimId,
          recipient: j.attestation.recipient,
          deadline: BigInt(j.attestation.deadline),
          factHash: j.attestation.factHash,
        },
      };
    }
    let reason = `verifier ${this.endpoint} returned ${r.status}`;
    try {
      const j = (await r.json()) as { reason?: string; error?: string };
      reason = j.reason ?? j.error ?? reason;
    } catch {
      /* keep default */
    }
    return { rejected: reason };
  }
}
