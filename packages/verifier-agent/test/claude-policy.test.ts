import { describe, expect, it, vi } from "vitest";

import { Kind, deriveCommitment, repoIdFromSlug } from "@x502/shared";

import { ClaudePolicy } from "../src/policies/claude.js";

const RECIPIENT = "0x2222222222222222222222222222222222222222" as const;
const FACT_HASH = `0x${"ab".repeat(32)}` as const;

function anthropicWithText(text: string) {
  return {
    messages: {
      create: vi.fn(async () => ({ content: [{ type: "text", text }] })),
    },
  };
}

function octokitIssue(body: string, labels: unknown[] = ["bug"]) {
  return {
    rest: {
      issues: {
        get: vi.fn(async () => ({
          data: { title: "Bug", state: "open", body, labels },
        })),
      },
      pulls: { get: vi.fn() },
    },
  };
}

/// Builds an anthropic stub whose `messages.stream(...)` returns an
/// async-iterable of fake events plus a `finalMessage()` resolving to the
/// JSON verdict. Mirrors the @anthropic-ai/sdk `MessageStream` surface used
/// by ClaudePolicy.judge.
function anthropicStreaming(opts: {
  thinkingChunks?: string[];
  finalText: string;
  throwMid?: Error;
}) {
  const stream = vi.fn((_args: unknown) => {
    const events: Array<unknown> = [];
    for (const chunk of opts.thinkingChunks ?? []) {
      events.push({
        type: "content_block_delta",
        delta: { type: "thinking_delta", thinking: chunk },
      });
    }
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next() {
            if (opts.throwMid && i === 1) throw opts.throwMid;
            if (i >= events.length) return { value: undefined, done: true };
            return { value: events[i++], done: false };
          },
        };
      },
      finalMessage: vi.fn(async () => ({
        content: [{ type: "text", text: opts.finalText }],
      })),
    };
  });
  return {
    messages: {
      // Streaming path uses .stream(); non-streaming path uses .create().
      // Existing tests rely on .create() so we keep both.
      create: vi.fn(),
      stream,
    },
  };
}

function userPromptOf(anthropic: ReturnType<typeof anthropicWithText>) {
  const req = anthropic.messages.create.mock.calls[0]?.[0] as {
    messages: Array<{ role: string; content: string }>;
  };
  return req.messages[0].content;
}

