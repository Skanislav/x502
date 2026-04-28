import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { deriveCommitment, repoIdFromSlug } from "@x502/shared";
import { describe, expect, it } from "vitest";
import { deriveCommitmentOutput, formatCommitmentOutput } from "../scripts/commitment.js";

const execFileAsync = promisify(execFile);
const SALT = `0x${"11".repeat(32)}` as const;

describe("commitment helper", () => {
  it("derives the repo id and commitment", () => {
    const repoId = repoIdFromSlug("owner/repo");

    expect(
      deriveCommitmentOutput({
        agentId: "101",
        repo: "owner/repo",
        externalId: "2",
        salt: SALT,
      }),
    ).toEqual({
      repoId,
      commitment: deriveCommitment(101n, repoId, 2n, SALT),
    });
  });

  it("formats a GitHub commitment marker", () => {
    expect(
      formatCommitmentOutput({
        agentId: "101",
        repo: "owner/repo",
        externalId: "2",
        salt: SALT,
      }),
    ).toContain("<!-- x502-commitment:0x");
  });
});

describe("derive-commitment CLI", () => {
  it("prints commitment output for valid args", async () => {
    const { stdout } = await execFileAsync(
      "pnpm",
      [
        "tsx",
        "scripts/derive-commitment.ts",
        "--agent-id",
        "101",
        "--repo",
        "owner/repo",
        "--external-id",
        "2",
        "--salt",
        SALT,
      ],
      { cwd: new URL("..", import.meta.url) },
    );

    expect(stdout).toContain("repoId     : 0x");
    expect(stdout).toContain("<!-- x502-commitment:0x");
  });

  it("exits non-zero and prints usage when required args are missing", async () => {
    await expect(
      execFileAsync("pnpm", ["tsx", "scripts/derive-commitment.ts"], {
        cwd: new URL("..", import.meta.url),
      }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("usage: derive-commitment.ts"),
    });
  });
});
