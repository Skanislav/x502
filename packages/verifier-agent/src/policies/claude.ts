import type Anthropic from "@anthropic-ai/sdk";
import type { Octokit } from "@octokit/rest";

import {
  type AgentRegistryClient,
  Kind,
  KindName,
  deriveCommitment,
  repoIdFromSlug,
  resolveAgentWallet,
} from "@x502/shared";

import type { DecisionOutcome, DecisionPolicy, VerifyContext } from "../decide.js";

export interface ClaudePolicyOptions {
  anthropic: Anthropic;
  octokit: Octokit;
  /// Spend ceiling per call. Adaptive thinking respects this as max_tokens.
  maxTokens?: number;
  /// Effort level for the reasoning portion. medium balances cost and rigour.
  effort?: "low" | "medium" | "high" | "max";
  /// When provided, the policy resolves `agentIdReveal` via the ERC-8004
  /// IdentityRegistry and rejects (without calling Claude) if the bound wallet
  /// does not match `recipient`, or if the body's `<!-- x502:WALLET -->`
  /// marker disagrees. Without this option the policy stays in the legacy
  /// commitment-hash-only mode so existing tests keep passing.
  walletBinding?: AgentRegistryClient;
}

const SYSTEM_PROMPT = `You are an x502 verifier agent. You judge whether a claim about a GitHub
issue or PR is legitimate enough to pay out a USDC bounty from a smart-contract
vault on Base.

You will be shown:
1. The claim type (report / triage / fix / docs_tests).
2. The repo + issue/PR context pulled from the GitHub API.
3. The recipient address requesting the payout.
4. Whether a binding commitment in the body decoded correctly.

Your job: respond with strict JSON {"accept": boolean, "reason": string}.
Be conservative — accept only when the evidence clearly supports the claim type.

Rules per kind:
- report: Issue exists, is novel (not a duplicate), is reproducible from the
  body, and is not labelled wontfix/duplicate/invalid.
- triage: Issue has substantive triage work — at least 2 meaningful labels added,
  with clear repro steps or dedup links in the comments/body.
- fix: PR is merged into the default branch AND the body explicitly closes a
  linked issue (Fixes #N / Closes #N / Resolves #N). Drive-by typo PRs do NOT
  qualify.
- docs_tests: PR is merged AND meaningfully fills a documentation gap or adds
  missing tests. Reject churn that doesn't change behavior or substantively
  improve docs.

If commitmentVerified is false, reject — the claim is not bound to the
reporter's ERC-8004 identity.`;

interface JudgmentInput {
  kind: KindName;
  recipient: string;
  context: string;
  commitmentVerified: boolean;
}

export class ClaudePolicy implements DecisionPolicy {
  constructor(private readonly opts: ClaudePolicyOptions) {}

