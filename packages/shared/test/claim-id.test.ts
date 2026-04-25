import { describe, it, expect } from "vitest";
import { deriveClaimId, deriveCommitment, repoIdFromSlug } from "../src/claim-id.js";
import { Kind } from "../src/types.js";

describe("deriveClaimId", () => {
  it("matches Solidity reference vector from forge trace", () => {
    // Vector pulled from BountyVault.t.sol forge -vvvv trace:
    //   REPO_ID = keccak256("github.com/x502-protocol/demo")
    //           = 0x88864a76c02eb12528b373ff117dd41eb00f2030837d76a5af79da1fe3df6800
    //   claimId(REPO_ID, 42, Kind.Fix=2)
    //           = 0x64235e5480741c644f397c40176a024c18b159d5f66beaecc11440966fd028ae
    const repoId = repoIdFromSlug("x502-protocol/demo");
    expect(repoId).toBe("0x88864a76c02eb12528b373ff117dd41eb00f2030837d76a5af79da1fe3df6800");
    const cid = deriveClaimId(repoId, 42n, Kind.Fix);
    expect(cid).toBe("0x64235e5480741c644f397c40176a024c18b159d5f66beaecc11440966fd028ae");
  });

  it("differs by kind", () => {
    const repoId = repoIdFromSlug("x502-protocol/demo");
    const fix = deriveClaimId(repoId, 42n, Kind.Fix);
    const report = deriveClaimId(repoId, 42n, Kind.Report);
    expect(fix).not.toBe(report);
  });

  it("differs by externalId", () => {
    const repoId = repoIdFromSlug("x502-protocol/demo");
    expect(deriveClaimId(repoId, 1n, Kind.Fix)).not.toBe(deriveClaimId(repoId, 2n, Kind.Fix));
  });
});

describe("deriveCommitment", () => {
  it("is deterministic for the same inputs", () => {
    const repoId = repoIdFromSlug("x502-protocol/demo");
    const salt = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as const;
    const a = deriveCommitment(123n, repoId, 42n, salt);
    const b = deriveCommitment(123n, repoId, 42n, salt);
    expect(a).toBe(b);
  });

  it("differs by salt", () => {
    const repoId = repoIdFromSlug("x502-protocol/demo");
    const a = deriveCommitment(
      123n,
      repoId,
      42n,
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    );
    const b = deriveCommitment(
      123n,
      repoId,
      42n,
      "0x0000000000000000000000000000000000000000000000000000000000000002",
    );
    expect(a).not.toBe(b);
  });
});
