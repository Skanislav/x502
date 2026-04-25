/// End-to-end integration test: anvil + deployed contracts + 3 in-process
/// verifier-agent Honos + coordinator Hono. Drives a `kind=fix` happy path
/// claim from POST /claim through to USDC arriving in the claimant's wallet.
///
/// Requires `anvil` on PATH (i.e. `~/.foundry/bin`).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  zeroAddress,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import {
  Kind,
  deriveClaimId,
  repoIdFromSlug,
  type SignedAttestation,
} from "@x502/shared";
import { AcceptAllPolicy, buildVerifierApp } from "@x502/verifier-agent";

import {
  buildCoordinator,
  FetchVerifierClient,
  StaticRepoRegistry,
  ViemFactProvider,
  ViemVaultWriter,
} from "../src/index.js";
import { startAnvil, type AnvilHandle } from "./helpers/anvil.ts";
import {
  bountyVaultAbi,
  deployAll,
  mockAgentRegistryAbi,
  mockGitHubFactProviderAbi,
  mockUSDCAbi,
} from "./helpers/deploy.ts";

let anvil: AnvilHandle;

beforeAll(async () => {
  anvil = await startAnvil();
}, 30_000);

afterAll(async () => {
  await anvil?.stop();
});

const REPO_SLUG = "x502-protocol/demo";

