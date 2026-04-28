import { describe, expect, it } from "vitest";

import {
  authorBindingFromBody,
  decideFact,
  mergedBlockFromSha,
  parseRepoSlug,
} from "../source-core.js";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const b32 = (hex) => `0x${hex.padStart(64, "0")}`;

describe("source core", () => {
  it("parses repo slugs", () => {
    expect(parseRepoSlug("owner/repo")).toEqual({ owner: "owner", repo: "repo" });
    expect(() => parseRepoSlug("owner")).toThrow("bad repoSlug");
  });

  // Current behavior pinned from USER_FLOW.md "Current vs. intent":
  // the source parses the x502 wallet marker, but the vault never enforces it.
  it("currentBehavior_ghAuthorBindingParsedButNotEnforced", () => {
    expect(
      authorBindingFromBody("claim <!-- x502:0x1234567890abcdef1234567890ABCDEF12345678 -->"),
    ).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(authorBindingFromBody("no marker")).toBe(ZERO_ADDR);
  });

  it("accepts report labels and rejects conflicting rejected labels", () => {
    expect(
      decideFact({
        kind: 0,
        item: { labels: ["bug", "accepted"], body: "" },
      }),
    ).toEqual({
      status: 1,
      mergedBlock: 0n,
      labelMask: b32("5"),
      ghAuthorBinding: ZERO_ADDR,
    });

    expect(
      decideFact({
        kind: 0,
        item: { labels: ["bug", "accepted", "invalid"], body: "" },
      }).status,
    ).toBe(0);
  });

  it("returns an unverified default fact when item is missing", () => {
    expect(decideFact({ kind: 0, item: undefined })).toEqual({
      status: 0,
      mergedBlock: 0n,
      labelMask: b32("0"),
      ghAuthorBinding: ZERO_ADDR,
    });
  });

  it("requires at least two triage labels and sets triage-done mask", () => {
    expect(
      decideFact({
        kind: 1,
        item: { labels: [{ name: "triage-done" }, { name: "priority:high" }], body: "" },
      }),
    ).toEqual({
      status: 1,
      mergedBlock: 0n,
      labelMask: b32("8"),
      ghAuthorBinding: ZERO_ADDR,
    });

    expect(decideFact({ kind: 1, item: { labels: ["triage-done"], body: "" } }).status).toBe(0);
  });

  it("uses the first sha bytes for merged fixes with closing keywords", () => {
    const sha = "abcdef1234567890000000000000000000000000";

    expect(mergedBlockFromSha(sha)).toBe(0xabcdef1234567890n);
    expect(
      decideFact({
        kind: 2,
        item: { merged: true, merge_commit_sha: sha, body: "fixes #12" },
      }).mergedBlock,
    ).toBe(0xabcdef1234567890n);
  });

  it("classifies docs/tests PR files", () => {
    const item = {
      merged: true,
      merge_commit_sha: "abcdef1234567890000000000000000000000000",
      body: "",
    };

    expect(
      decideFact({ kind: 3, item, files: [{ filename: "packages/app/tests/source.test.ts" }] })
        .labelMask,
    ).toBe(b32("1"));
    expect(decideFact({ kind: 3, item, files: [{ filename: "docs/usage.md" }] }).labelMask).toBe(
      b32("2"),
    );
    expect(decideFact({ kind: 3, item, files: [{ filename: "src/source.ts" }] }).status).toBe(0);
    expect(decideFact({ kind: 3, item: undefined })).toEqual({
      status: 0,
      mergedBlock: 0n,
      labelMask: b32("0"),
      ghAuthorBinding: ZERO_ADDR,
    });
  });

  it("throws for unknown kinds", () => {
    expect(() => decideFact({ kind: 9, item: {} })).toThrow("unknown kind 9");
  });
});
