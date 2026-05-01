/// Long-running watcher that simulates the Chainlink Functions DON for the
/// local demo. Subscribes to MockGitHubFactProvider's request stream, fetches
/// the GitHub issue/PR via Octokit, runs the canonical decideFact() logic from
/// chainlink/source-core.js, ABI-encodes the result, and calls mockFulfill.
///
/// This is the only place the demo bridges between "off-chain GitHub state"
/// and "on-chain fact bytes". By reusing source-core.js verbatim, the local
/// demo and the real DON evaluate identical rules.

import { Octokit } from "@octokit/rest";
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { pickOneClawFromEnv } from "@x502/shared";
import { mockGitHubFactProviderAbi } from "@x502/shared/abis";

import { decideFact, parseRepoSlug } from "../../chainlink/source-core.js";
import { readRuntime } from "./lib/runtime.js";

interface PendingRequest {
  claimId: Hex;
  repoSlug: string;
  externalId: bigint;
  kind: number;
}

const seen = new Set<string>(); // requestId-claimId pairs already fulfilled

async function fetchAndDecide(octokit: Octokit, req: PendingRequest) {
  const { owner, repo } = parseRepoSlug(req.repoSlug);
  const isPr = req.kind === 2 || req.kind === 3;
  const item = isPr
    ? (
        await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: Number(req.externalId),
        })
      ).data
    : (await octokit.rest.issues.get({ owner, repo, issue_number: Number(req.externalId) })).data;

  let files: Array<{ filename: string }> = [];
  if (req.kind === 3 && (item as { merged?: boolean }).merged === true) {
    const fr = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: Number(req.externalId),
    });
    files = fr.data;
  }

  return decideFact({ kind: req.kind, item, files });
}

function encodeBlob(fact: {
  status: number;
  mergedBlock: bigint;
  labelMask: Hex;
  ghAuthorBinding: string;
}): Hex {
  return encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }, { type: "address" }],
    [fact.status, fact.mergedBlock, fact.labelMask, fact.ghAuthorBinding as Address],
  );
}

async function main() {
  const rt = readRuntime();
  const oneClaw = pickOneClawFromEnv(process.env);
  const githubToken = await oneClaw.getSecret("GITHUB_TOKEN");
  const octokit = new Octokit({ auth: githubToken });
  // Auto-fulfill is part of the local demo only — it spends the anvil
  // deployer's gas to call mockFulfill. The deployer key already lives in
  // addresses.json so we don't route this signer through 1claw.
  const account = privateKeyToAccount(rt.deployerKey);
  const transport = http(rt.rpcUrl);
  const publicClient = createPublicClient({
    transport,
    chain: foundry,
    pollingInterval: 500,
  });
  const wallet = createWalletClient({ transport, chain: foundry, account });

  process.stdout.write(`[auto-fulfill] watching ${rt.contracts.factProvider} for fact requests\n`);

  // Track pending requests by polling lastRequestId per claimId. The mock
  // doesn't index claimId in the FactRequested event, so we react to the
  // RequestSent event from the underlying base contract — but the simplest
  // approach is to scan FactFulfilled-absence: for each new requestFact call
  // we observe, fulfill if not already done.
  //
  // Concretely: poll lastRequestId for any claimId we've seen via /claim.
  // Since we don't have direct visibility into the coordinator's claims map
  // here, we instead watch all blocks for transactions to the fact provider
  // and decode the input.
  //
  // Simpler approach used here: poll the FactFulfilled event to know what's
  // been fulfilled, and watch for requestFact transactions on the contract
  // to know what's pending.

  publicClient.watchBlocks({
    onBlock: async (block) => {
      const txs = await publicClient.getBlock({ blockHash: block.hash, includeTransactions: true });
      for (const tx of txs.transactions) {
        if (tx.to?.toLowerCase() !== rt.contracts.factProvider.toLowerCase()) continue;
        // Decode input as requestFact(bytes32 claimId, string repo, uint256 externalId, uint8 kind)
        const sel = tx.input.slice(0, 10);
        // requestFact selector — derived once at boot in production, but simpler
        // to decode any non-mockFulfill call since the mock has only requestFact
        // + mockFulfill + getFact.
        if (sel === "0x636d2f64") continue; // setAgentWallet shape (different abi) — not us
        try {
          const { decodeFunctionData } = await import("viem");
          const decoded = decodeFunctionData({
            abi: mockGitHubFactProviderAbi,
            data: tx.input,
          });
          if (decoded.functionName !== "requestFact") continue;
          const [claimId, repoSlug, externalId, kind] = decoded.args as [
            Hex,
            string,
            bigint,
            number,
          ];
          const key = `${claimId}-${tx.hash}`;
          if (seen.has(key)) continue;
          seen.add(key);

          process.stdout.write(
            `[auto-fulfill] fact requested cid=${claimId.slice(0, 10)}… repo=${repoSlug} #${externalId} kind=${kind}\n`,
          );

          let blob: Hex;
          try {
            const fact = await fetchAndDecide(octokit, {
              claimId,
              repoSlug,
              externalId,
              kind: Number(kind),
            });
            blob = encodeBlob(fact);
            process.stdout.write(
              `[auto-fulfill]   decided status=${fact.status} mergedBlock=${fact.mergedBlock}\n`,
            );
          } catch (e) {
            process.stderr.write(`[auto-fulfill]   decideFact failed: ${(e as Error).message}\n`);
            blob = encodeBlob({
              status: 0,
              mergedBlock: 0n,
              labelMask: `0x${"00".repeat(32)}` as Hex,
              ghAuthorBinding: "0x0000000000000000000000000000000000000000",
            });
          }

          await wallet.writeContract({
            address: rt.contracts.factProvider,
            abi: mockGitHubFactProviderAbi,
            functionName: "mockFulfill",
            args: [claimId, blob],
            chain: null,
            account,
          });
          process.stdout.write(`[auto-fulfill]   fulfilled cid=${claimId.slice(0, 10)}…\n`);
        } catch {
          /* not a recognizable call — skip */
        }
      }
    },
  });

  // Keep alive
  await new Promise(() => {});
}

main().catch((e) => {
  console.error("[auto-fulfill] failed:", e);
  process.exit(1);
});
