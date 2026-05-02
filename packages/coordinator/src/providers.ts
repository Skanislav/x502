import type { Kind } from "@x502/shared";
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

/// Submits the EAS-attested payout bundle on chain. The vault validates
/// each UID against its global x502 schema; the coordinator's role is just
/// to pre-select the right UIDs and call payout.
export interface IVaultWriter {
  submitPayout(args: {
    repoId: Hex;
    externalId: bigint;
    kind: Kind;
    recipient: Address;
    deadline: bigint;
    factHash: Hex;
    attestationUIDs: Hex[];
  }): Promise<Hex>;
}

/// Repo registry: maps repoSlug ↔ repoId, vault config (threshold, agent ids
/// for the on-chain config, attester addresses for the off-chain inbox).
export interface IRepoRegistry {
  resolve(slug: string):
    | {
        repoId: Hex;
        threshold: number;
        trustedAgentIds: bigint[];
        trustedAttesters: Address[];
      }
    | undefined;
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
