import type { Address, Hex } from "viem";

/// Wire format for the demo "verifier theater" event stream. The coordinator
/// emits these as it drives a claim through fact delivery and attestation
/// collection; the web UI subscribes via the coordinator's `/events` SSE
/// endpoint. (Verifier-side reasoning lives in the operator's local Claude
/// session — see `.claude/skills/x502-verify/SKILL.md` — and isn't piped
/// here today.)

export type DemoEvent =
  | {
      type: "claim.opened";
      claimId: Hex;
      repoSlug: string;
      kind: number;
      recipient: Address;
      ts: number;
    }
  | { type: "fact.requested"; claimId: Hex; ts: number }
  | {
      type: "fact.delivered";
      claimId: Hex;
      status: number;
      mergedBlock: string;
      labelMask: Hex;
      ghAuthorBinding: Address;
      ts: number;
    }
  | { type: "verifier.signed"; claimId: Hex; agentId: string; signature: Hex; ts: number }
  | { type: "payout.submitted"; claimId: Hex; txHash: Hex; ts: number }
  | { type: "payout.confirmed"; claimId: Hex; txHash: Hex; ts: number };

export interface EventSubscriber {
  publish(event: DemoEvent): void;
}

/// In-memory pub/sub. Subscribers register a callback; calling close() on the
/// returned handle removes the subscriber. The bus is intentionally simple —
/// it only runs inside the single coordinator process.
export class EventBus implements EventSubscriber {
  private next = 0;
  private readonly subscribers = new Map<number, (e: DemoEvent) => void>();

  publish(event: DemoEvent): void {
    for (const fn of this.subscribers.values()) {
      try {
        fn(event);
      } catch {
        /* never let a bad subscriber crash the publisher */
      }
    }
  }

  subscribe(fn: (e: DemoEvent) => void): { close: () => void } {
    const id = this.next++;
    this.subscribers.set(id, fn);
    return {
      close: () => {
        this.subscribers.delete(id);
      },
    };
  }
}

/// SSE wire helper — formats a single event in the text/event-stream protocol.
export function formatSse(event: DemoEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