describe("end-to-end claim → payout (all mocks, kind=fix)", () => {
  it("pays the claimant + verifiers via the vault", async () => {
    // ---- chain clients ----
    // Anvil's first prefunded key — deployer + repo owner.
    const deployerKey =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
    const deployer = privateKeyToAccount(deployerKey);

    const transport = http(anvil.rpcUrl);
    const publicClient = createPublicClient({ transport, chain: foundry, pollingInterval: 200 });
    const wallet = createWalletClient({ transport, chain: foundry, account: deployer });

    // ---- deploy ----
    const { usdc, registry, factProvider, vault } = await deployAll(
      publicClient as unknown as PublicClient,
      wallet as unknown as WalletClient,
      deployer,
    );

    // ---- 3 verifier identities, registered in MockAgentRegistry ----
    const verifierKeys = [generatePrivateKey(), generatePrivateKey(), generatePrivateKey()];
    const verifierAccounts: Account[] = verifierKeys.map(privateKeyToAccount);
    const verifierIds = [101n, 102n, 103n];
    const verifierWallets = verifierAccounts.map((a) => a.address);

    for (let i = 0; i < 3; i++) {
      await wallet.writeContract({
        address: registry,
        abi: mockAgentRegistryAbi,
        functionName: "setAgentWallet",
        args: [verifierIds[i], verifierWallets[i]],
      });
    }

    // ---- repo config + funding ----
    const repoId = repoIdFromSlug(REPO_SLUG);
    const prices = {
      report: parseUnits("5", 6),
      triage: parseUnits("2", 6),
      fix: parseUnits("50", 6),
      docsTests: parseUnits("30", 6),
    };
    const outcomeFee = 100_000n; // $0.10
    await wallet.writeContract({
      address: vault,
      abi: bountyVaultAbi,
      functionName: "configureRepo",
      args: [repoId, verifierIds, 2, prices, outcomeFee],
    });

    const funding = parseUnits("1000", 6);
    await wallet.writeContract({
      address: usdc,
      abi: mockUSDCAbi,
      functionName: "mint",
      args: [deployer.address, funding],
    });
    await wallet.writeContract({
      address: usdc,
      abi: mockUSDCAbi,
      functionName: "approve",
      args: [vault, funding],
    });
    await wallet.writeContract({
      address: vault,
      abi: bountyVaultAbi,
      functionName: "deposit",
      args: [repoId, funding],
    });

    // ---- 3 verifier-agent Hono apps + in-process fetch impl ----
    const verifierApps = verifierAccounts.map((account, i) => {
      const wc = createWalletClient({ transport, chain: foundry, account });
      return buildVerifierApp({
        signer: { agentId: verifierIds[i]!, vault, chainId: foundry.id, account, wallet: wc },
        policy: new AcceptAllPolicy(),
        repoSlugResolver: (id) => (id === repoId ? REPO_SLUG : undefined),
      });
    });
    const inProcessFetch = (host: string) => {
      const app = verifierApps[Number(host.split("-")[1])]!;
      return (async (url: string | URL | Request, init?: RequestInit) => {
        const u = typeof url === "string" ? new URL(url) : url instanceof URL ? url : new URL(url.url);
        return app.request(u.pathname + u.search, init as RequestInit);
      }) as typeof fetch;
    };
    const verifiers = verifierIds.map(
      (id, i) =>
        new FetchVerifierClient(id, `http://verifier-${i}`, inProcessFetch(`verifier-${i}`)),
    );

    // ---- coordinator wiring ----
    const repoRegistry = new StaticRepoRegistry();
    repoRegistry.add(REPO_SLUG, 2, verifierIds);

    const factProviderClient = new ViemFactProvider(
      publicClient as unknown as PublicClient,
      wallet as unknown as WalletClient,
      deployer,
      factProvider,
    );
    factProviderClient.start();

    const vaultWriter = new ViemVaultWriter(
      publicClient as unknown as PublicClient,
      wallet as unknown as WalletClient,
      deployer,
      vault,
    );

    const coord = buildCoordinator({
      factProvider: factProviderClient,
      vault: vaultWriter,
      repoRegistry,
      verifiers,
      factTimeoutMs: 15_000,
      verifierTimeoutMs: 10_000,
      deadlineWindowSec: 300,
      pollRetryAfterSec: 1,
    });

    // ---- the demo: claim a fix on issue #42 ----
    const claimant = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as const;
    const externalId = 42n;
    const kind = Kind.Fix;
    const claimId = deriveClaimId(repoId, externalId, kind);

    // The factBlob the oracle would deliver. Same shape we agreed onchain.
    const factBlob = encodeFactBlob({ status: 1, mergedBlock: 12345n, labelMask: zeroBytes32, ghAuthorBinding: claimant });

    // Pre-arm the mock oracle: as soon as the coordinator calls requestFact,
    // the test fulfills it. We use a viem watcher so we don't race the call.
    const unwatch = publicClient.watchContractEvent({
      address: factProvider,
      abi: mockGitHubFactProviderAbi,
      eventName: "FactFulfilled",
      onLogs: () => { /* will be cleaned up below */ },
    });
    // Set up a one-shot "intercept the next requestFact and fulfill" by
    // watching for the requestId map update — simpler to just poll the test.
    const fulfillWhenRequested = (async () => {
      // wait until lastRequestId[claimId] != 0
      const start = Date.now();
      while (Date.now() - start < 10_000) {
        const reqId = (await publicClient.readContract({
          address: factProvider,
          abi: mockGitHubFactProviderAbi,
          functionName: "lastRequestId",
          args: [claimId],
        })) as Hex;
        if (reqId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          await wallet.writeContract({
            address: factProvider,
            abi: mockGitHubFactProviderAbi,
            functionName: "mockFulfill",
            args: [claimId, factBlob],
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error("requestFact never observed");
    })();

    // POST /claim
    const postRes = await coord.app.request("/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repoSlug: REPO_SLUG,
        externalId: externalId.toString(),
        kind: "fix",
        recipient: claimant,
      }),
    });
    expect(postRes.status).toBe(200);
    const post = (await postRes.json()) as { claimId: Hex; pollUrl: string; status: string };
    expect(post.claimId).toBe(claimId);

    await fulfillWhenRequested;

    // Poll /payout/:claimId until paid (max 15s)
    const start = Date.now();
    let paid: { status: string; txHash?: Hex } | undefined;
    while (Date.now() - start < 15_000) {
      const r = await coord.app.request(post.pollUrl);
      if (r.status === 200) {
        paid = (await r.json()) as { status: string; txHash?: Hex };
        break;
      }
      if (r.status === 410) {
        const err = await r.json();
        throw new Error(`coordinator failed: ${JSON.stringify(err)}`);
      }
      expect(r.status).toBe(202);
      const ra = r.headers.get("Retry-After");
      expect(ra).toBeTruthy();
      await new Promise((res) => setTimeout(res, Number(ra) * 1000));
    }
    expect(paid?.status).toBe("paid");
    expect(paid?.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

    // ---- Assert chain state ----
    const claimantBalance = (await publicClient.readContract({
      address: usdc,
      abi: mockUSDCAbi,
      functionName: "balanceOf",
      args: [claimant],
    })) as bigint;
    expect(claimantBalance).toBe(prices.fix - 2n * outcomeFee);

    const v0Balance = (await publicClient.readContract({
      address: usdc,
      abi: mockUSDCAbi,
      functionName: "balanceOf",
      args: [verifierWallets[0]!],
    })) as bigint;
    const v1Balance = (await publicClient.readContract({
      address: usdc,
      abi: mockUSDCAbi,
      functionName: "balanceOf",
      args: [verifierWallets[1]!],
    })) as bigint;
    // Two of three verifiers signed; the third gets nothing.
    expect(v0Balance + v1Balance).toBe(2n * outcomeFee);

    const repoBalance = (await publicClient.readContract({
      address: vault,
      abi: bountyVaultAbi,
      functionName: "balanceOf",
      args: [repoId],
    })) as bigint;
    expect(repoBalance).toBe(funding - prices.fix);

    const wasPaid = (await publicClient.readContract({
      address: vault,
      abi: bountyVaultAbi,
      functionName: "isPaid",
      args: [claimId],
    })) as boolean;
    expect(wasPaid).toBe(true);

    unwatch();
    factProviderClient.stop();
  }, 60_000);
});

const zeroBytes32 = ("0x" + "00".repeat(32)) as Hex;

function encodeFactBlob(args: {
  status: number;
  mergedBlock: bigint;
  labelMask: Hex;
  ghAuthorBinding: Address;
}): Hex {
  // Solidity: abi.encode(uint8, uint64, bytes32, address)
  // For the mock fact provider it just needs to be self-consistent (the vault
  // checks keccak256(blob) == factHash, not the structure).
  const { encodeAbiParameters } = require("viem") as typeof import("viem");
  return encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }, { type: "address" }],
    [args.status, args.mergedBlock, args.labelMask, args.ghAuthorBinding],
  );
}
