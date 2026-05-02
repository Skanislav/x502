import type { Kind } from "@x502/shared";
import type { Address, Hex } from "viem";

export interface VerifyContext {
  repoSlug: string;
  externalId: bigint;
  kind: Kind;
  recipient: Address;
  factHash: Hex;
  /// Reveal for the GH-body commitment, if the claim type requires identity binding.
  agentIdReveal?: bigint;
  saltReveal?: Hex;
  /// Optional sink for streaming reasoning chunks. The verifier server passes
  /// a function that publishes `verifier.reasoning` events to its SSE bus, so
  /// the demo UI can render Claude's extended-thinking output in real time.
  /// Policies that don't stream (AcceptAll, RejectAll) can ignore this.
  onReasoningChunk?: (chunk: string) => void;
}

export type DecisionOutcome = { accept: true; reason: string } | { accept: false; reason: string };

/// Pluggable decision policy. The mock impl always accepts (used in CI/local
/// integration tests). The Claude-backed impl pulls the GH issue/PR + the
/// `<!-- x502:{commitment} -->` body, asks Claude whether the claim is valid,
/// and returns its answer.
export interface DecisionPolicy {
  decide(ctx: VerifyContext): Promise<DecisionOutcome>;
}

export class AcceptAllPolicy implements DecisionPolicy {
  async decide(_ctx: VerifyContext): Promise<DecisionOutcome> {
    return { accept: true, reason: "mock policy (AcceptAll)" };
  }
}

export class RejectAllPolicy implements DecisionPolicy {
  async decide(_ctx: VerifyContext): Promise<DecisionOutcome> {
    return { accept: false, reason: "mock policy (RejectAll)" };
  }
}
