// x502 GitHub fact source — runs inside the Chainlink Functions DON (Deno).
//
// Args:
//   args[0] = repo slug ("owner/repo")
//   args[1] = external id (issue or PR number, decimal string)
//   args[2] = kind (0=report, 1=triage, 2=fix, 3=docs_tests)
//
// Secrets (DON-hosted):
//   GITHUB_PAT — GitHub personal access token (lifts rate limit to 5k/h).
//
// Returns ABI-encoded (uint8 status, uint64 mergedBlock, bytes32 labelMask, address ghAuthorBinding).
//
// status:
//   1 = claim is verifiable for this kind, 0 = not.
// ghAuthorBinding:
//   Wallet decoded from `<!-- x502:0x... -->` HTML comment in the issue/PR body.
//   Lets the verifier agent + vault bind the GH author to a wallet without OAuth.

import { ethers } from "https://esm.sh/ethers@6.13.4";

const repoSlug = args[0];
const externalId = args[1];
const kind = parseInt(args[2], 10);

const [owner, repo] = repoSlug.split("/");
if (!owner || !repo) throw Error("bad repoSlug");

const isPr = kind === 2 || kind === 3;
const endpoint = isPr ? "pulls" : "issues";

const headers = {
  Authorization: `Bearer ${secrets.GITHUB_PAT}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "x502-fact-receiver",
};

const r = await Functions.makeHttpRequest({
  url: `https://api.github.com/repos/${owner}/${repo}/${endpoint}/${externalId}`,
  headers,
  timeout: 9000,
});
if (r.error) throw Error(`gh ${endpoint}/${externalId} fetch failed: ${r.error}`);
const d = r.data;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ZERO_B32 = "0x" + "0".repeat(64);

// Extract wallet binding from body comment.
const body = (d.body ?? "");
const m = body.match(/<!--\s*x502:(0x[a-fA-F0-9]{40})\s*-->/);
const ghAuthorBinding = m ? m[1].toLowerCase() : ZERO_ADDR;

let status = 0;
let mergedBlock = 0n;
let labelMask = ZERO_B32;

if (kind === 0) {
  // report
  const labels = (d.labels ?? []).map((l) => (typeof l === "string" ? l : l.name).toLowerCase());
  const accepted = labels.includes("accepted") || labels.includes("bug") || labels.includes("enhancement");
  const rejected = labels.includes("wontfix") || labels.includes("duplicate") || labels.includes("invalid");
  status = accepted && !rejected ? 1 : 0;
  let mask = 0n;
  if (labels.includes("bug")) mask |= 1n;
  if (labels.includes("enhancement")) mask |= 2n;
  if (labels.includes("accepted")) mask |= 4n;
  labelMask = ethers.zeroPadValue(ethers.toBeHex(mask), 32);
} else if (kind === 1) {
  // triage
  const labels = (d.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);
  status = labels.length >= 2 ? 1 : 0; // demand at least 2 labels for triage credit
  let mask = 0n;
  if (labels.map((s) => s.toLowerCase()).includes("triage-done")) mask |= 8n;
  labelMask = ethers.zeroPadValue(ethers.toBeHex(mask), 32);
} else if (kind === 2) {
  // fix
  if (d.merged === true) {
    const linkRe = /(?:fixes|closes|resolves)\s+#\d+/i;
    if (linkRe.test(body)) {
      status = 1;
      if (d.merge_commit_sha) {
        mergedBlock = BigInt("0x" + d.merge_commit_sha.slice(2, 18));
      }
    }
  }
} else if (kind === 3) {
  // docs_tests
  if (d.merged === true) {
    const fr = await Functions.makeHttpRequest({
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${externalId}/files`,
      headers,
      timeout: 9000,
    });
    if (!fr.error) {
      const files = fr.data ?? [];
      const testRe = /(^|\/)(test|tests|spec|__tests__)\//i;
      const docRe = /(^|\/)(docs|readme)/i;
      const hasTest = files.some((f) => testRe.test(f.filename ?? ""));
      const hasDoc = files.some((f) => docRe.test(f.filename ?? ""));
      if (hasTest || hasDoc) {
        status = 1;
        if (d.merge_commit_sha) {
          mergedBlock = BigInt("0x" + d.merge_commit_sha.slice(2, 18));
        }
        let mask = 0n;
        if (hasTest) mask |= 1n;
        if (hasDoc) mask |= 2n;
        labelMask = ethers.zeroPadValue(ethers.toBeHex(mask), 32);
      }
    }
  }
} else {
  throw Error(`unknown kind ${kind}`);
}

const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint8", "uint64", "bytes32", "address"],
  [status, mergedBlock, labelMask, ghAuthorBinding],
);
return ethers.getBytes(encoded);
