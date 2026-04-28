import { deriveCommitment, repoIdFromSlug } from "@x502/shared";

export interface CommitmentArgs {
  agentId: string;
  repo: string;
  externalId: string;
  salt: `0x${string}`;
}

export function deriveCommitmentOutput(args: CommitmentArgs): {
  repoId: `0x${string}`;
  commitment: `0x${string}`;
} {
  const repoId = repoIdFromSlug(args.repo);
  const commitment = deriveCommitment(BigInt(args.agentId), repoId, BigInt(args.externalId), args.salt);
  return { repoId, commitment };
}

export function formatCommitmentOutput(args: CommitmentArgs): string {
  const { repoId, commitment } = deriveCommitmentOutput(args);
  return [
    `repoId     : ${repoId}`,
    `commitment : ${commitment}`,
    "",
    "Paste this into your GitHub issue/PR body:",
    `<!-- x502-commitment:${commitment} -->`,
  ].join("\n");
}
