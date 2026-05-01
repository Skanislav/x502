"use client";

import type { ReactNode } from "react";

export type StepKey =
  | "intro"
  | "draft-issue"
  | "commitment"
  | "submit"
  | "fact"
  | "verifiers"
  | "payout"
  | "done";

const STEPS: Array<{ key: StepKey; title: string; copy: string }> = [
  {
    key: "intro",
    title: "1 · The setup",
    copy: "A repo owner has funded a vault with USDC. Bounties pay out for verifiable GitHub outcomes (report, triage, fix, docs_tests).",
  },
  {
    key: "draft-issue",
    title: "2 · File the issue",
    copy: "An agent (Alice) finds a bug. She files the GitHub issue. The issue number `#N` becomes part of her commitment.",
  },
  {
    key: "commitment",
    title: "3 · Bind the commitment",
    copy: "Alice computes `keccak256(agentId, repoId, externalId, salt)` and pastes it into the issue body. This binds the GH author to her wallet via ERC-8004.",
  },
  {
    key: "submit",
    title: "4 · Submit the claim",
    copy: "Alice POSTs the claim to the coordinator with her commitment reveal. The coordinator returns a claimId and starts the pipeline.",
  },
  {
    key: "fact",
    title: "5 · DON delivers the fact",
    copy: "Chainlink Functions (locally simulated) fetches the issue, applies the kind-specific rules from `chainlink/source-core.js`, and returns `(status, mergedBlock, labelMask, ghAuthorBinding)` on chain.",
  },
  {
    key: "verifiers",
    title: "6 · Verifiers sign",
    copy: "Each verifier-agent fetches the issue, asks Claude whether the claim holds, checks the wallet binding via the agent registry, and signs an EIP-712 attestation. Coordinator collects M of N signatures.",
  },
  {
    key: "payout",
    title: "7 · Vault settles",
    copy: "Coordinator submits `BountyVault.payout(...)` with the M signatures + factHash. The vault re-derives the EIP-712 digest, decodes status, and transfers USDC to Alice + a tiny outcome fee to each signer.",
  },
  {
    key: "done",
    title: "8 · Paid",
    copy: "Tx hash visible on Basescan (or local anvil). Alice has the bounty in her wallet, the protocol has a verifiable trail.",
  },
];

export function DemoStepper({
  current,
  children,
}: {
  current: StepKey;
  children?: ReactNode;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted">Demo walkthrough</h2>
      <ol className="space-y-2">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li
              key={s.key}
              className={[
                "rounded border p-3 transition",
                active
                  ? "border-accent/60 bg-accent/5"
                  : done
                    ? "border-paper/10 opacity-60"
                    : "border-paper/10 opacity-40",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{s.title}</span>
                {done && <span className="text-xs text-accent">done</span>}
                {active && <span className="text-xs text-accent animate-pulse">active</span>}
              </div>
              <p className="text-xs text-muted leading-5 mt-1">{s.copy}</p>
              {active && children}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/// Maps the existing PipelineState onto the stepper's enum.
export function stepFromPipeline(pipeline: {
  status: string;
  factReady?: boolean;
  sigs?: number;
}): StepKey {
  if (pipeline.status === "paid") return "done";
  if (pipeline.status === "failed") return "payout";
  if (pipeline.status === "ready") return "payout";
  if ((pipeline.sigs ?? 0) > 0) return "verifiers";
  if (pipeline.factReady) return "verifiers";
  if (pipeline.status === "verifying") return "fact";
  return "submit";
}