describe("ClaudePolicy", () => {
  it("calls Claude with schema, cache control, model, thinking, and prompt fields", async () => {
    const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "ok" }));
    const repoId = repoIdFromSlug("owner/repo");
    const salt = `0x${"11".repeat(32)}` as const;
    const commitment = deriveCommitment(101n, repoId, 2n, salt);
    const octokit = octokitIssue(`body\n<!-- x502-commitment:${commitment} -->`);

    const policy = new ClaudePolicy({ anthropic: anthropic as never, octokit: octokit as never });
    const result = await policy.decide({
      repoSlug: "owner/repo",
      externalId: 2n,
      kind: Kind.Report,
      recipient: RECIPIENT,
      factHash: FACT_HASH,
      agentIdReveal: 101n,
      saltReveal: salt,
    });

    expect(result).toEqual({ accept: true, reason: "ok" });
    const req = anthropic.messages.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(req.model).toBe("claude-opus-4-7");
    expect(req.thinking).toEqual({ type: "adaptive" });
    expect(req.output_config).toMatchObject({
      effort: "medium",
      format: { type: "json_schema" },
    });
    expect(req.output_config).toMatchObject({
      format: {
        schema: {
          properties: {
            accept: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["accept", "reason"],
        },
      },
    });
    expect(req.system).toMatchObject([{ type: "text", cache_control: { type: "ephemeral" } }]);
    const prompt = userPromptOf(anthropic);
    expect(prompt).toContain("Claim type: report");
    expect(prompt).toContain(`Recipient: ${RECIPIENT}`);
    expect(prompt).toContain("Commitment verified: true");
  });

  it("rejects bad repo slugs before fetching GitHub", async () => {
    const octokit = octokitIssue("body");
    const policy = new ClaudePolicy({
      anthropic: anthropicWithText("{}") as never,
      octokit: octokit as never,
    });

    await expect(
      policy.decide({
        repoSlug: "not-a-slug",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
      }),
    ).resolves.toEqual({ accept: false, reason: "bad repoSlug" });
    expect(octokit.rest.issues.get).not.toHaveBeenCalled();
  });

  it("rejects when GitHub fetch fails", async () => {
    const policy = new ClaudePolicy({
      anthropic: anthropicWithText("{}") as never,
      octokit: {
        rest: {
          issues: {
            get: vi.fn(async () => {
              throw new Error("boom");
            }),
          },
          pulls: { get: vi.fn() },
        },
      } as never,
    });

    await expect(
      policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
      }),
    ).resolves.toEqual({ accept: false, reason: "gh fetch failed: boom" });
  });

  it("uses issue context and extracts labels for report claims", async () => {
    const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "valid report" }));
    const octokit = octokitIssue("repro steps", [{ name: "bug" }, "repro"]);
    const policy = new ClaudePolicy({ anthropic: anthropic as never, octokit: octokit as never });

    await policy.decide({
      repoSlug: "owner/repo",
      externalId: 2n,
      kind: Kind.Report,
      recipient: RECIPIENT,
      factHash: FACT_HASH,
    });

    expect(octokit.rest.issues.get).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 2,
    });
    const prompt = userPromptOf(anthropic);
    expect(prompt).toContain("Issue #2: Bug");
    expect(prompt).toContain("State: open; Labels: bug, repro");
    expect(prompt).toContain("Body:\nrepro steps");
  });

  it("uses PR context and extracts labels for fix claims", async () => {
    const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "merged fix" }));
    const pullsGet = vi.fn(async () => ({
      data: {
        title: "Fix bug",
        state: "closed",
        merged: true,
        base: { ref: "main" },
        body: "Fixes #2",
        labels: [{ name: "bug" }, "accepted"],
      },
    }));
    const policy = new ClaudePolicy({
      anthropic: anthropic as never,
      octokit: { rest: { pulls: { get: pullsGet }, issues: { get: vi.fn() } } } as never,
    });

    await policy.decide({
      repoSlug: "owner/repo",
      externalId: 3n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      factHash: FACT_HASH,
    });

    expect(pullsGet).toHaveBeenCalledWith({ owner: "owner", repo: "repo", pull_number: 3 });
    const prompt = userPromptOf(anthropic);
    expect(prompt).toContain("PR #3: Fix bug");
    expect(prompt).toContain("State: closed; Merged: true; Base: main");
    expect(prompt).toContain("Labels: bug, accepted");
    expect(prompt).toContain("Commitment verified: false");
  });

  it.each([
    ["matching reveal", true, "body\n<!-- x502-commitment:%s -->"],
    ["wrong reveal", false, "body\n<!-- x502-commitment:0x%s -->"],
    ["missing reveal", false, "body"],
  ])("adds Commitment verified: %s to the Claude prompt", async (_name, expected, bodyTemplate) => {
    const anthropic = anthropicWithText(JSON.stringify({ accept: false, reason: "checked" }));
    const repoId = repoIdFromSlug("owner/repo");
    const salt = `0x${"11".repeat(32)}` as const;
    const commitment = deriveCommitment(101n, repoId, 2n, salt);
    const body =
      bodyTemplate === "body\n<!-- x502-commitment:%s -->"
        ? bodyTemplate.replace("%s", commitment)
        : bodyTemplate.replace("%s", "00".repeat(32));
    const policy = new ClaudePolicy({
      anthropic: anthropic as never,
      octokit: octokitIssue(body) as never,
    });

    await policy.decide({
      repoSlug: "owner/repo",
      externalId: 2n,
      kind: Kind.Report,
      recipient: RECIPIENT,
      factHash: FACT_HASH,
      agentIdReveal: _name === "missing reveal" ? undefined : 101n,
      saltReveal: _name === "missing reveal" ? undefined : salt,
    });

    expect(userPromptOf(anthropic)).toContain(`Commitment verified: ${expected}`);
  });

  it.each([
    [JSON.stringify({ accept: true, reason: "accepted" }), { accept: true, reason: "accepted" }],
    [JSON.stringify({ accept: false, reason: "rejected" }), { accept: false, reason: "rejected" }],
    ["not json", { accept: false, reason: "bad JSON from Claude: not json" }],
  ])("handles Claude text response %s", async (text, expected) => {
    const policy = new ClaudePolicy({
      anthropic: anthropicWithText(text) as never,
      octokit: octokitIssue("body") as never,
    });

    await expect(
      policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
      }),
    ).resolves.toMatchObject(expected);
  });

  it("rejects when Claude returns no text block", async () => {
    const anthropic = {
      messages: { create: vi.fn(async () => ({ content: [{ type: "tool_use" }] })) },
    };
    const policy = new ClaudePolicy({
      anthropic: anthropic as never,
      octokit: octokitIssue("body") as never,
    });

    await expect(
      policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
      }),
    ).resolves.toEqual({ accept: false, reason: "no text response from Claude" });
  });

  describe("walletBinding", () => {
    const REGISTRY_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
    const salt = `0x${"11".repeat(32)}` as const;

    function publicClientReturning(wallet: string) {
      return {
        readContract: vi.fn(async () => wallet as `0x${string}`),
      } as never;
    }

    it("rejects when registry-bound wallet does not match recipient", async () => {
      const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "n/a" }));
      const repoId = repoIdFromSlug("owner/repo");
      const commitment = deriveCommitment(101n, repoId, 2n, salt);
      const octokit = octokitIssue(`body\n<!-- x502-commitment:${commitment} -->`);
      const wrongWallet = "0x9999999999999999999999999999999999999999";

      const policy = new ClaudePolicy({
        anthropic: anthropic as never,
        octokit: octokit as never,
        walletBinding: { client: publicClientReturning(wrongWallet), address: REGISTRY_ADDRESS },
      });

      const result = await policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
        agentIdReveal: 101n,
        saltReveal: salt,
      });

      expect(result.accept).toBe(false);
      expect(result.reason).toContain("does not match");
      expect(anthropic.messages.create).not.toHaveBeenCalled();
    });

    it("accepts when registry wallet matches recipient and markers agree", async () => {
      const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "ok" }));
      const repoId = repoIdFromSlug("owner/repo");
      const commitment = deriveCommitment(101n, repoId, 2n, salt);
      const body = `body\n<!-- x502-commitment:${commitment} -->\n<!-- x502:${RECIPIENT} -->`;
      const octokit = octokitIssue(body);

      const policy = new ClaudePolicy({
        anthropic: anthropic as never,
        octokit: octokit as never,
        walletBinding: { client: publicClientReturning(RECIPIENT), address: REGISTRY_ADDRESS },
      });

      await expect(
        policy.decide({
          repoSlug: "owner/repo",
          externalId: 2n,
          kind: Kind.Report,
          recipient: RECIPIENT,
          factHash: FACT_HASH,
          agentIdReveal: 101n,
          saltReveal: salt,
        }),
      ).resolves.toEqual({ accept: true, reason: "ok" });
      expect(userPromptOf(anthropic)).toContain("Commitment verified: true");
    });

    it("rejects when x502 wallet marker contradicts registry wallet", async () => {
      const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "n/a" }));
      const repoId = repoIdFromSlug("owner/repo");
      const commitment = deriveCommitment(101n, repoId, 2n, salt);
      const wrongMarker = "0x9999999999999999999999999999999999999999";
      const body = `body\n<!-- x502-commitment:${commitment} -->\n<!-- x502:${wrongMarker} -->`;
      const octokit = octokitIssue(body);

      const policy = new ClaudePolicy({
        anthropic: anthropic as never,
        octokit: octokit as never,
        walletBinding: { client: publicClientReturning(RECIPIENT), address: REGISTRY_ADDRESS },
      });

      const result = await policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
        agentIdReveal: 101n,
        saltReveal: salt,
      });

      expect(result.accept).toBe(false);
      expect(result.reason).toContain("wallet marker");
      expect(anthropic.messages.create).not.toHaveBeenCalled();
    });

    it("skips wallet check when agentIdReveal is absent", async () => {
      const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "ok" }));
      const octokit = octokitIssue("body");
      const readContract = vi.fn();

      const policy = new ClaudePolicy({
        anthropic: anthropic as never,
        octokit: octokit as never,
        walletBinding: { client: { readContract } as never, address: REGISTRY_ADDRESS },
      });

      await policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
      });

      expect(readContract).not.toHaveBeenCalled();
      expect(anthropic.messages.create).toHaveBeenCalled();
    });
  });

  // Current behavior pinned from USER_FLOW.md "Current vs. intent":
  // ClaudePolicy fetches the issue or PR body but does not fetch GitHub comments,
  // so commitments and repro/dedup evidence in comments are invisible here.
  it("currentBehavior_commentsNotFetchedForCommitmentOrEvidence", async () => {
    const anthropic = anthropicWithText(JSON.stringify({ accept: false, reason: "no body proof" }));
    const octokit = {
      rest: {
        issues: {
          get: vi.fn(async () => ({
            data: { title: "Bug", state: "open", body: "", labels: [] },
          })),
          listComments: vi.fn(async () => ({
            data: [{ body: "repro steps\n<!-- x502-commitment:comment-only -->" }],
          })),
        },
        pulls: { get: vi.fn() },
      },
    };
    const policy = new ClaudePolicy({ anthropic: anthropic as never, octokit: octokit as never });

    await policy.decide({
      repoSlug: "owner/repo",
      externalId: 2n,
      kind: Kind.Triage,
      recipient: RECIPIENT,
      factHash: FACT_HASH,
    });

    expect(octokit.rest.issues.get).toHaveBeenCalledTimes(1);
    expect(octokit.rest.issues.listComments).not.toHaveBeenCalled();
    expect(userPromptOf(anthropic)).toContain("Body:\n(empty)");
    expect(userPromptOf(anthropic)).not.toContain("comment-only");
  });

  describe("onReasoningChunk streaming", () => {
    it("uses messages.stream and forwards thinking_delta chunks to the callback", async () => {
      const anthropic = anthropicStreaming({
        thinkingChunks: ["The issue is ", "open ", "and reproducible."],
        finalText: JSON.stringify({ accept: true, reason: "looks fine" }),
      });
      const policy = new ClaudePolicy({
        anthropic: anthropic as never,
        octokit: octokitIssue("body") as never,
      });

      const chunks: string[] = [];
      const result = await policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
        onReasoningChunk: (c) => chunks.push(c),
      });

      expect(result).toEqual({ accept: true, reason: "looks fine" });
      expect(chunks).toEqual(["The issue is ", "open ", "and reproducible."]);
      expect(anthropic.messages.stream).toHaveBeenCalled();
      expect(anthropic.messages.create).not.toHaveBeenCalled();
    });

    it("uses non-streaming messages.create when no callback is provided", async () => {
      // Streaming is opt-in: existing callers (and AcceptAllPolicy mocks)
      // still hit the legacy path, so their tests don't need to mock stream.
      const anthropic = anthropicWithText(JSON.stringify({ accept: false, reason: "no" }));
      const policy = new ClaudePolicy({
        anthropic: anthropic as never,
        octokit: octokitIssue("body") as never,
      });

      const result = await policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
      });

      expect(result).toEqual({ accept: false, reason: "no" });
      expect(anthropic.messages.create).toHaveBeenCalled();
    });

    it("returns a clear rejection when the stream throws", async () => {
      const anthropic = anthropicStreaming({
        thinkingChunks: ["partial"],
        finalText: "{}",
        throwMid: new Error("upstream cancelled"),
      });
      const policy = new ClaudePolicy({
        anthropic: anthropic as never,
        octokit: octokitIssue("body") as never,
      });

      const chunks: string[] = [];
      const result = await policy.decide({
        repoSlug: "owner/repo",
        externalId: 2n,
        kind: Kind.Report,
        recipient: RECIPIENT,
        factHash: FACT_HASH,
        onReasoningChunk: (c) => chunks.push(c),
      });

      expect(result.accept).toBe(false);
      expect(result.reason).toContain("Claude stream failed");
      expect(result.reason).toContain("upstream cancelled");
    });
  });
});
