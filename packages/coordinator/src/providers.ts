import type { Kind, SignedAttestation } from "@x502/shared";
import type { Hono } from "hono";
import type { Address, Hex } from "viem";

/// Triggers a fact request on chain and resolves with the fact blob when the
/// oracle (real: Chainlink Functions; mock: test helper) fulfills.
export interface IFactProvider {
  /// Synchronously queue a fact request and return immediately. The fact
  /// becomes observable via `awaitFact(claimId)`.
  requestFact(claimId: Hex, repoSlug: string, externalId: bigint, kind: Kind): Promise<void>;
  /// Resolves with the fact blob once delivered, or rejects on timeout.
  awaitFact(claimId: Hex, timeoutMs: number): Promise<Hex>;
}

/// Wraps a single verifier agent. Real impl uses fetch (optionally x402-wrapped);
/// mock impl can call the in-process Hono app directly.
export interface IVerifierClient {
  agentId: bigint;
  endpoint: string;
  verify(req: VerifyRequest): Promise<SignedAttestation | { rejected: string }>;
}

export interface VerifyRequest {
  repoId: Hex;
  externalId: bigint;
  kind: Kind;
  recipient: Address;
  deadline: bigint;
  factHash: Hex;
  agentIdReveal?: bigint;
  saltReveal?: Hex;
}

/// Submits the assembled payout bundle on chain.
export interface IVaultWriter {
  submitPayout(args: {
    repoId: Hex;
    externalId: bigint;
    kind: Kind;
    recipient: Address;
    deadline: bigint;
    factHash: Hex;
    attestations: SignedAttestation[];
  }): Promise<Hex>;
}

/// Repo registry: maps repoSlug ↔ repoId, vault config (threshold etc.).
export interface IRepoRegistry {
  resolve(slug: string): { repoId: Hex; threshold: number; trustedAgentIds: bigint[] } | undefined;
  resolveSlug(repoId: Hex): string | undefined;
}

/// x402 anti-spam gate. Real impl wraps `x402-hono`'s paymentMiddleware. Mock
/// impl is a no-op. Mounts onto the given app — `paymentMiddleware` registers
/// itself globally and uses path patterns to gate, so this is the natural seam.
export interface IPaymentGate {
  apply(app: Hono): void;
}

export class NoopPaymentGate implements IPaymentGate {
  apply(_app: Hono): void {
    // pass-through
  }
}
