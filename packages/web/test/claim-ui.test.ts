import { describe, expect, test } from "vitest";
import { deriveCommitment, repoIdFromSlug } from "@x502/shared";
import { mapPoll, previewCommitment } from "../lib/claim-ui";

const CLAIM_ID = `0x${"11".repeat(32)}` as const;
const SALT = `0x${"00".repeat(30)}beef` as const;

describe("mapPoll", () => {
  test("maps paid responses", () => {
    const txHash = `0x${"22".repeat(32)}` as const;

    expect(
      mapPoll(CLAIM_ID, {
        status: "paid",
        claimId: CLAIM_ID,
        recipient: `0x${"33".repeat(20)}`,
        txHash,
      }),
    ).toEqual({ claimId: CLAIM_ID, status: "paid", txHash });
  });

  test("maps failed responses", () => {
    expect(mapPoll(CLAIM_ID, { status: "failed", claimId: CLAIM_ID, error: "nope" })).toEqual({
      claimId: CLAIM_ID,
      status: "failed",
      error: "nope",
    });
  });

  test("maps verifying responses", () => {
    expect(
      mapPoll(CLAIM_ID, {
        status: "verifying",
        claimId: CLAIM_ID,
        factReady: false,
        sigs: 1,
      }),
    ).toEqual({ claimId: CLAIM_ID, status: "verifying", factReady: false, sigs: 1 });
  });

  test("maps ready responses", () => {
    expect(
      mapPoll(CLAIM_ID, {
        status: "ready",
        claimId: CLAIM_ID,
        factReady: true,
        sigs: 2,
      }),
    ).toEqual({ claimId: CLAIM_ID, status: "ready", factReady: true, sigs: 2 });
  });
});

describe("previewCommitment", () => {
  test("returns the derived commitment for valid input", () => {
    expect(
      previewCommitment({
        repoSlug: "owner/repo",
        externalId: "2",
        agentIdReveal: "101",
        saltReveal: SALT,
      }),
    ).toBe(deriveCommitment(101n, repoIdFromSlug("owner/repo"), 2n, SALT));
  });

  test.each([
    ["invalid slug", { repoSlug: "repo", externalId: "2", agentIdReveal: "101", saltReveal: SALT }],
    ["blank externalId", { repoSlug: "owner/repo", externalId: "", agentIdReveal: "101", saltReveal: SALT }],
    ["non-bigint externalId", { repoSlug: "owner/repo", externalId: "abc", agentIdReveal: "101", saltReveal: SALT }],
    ["non-bigint agentIdReveal", { repoSlug: "owner/repo", externalId: "2", agentIdReveal: "abc", saltReveal: SALT }],
    ["non-0x salt", { repoSlug: "owner/repo", externalId: "2", agentIdReveal: "101", saltReveal: "beef" }],
  ])("returns undefined for %s", (_name, args) => {
    expect(previewCommitment(args)).toBeUndefined();
  });
});