  async decide(ctx: VerifyContext): Promise<DecisionOutcome> {
    const [owner, repo] = ctx.repoSlug.split("/");
    if (!owner || !repo) return { accept: false, reason: "bad repoSlug" };

    const isPr = ctx.kind === Kind.Fix || ctx.kind === Kind.DocsTests;

    let body: string;
    let summary: string;
    try {
      if (isPr) {
        const pr = await this.opts.octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: Number(ctx.externalId),
        });
        body = pr.data.body ?? "";
        const labels = (pr.data.labels ?? [])
          .map((l) => (typeof l === "string" ? l : l.name))
          .filter(Boolean)
          .join(", ");
        summary = [
          `PR #${ctx.externalId}: ${pr.data.title}`,
          `State: ${pr.data.state}; Merged: ${pr.data.merged}; Base: ${pr.data.base?.ref ?? "?"}`,
          `Labels: ${labels || "(none)"}`,
          "Body:",
          body || "(empty)",
        ].join("\n");
      } else {
        const issue = await this.opts.octokit.rest.issues.get({
          owner,
          repo,
          issue_number: Number(ctx.externalId),
        });
        body = issue.data.body ?? "";
        const labels = (issue.data.labels ?? [])
          .map((l) => (typeof l === "string" ? l : l.name))
          .filter(Boolean)
          .join(", ");
        summary = [
          `Issue #${ctx.externalId}: ${issue.data.title}`,
          `State: ${issue.data.state}; Labels: ${labels || "(none)"}`,
          "Body:",
          body || "(empty)",
        ].join("\n");
      }
    } catch (e) {
      return { accept: false, reason: `gh fetch failed: ${(e as Error).message}` };
    }

    if (this.opts.walletBinding && ctx.agentIdReveal !== undefined) {
      const binding = await this.verifyWalletBinding(ctx, body);
      if (!binding.ok) return { accept: false, reason: binding.reason };
    }

    const commitmentVerified = this.checkCommitment(ctx, body);

    return this.judge({
      kind: KindName[ctx.kind],
      recipient: ctx.recipient,
      context: summary,
      commitmentVerified,
    });
  }

  private checkCommitment(ctx: VerifyContext, body: string): boolean {
    if (ctx.agentIdReveal === undefined || ctx.saltReveal === undefined) {
      // Caller didn't claim a commitment binding; we don't reject for that here
      // — the contract may treat unverified-binding claims differently per kind.
      return false;
    }
    const repoId = repoIdFromSlug(ctx.repoSlug);
    const expected = deriveCommitment(
      ctx.agentIdReveal,
      repoId,
      ctx.externalId,
      ctx.saltReveal,
    ).toLowerCase();
    const m = body.match(/<!--\s*x502-commitment:(0x[a-fA-F0-9]{64})\s*-->/);
    return m?.[1]?.toLowerCase() === expected;
  }

  private async verifyWalletBinding(
    ctx: VerifyContext,
    body: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!this.opts.walletBinding || ctx.agentIdReveal === undefined) {
      return { ok: true };
    }
    let wallet: string;
    try {
      wallet = await resolveAgentWallet(this.opts.walletBinding, ctx.agentIdReveal);
    } catch (e) {
      return { ok: false, reason: `agent registry lookup failed: ${(e as Error).message}` };
    }
    if (wallet.toLowerCase() !== ctx.recipient.toLowerCase()) {
      return {
        ok: false,
        reason: `recipient ${ctx.recipient} does not match agentId ${ctx.agentIdReveal} wallet ${wallet}`,
      };
    }
    // The DON's source.js reads <!-- x502:0xADDRESS --> as ghAuthorBinding —
    // when that marker is present it must match the resolved wallet. Missing
    // marker is allowed (the commitment-hash check still binds via salt).
    const m = body.match(/<!--\s*x502:(0x[a-fA-F0-9]{40})\s*-->/);
    if (m?.[1] && m[1].toLowerCase() !== wallet.toLowerCase()) {
      return {
        ok: false,
        reason: `x502 wallet marker ${m[1]} does not match agent wallet ${wallet}`,
      };
    }
    return { ok: true };
  }

  private async judge(input: JudgmentInput): Promise<DecisionOutcome> {
    const userPrompt = [
      `Claim type: ${input.kind}`,
      `Recipient: ${input.recipient}`,
      `Commitment verified: ${input.commitmentVerified}`,
      "",
      "GitHub context:",
      input.context,
      "",
      "Should this claim be accepted? Respond with strict JSON only.",
    ].join("\n");

    const response = await this.opts.anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: this.opts.maxTokens ?? 4000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: this.opts.effort ?? "medium",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              accept: { type: "boolean" },
              reason: { type: "string" },
            },
            required: ["accept", "reason"],
            additionalProperties: false,
          },
        },
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { accept: false, reason: "no text response from Claude" };
    }
    try {
      const parsed = JSON.parse(textBlock.text) as { accept?: boolean; reason?: string };
      if (parsed.accept === true) {
        return { accept: true, reason: parsed.reason ?? "accepted by Claude" };
      }
      return { accept: false, reason: parsed.reason ?? "rejected by Claude" };
    } catch {
      return {
        accept: false,
        reason: `bad JSON from Claude: ${textBlock.text.slice(0, 200)}`,
      };
    }
  }
}
