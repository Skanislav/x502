import type { Address, Hex } from "viem";

/// Per-claim inbox where the EAS event watcher records attestation UIDs as
/// they land on chain. The pipeline `await`s on each claimId; the watcher
/// pushes one entry per `Attested(schema=schemaUID)` event after decoding
/// + filtering. When threshold matching attestations have been observed,
/// the awaiting promise resolves with the UID array (deterministically
/// sorted by attester address) and the inbox forgets the claim.
///
/// Each attester contributes at most one attestation per claim; duplicates
/// are silently ignored (the vault would also reject them, but rejecting
/// here keeps the pipeline tidy).
///
/// The inbox does NOT verify attestation content — that's the EAS watcher's
/// job (it decodes + filters by schema/claimId/factHash before pushing).
/// Trust + dedup checks at this layer are belt-and-suspenders.
export interface InboxAwaitArgs {
  claimId: Hex;
  factHash: Hex;
  threshold: number;
  /// Lower-cased address strings; the inbox checks attester membership here
  /// to bail early on stray pushes for repos this verifier doesn't serve.
  trustedAttesters: Set<string>;
  timeoutMs: number;
}

export interface PushResult {
  accepted: boolean;
  reason?: string;
  /// Total accepted UIDs after this push; only set on success.
  total?: number;
  threshold?: number;
}

interface Waiter {
  threshold: number;
  factHash: Hex;
  trustedAttesters: Set<string>;
  uids: Hex[];
  attesters: Address[];
  seen: Set<string>;
  resolve: (uids: Hex[]) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class AttestationInbox {
  private readonly waiters = new Map<Hex, Waiter>();

  /// Snapshot for /payout polling.
  countOf(claimId: Hex): number {
    return this.waiters.get(claimId)?.uids.length ?? 0;
  }

  isOpen(claimId: Hex): boolean {
    return this.waiters.has(claimId);
  }

  await(args: InboxAwaitArgs): Promise<Hex[]> {
    return new Promise((resolve, reject) => {
      if (this.waiters.has(args.claimId)) {
        reject(new Error(`inbox already awaiting ${args.claimId}`));
        return;
      }
      const timer = setTimeout(() => {
        const w = this.waiters.get(args.claimId);
        this.waiters.delete(args.claimId);
        reject(
          new Error(
            `attestation timeout: only got ${w?.uids.length ?? 0}/${args.threshold} attestations`,
          ),
        );
      }, args.timeoutMs);
      this.waiters.set(args.claimId, {
        threshold: args.threshold,
        factHash: args.factHash,
        trustedAttesters: args.trustedAttesters,
        uids: [],
        attesters: [],
        seen: new Set(),
        resolve,
        reject,
        timer,
      });
    });
  }

  /// Push one observed attestation. Returns accept/reject. Resolves the
  /// waiter once threshold UIDs have been collected (sorted deterministically).
  push(args: {
    claimId: Hex;
    factHash: Hex;
    uid: Hex;
    attester: Address;
  }): PushResult {
    const w = this.waiters.get(args.claimId);
    if (!w) return { accepted: false, reason: "no active claim awaiting attestations" };
    if (args.factHash.toLowerCase() !== w.factHash.toLowerCase()) {
      return { accepted: false, reason: "factHash mismatch" };
    }
    const key = args.attester.toLowerCase();
    if (!w.trustedAttesters.has(key)) {
      return { accepted: false, reason: `attester ${args.attester} not trusted by this repo` };
    }
    if (w.seen.has(key)) {
      return { accepted: false, reason: `attester ${args.attester} already seen` };
    }

    w.seen.add(key);
    w.uids.push(args.uid);
    w.attesters.push(args.attester);

    if (w.uids.length >= w.threshold) {
      clearTimeout(w.timer);
      this.waiters.delete(args.claimId);
      // Pair (uid, attester) and sort by attester address for a deterministic
      // payout payload across runs.
      const pairs = w.uids.map((uid, i) => ({ uid, attester: w.attesters[i]! }));
      pairs.sort((a, b) => (a.attester.toLowerCase() < b.attester.toLowerCase() ? -1 : 1));
      w.resolve(pairs.slice(0, w.threshold).map((p) => p.uid));
    }

    return { accepted: true, total: w.uids.length, threshold: w.threshold };
  }

  abandon(claimId: Hex): void {
    const w = this.waiters.get(claimId);
    if (!w) return;
    clearTimeout(w.timer);
    this.waiters.delete(claimId);
    w.reject(new Error("inbox abandoned"));
  }
}
