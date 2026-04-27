#!/usr/bin/env -S tsx
// Helper: print the GitHub-body commitment for a given (agentId, repo, externalId, salt).
// The reporter (or fixer) pastes the printed `<!-- x502-commitment:0x... -->` line
// into their issue/PR body so verifier agents can bind their wallet to the GH author.
//
//   tsx demo/scripts/derive-commitment.ts \
//     --agent-id 101 \
//     --repo skanislav/x502 \
//     --external-id 42 \
//     --salt 0x0000...0001

import { parseArgs } from "node:util";
import { deriveCommitment, repoIdFromSlug } from "@x502/shared";

const { values } = parseArgs({
  options: {
    "agent-id": { type: "string" },
    repo: { type: "string" },
    "external-id": { type: "string" },
    salt: { type: "string" },
  },
});

if (!values["agent-id"] || !values.repo || !values["external-id"] || !values.salt) {
  console.error(
    "usage: derive-commitment.ts --agent-id <N> --repo owner/name --external-id <N> --salt 0x...",
  );
  process.exit(1);
}

const repoId = repoIdFromSlug(values.repo);
const commitment = deriveCommitment(
  BigInt(values["agent-id"]),
  repoId,
  BigInt(values["external-id"]),
  values.salt as `0x${string}`,
);

console.log(`repoId     : ${repoId}`);
console.log(`commitment : ${commitment}`);
console.log("");
console.log("Paste this into your GitHub issue/PR body:");
console.log(`<!-- x502-commitment:${commitment} -->`);
