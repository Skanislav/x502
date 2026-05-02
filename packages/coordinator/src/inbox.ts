import type { SignedAttestation } from "@x502/shared";
import type { Hex } from "viem";

/// Per-claim inbox where verifier-side skill helpers POST signed
/// attestations. The pipeline `await`s on each claimId; the HTTP handler
/// pushes attestations as they arrive. When the threshold is reached the
/// awaiting promise resolves with a deterministically-sorted slice of
/// `threshold` sigs (lowest agentIds first), and the inbox forgets the
/// claim. On timeout it forgets the claim and rejects.
///
/// Each agentId can submit at most once per claim; duplicate pushes are
/// rejected by `push()`. The inbox does NOT validate signatures — the vault
/// re-checks via `ERC6492SignatureChecker.isValidSig` at payout time, so
/// invalid sigs only waste their submitter's gas (they cause the eventual
/// `vault.payout` call to revert, surfaced as a `failed` claim).
export interface InboxAwaitArgs {
  claimId: Hex;
  factHash: Hex;
  threshold: number;
  trustedAgentIds: Set<string>;
  timeoutMs: number;
}

export interface PushResult {
  accepted: boolean;
  reason?: string;
  /// Total accepted sigs after this push; only set on success.
  total?: number;
  threshold?: number;
}

interface Waiter {
  threshold: number;
  factHash: Hex;
  trustedAgentIds: Set<string>;
  sigs: SignedAttestation[];
  seenAgentIds: Set<string>;
  resolve: (sigs: SignedAttestation[]) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class AttestationInbox {
  private readonly waiters = new Map<Hex, Waiter>();

  /// Snapshot of current sig counts for /payout polling.
  countOf(claimId: Hex): number {
    return this.waiters.get(claimId)?.sigs.length ?? 0;
  }

  /// Whether the inbox is still expecting sigs for this claim. Used to
  /// reject pushes for claims whose pipeline has already moved on.
  isOpen(claimId: Hex): boolean {
    return this.waiters.has(claimId);
  }

  await(args: InboxAwaitArgs): Promise<SignedAttestation[]> {
    return new Promise((resolve, reject) => {
      if (this.waiters.has(args.claimId)) {
        reject(new Error(`inbox already awaiting ${args.claimId}`));
        return;
      }
      const timer = setTimeout(() => {
        const w = this.waiters.get(args.claimId);
        this.waiters.delete(args.claimId);
        reject(
          new Error(`attestation timeout: only got ${w?.sigs.length ?? 0}/${args.threshold} sigs`),
        );
      }, args.timeoutMs);
      this.waiters.set(args.claimId, {
        threshold: args.threshold,
        factHash: args.factHash,
        trustedAgentIds: args.trustedAgentIds,
        sigs: [],
        seenAgentIds: new Set(),
        resolve,
        reject,
        timer,
      });
    });
  }

  /// Push one attestation. Returns the accept/reject reason. Triggers the
  /// awaiting promise once threshold is reached.
  push(claimId: Hex, attestation: SignedAttestation): PushResult {
    const w = this.waiters.get(claimId);
    if (!w) return { accepted: false, reason: "no active claim awaiting attestations" };

    if (attestation.attestation.factHash.toLowerCase() !== w.factHash.toLowerCase()) {
      return { accepted: false, reason: "attestation.factHash does not match claim factHash" };
    }
    const id = attestation.agentId.toString();
    if (!w.trustedAgentIds.has(id)) {
      return { accepted: false, reason: `agentId ${id} is not in repo's trusted set` };
    }
    if (w.seenAgentIds.has(id)) {
      return { accepted: false, reason: `attestation already received for agentId ${id}` };
    }

    w.seenAgentIds.add(id);
    w.sigs.push(attestation);

    if (w.sigs.length >= w.threshold) {
      clearTimeout(w.timer);
      this.waiters.delete(claimId);
      // Deterministic order so the on-chain payout is byte-identical regardless
      // of arrival order — useful for replay/debugging.
      const final = [...w.sigs]
        .sort((a, b) => (a.agentId < b.agentId ? -1 : 1))
        .slice(0, w.threshold);
      w.resolve(final);
    }

    return { accepted: true, total: w.sigs.length, threshold: w.threshold };
  }

  /// For tests: drop the waiter without resolving (pipeline aborted).
  abandon(claimId: Hex): void {
    const w = this.waiters.get(claimId);
    if (!w) return;
    clearTimeout(w.timer);
    this.waiters.delete(claimId);
    w.reject(new Error("inbox abandoned"));
  }
}
