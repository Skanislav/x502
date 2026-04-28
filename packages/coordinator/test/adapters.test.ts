import type { Account, Address, Hex } from "viem";
import { describe, expect, it, vi } from "vitest";

import { Kind, type SignedAttestation, repoIdFromSlug } from "@x502/shared";

import { FetchVerifierClient } from "../src/adapters/fetch-verifier.js";
import { StaticRepoRegistry } from "../src/adapters/repo-registry.js";
import { ViemFactProvider } from "../src/adapters/viem-fact-provider.js";
import { ViemVaultWriter } from "../src/adapters/viem-vault.js";

const REPO_SLUG = "x502-protocol/demo";
const REPO_ID = repoIdFromSlug(REPO_SLUG);
const RECIPIENT = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as Address;
const ACCOUNT = { address: "0x1111111111111111111111111111111111111111" } as unknown as Account;
const VAULT = "0x2222222222222222222222222222222222222222" as Address;
const PROVIDER = "0x3333333333333333333333333333333333333333" as Address;
const CLAIM_ID = `0x${"44".repeat(32)}` as Hex;
const FACT_BLOB = `0x${"55".repeat(32)}` as Hex;
const FACT_HASH = `0x${"66".repeat(32)}` as Hex;
const SALT_REVEAL = `0x${"77".repeat(32)}` as Hex;
const TX_HASH = `0x${"88".repeat(32)}` as Hex;
const SIGNATURE_A = `0x${"aa".repeat(65)}` as Hex;
const SIGNATURE_B = `0x${"bb".repeat(65)}` as Hex;

describe("StaticRepoRegistry", () => {
  it("adds and resolves repos by slug and repoId", () => {
    const registry = new StaticRepoRegistry();

    const repoId = registry.add(REPO_SLUG, 2, [101n, 102n]);

    expect(repoId).toBe(REPO_ID);
    expect(registry.resolve(REPO_SLUG)).toEqual({
      repoId,
      threshold: 2,
      trustedAgentIds: [101n, 102n],
    });
    expect(registry.resolveSlug(repoId)).toBe(REPO_SLUG);
    expect(registry.resolve("missing/repo")).toBeUndefined();
  });

  it("overwrites existing slug configuration while preserving repoId lookup", () => {
    const registry = new StaticRepoRegistry();
    const repoId = registry.add(REPO_SLUG, 2, [101n, 102n]);

    expect(registry.add(REPO_SLUG, 1, [999n])).toBe(repoId);

    expect(registry.resolve(REPO_SLUG)).toEqual({
      repoId,
      threshold: 1,
      trustedAgentIds: [999n],
    });
    expect(registry.resolveSlug(repoId)).toBe(REPO_SLUG);
  });
});

describe("FetchVerifierClient", () => {
  it("serializes bigint fields and optional reveals", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        agentId: "101",
        signature: SIGNATURE_A,
        attestation: {
          claimId: CLAIM_ID,
          recipient: RECIPIENT,
          deadline: "123456",
          factHash: FACT_HASH,
        },
      }),
    );
    const client = new FetchVerifierClient(101n, "https://verifier.example", fetchImpl);

    await client.verify({
      repoId: REPO_ID,
      externalId: 42n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      deadline: 123456n,
      factHash: FACT_HASH,
      agentIdReveal: 777n,
      saltReveal: SALT_REVEAL,
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://verifier.example/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repoId: REPO_ID,
        externalId: "42",
        kind: Kind.Fix,
        recipient: RECIPIENT,
        deadline: "123456",
        factHash: FACT_HASH,
        agentIdReveal: "777",
        saltReveal: SALT_REVEAL,
      }),
    });
  });

  it("omits optional reveals when they are not present", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        agentId: "101",
        signature: SIGNATURE_A,
        attestation: {
          claimId: CLAIM_ID,
          recipient: RECIPIENT,
          deadline: "123456",
          factHash: FACT_HASH,
        },
      }),
    );
    const client = new FetchVerifierClient(101n, "https://verifier.example", fetchImpl);

    await client.verify({
      repoId: REPO_ID,
      externalId: 42n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      deadline: 123456n,
      factHash: FACT_HASH,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("agentIdReveal");
    expect(body).not.toHaveProperty("saltReveal");
  });

  it("parses successful JSON into bigint fields", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        agentId: "101",
        signature: SIGNATURE_A,
        attestation: {
          claimId: CLAIM_ID,
          recipient: RECIPIENT,
          deadline: "123456",
          factHash: FACT_HASH,
        },
      }),
    );
    const client = new FetchVerifierClient(101n, "https://verifier.example", fetchImpl);

    const result = await client.verify({
      repoId: REPO_ID,
      externalId: 42n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      deadline: 123456n,
      factHash: FACT_HASH,
    });

    expect(result).toEqual({
      agentId: 101n,
      signature: SIGNATURE_A,
      attestation: {
        claimId: CLAIM_ID,
        recipient: RECIPIENT,
        deadline: 123456n,
        factHash: FACT_HASH,
      },
    });
  });

  it("parses rejection reason and error fields", async () => {
    const reasonClient = new FetchVerifierClient(
      101n,
      "https://verifier.example",
      vi.fn(async () => Response.json({ reason: "not eligible" }, { status: 403 })),
    );
    const errorClient = new FetchVerifierClient(
      102n,
      "https://verifier.example",
      vi.fn(async () => Response.json({ error: "bad request" }, { status: 400 })),
    );
    const req = {
      repoId: REPO_ID,
      externalId: 42n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      deadline: 123456n,
      factHash: FACT_HASH,
    };

    await expect(reasonClient.verify(req)).resolves.toEqual({ rejected: "not eligible" });
    await expect(errorClient.verify(req)).resolves.toEqual({ rejected: "bad request" });
  });

  it("falls back to the default rejection reason when error JSON is invalid", async () => {
    const client = new FetchVerifierClient(
      101n,
      "https://verifier.example",
      vi.fn(async () => new Response("not json", { status: 502 })),
    );

    await expect(
      client.verify({
        repoId: REPO_ID,
        externalId: 42n,
        kind: Kind.Fix,
        recipient: RECIPIENT,
        deadline: 123456n,
        factHash: FACT_HASH,
      }),
    ).resolves.toEqual({ rejected: "verifier https://verifier.example returned 502" });
  });
});

describe("ViemVaultWriter", () => {
  const attestations: SignedAttestation[] = [
    {
      agentId: 101n,
      signature: SIGNATURE_A,
      attestation: {
        claimId: CLAIM_ID,
        recipient: RECIPIENT,
        deadline: 123456n,
        factHash: FACT_HASH,
      },
    },
    {
      agentId: 102n,
      signature: SIGNATURE_B,
      attestation: {
        claimId: CLAIM_ID,
        recipient: RECIPIENT,
        deadline: 123456n,
        factHash: FACT_HASH,
      },
    },
  ];

  function makeWriter(opts?: { simulateReject?: Error; writeReject?: Error }) {
    const request = { sentinel: "vault-payout-request" };
    const publicClient = {
      simulateContract: vi.fn(async (_args: unknown) => {
        if (opts?.simulateReject) throw opts.simulateReject;
        return { request };
      }),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    };
    const wallet = {
      writeContract: vi.fn(async () => {
        if (opts?.writeReject) throw opts.writeReject;
        return TX_HASH;
      }),
    };
    return {
      publicClient,
      request,
      wallet,
      writer: new ViemVaultWriter(publicClient as never, wallet as never, ACCOUNT, VAULT),
    };
  }

  it("simulates, writes, waits for receipt, and returns the tx hash", async () => {
    const { publicClient, request, wallet, writer } = makeWriter();

    await expect(
      writer.submitPayout({
        repoId: REPO_ID,
        externalId: 42n,
        kind: Kind.Fix,
        recipient: RECIPIENT,
        deadline: 123456n,
        factHash: FACT_HASH,
        attestations,
      }),
    ).resolves.toBe(TX_HASH);

    expect(publicClient.simulateContract).toHaveBeenCalledTimes(1);
    expect(publicClient.simulateContract.mock.calls[0]![0]).toMatchObject({
      address: VAULT,
      functionName: "payout",
      account: ACCOUNT,
      args: [
        REPO_ID,
        42n,
        Kind.Fix,
        RECIPIENT,
        123456n,
        FACT_HASH,
        [101n, 102n],
        [SIGNATURE_A, SIGNATURE_B],
      ],
    });
    expect(wallet.writeContract).toHaveBeenCalledTimes(1);
    expect(wallet.writeContract).toHaveBeenCalledWith(request);
    expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
    expect(publicClient.simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(
      wallet.writeContract.mock.invocationCallOrder[0]!,
    );
    expect(wallet.writeContract.mock.invocationCallOrder[0]!).toBeLessThan(
      publicClient.waitForTransactionReceipt.mock.invocationCallOrder[0]!,
    );
  });

  it("propagates simulation failures without writing", async () => {
    const { publicClient, wallet, writer } = makeWriter({
      simulateReject: new Error("simulation reverted"),
    });

    await expect(
      writer.submitPayout({
        repoId: REPO_ID,
        externalId: 42n,
        kind: Kind.Fix,
        recipient: RECIPIENT,
        deadline: 123456n,
        factHash: FACT_HASH,
        attestations,
      }),
    ).rejects.toThrow("simulation reverted");
    expect(wallet.writeContract).not.toHaveBeenCalled();
    expect(publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("propagates write failures without waiting for a receipt", async () => {
    const { publicClient, writer } = makeWriter({ writeReject: new Error("write failed") });

    await expect(
      writer.submitPayout({
        repoId: REPO_ID,
        externalId: 42n,
        kind: Kind.Fix,
        recipient: RECIPIENT,
        deadline: 123456n,
        factHash: FACT_HASH,
        attestations,
      }),
    ).rejects.toThrow("write failed");
    expect(publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
  });
});

describe("ViemFactProvider", () => {
  function makeProvider(readResult: [boolean, Hex] = [false, FACT_BLOB]) {
    let onLogs: ((logs: Array<{ args: { claimId?: Hex; factBlob?: Hex } }>) => void) | undefined;
    const unwatch = vi.fn();
    const request = { sentinel: "fact-request" };
    const publicClient = {
      watchContractEvent: vi.fn((args: { onLogs: typeof onLogs }) => {
        onLogs = args.onLogs;
        return unwatch;
      }),
      simulateContract: vi.fn(async () => ({ request })),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
      readContract: vi.fn(async () => readResult),
    };
    const wallet = {
      writeContract: vi.fn(async () => TX_HASH),
    };
    const provider = new ViemFactProvider(
      publicClient as never,
      wallet as never,
      ACCOUNT,
      PROVIDER,
    );
    return {
      provider,
      publicClient,
      request,
      wallet,
      unwatch,
      emit: (logs: Array<{ args: { claimId?: Hex; factBlob?: Hex } }>) => onLogs?.(logs),
    };
  }

  it("returns immediately when the fact is already ready", async () => {
    const { provider, publicClient } = makeProvider([true, FACT_BLOB]);

    await expect(provider.awaitFact(CLAIM_ID, 1_000)).resolves.toBe(FACT_BLOB);

    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: PROVIDER,
        functionName: "getFact",
        args: [CLAIM_ID],
      }),
    );
  });

  it("requests facts with the expected contract arguments", async () => {
    const { provider, publicClient, request, wallet } = makeProvider();

    await provider.requestFact(CLAIM_ID, REPO_SLUG, 42n, Kind.Fix);

    expect(publicClient.watchContractEvent).toHaveBeenCalledTimes(1);
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: PROVIDER,
        functionName: "requestFact",
        account: ACCOUNT,
        args: [CLAIM_ID, REPO_SLUG, 42n, Kind.Fix],
      }),
    );
    expect(wallet.writeContract).toHaveBeenCalledTimes(1);
    expect(wallet.writeContract).toHaveBeenCalledWith(request);
    expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
    expect(publicClient.simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(
      wallet.writeContract.mock.invocationCallOrder[0]!,
    );
    expect(wallet.writeContract.mock.invocationCallOrder[0]!).toBeLessThan(
      publicClient.waitForTransactionReceipt.mock.invocationCallOrder[0]!,
    );
  });

  it("resolves pending facts from matching events", async () => {
    const { provider, emit } = makeProvider();
    await provider.requestFact(CLAIM_ID, REPO_SLUG, 42n, Kind.Fix);

    const pending = provider.awaitFact(CLAIM_ID, 1_000);
    await Promise.resolve();
    emit([{ args: { claimId: CLAIM_ID, factBlob: FACT_BLOB } }]);

    await expect(pending).resolves.toBe(FACT_BLOB);
  });

  it("ignores unrelated events and events with missing blobs", async () => {
    vi.useFakeTimers();
    try {
      const { provider, emit } = makeProvider();
      await provider.requestFact(CLAIM_ID, REPO_SLUG, 42n, Kind.Fix);

      const pending = provider.awaitFact(CLAIM_ID, 1_000);
      const rejection = expect(pending).rejects.toThrow("fact not delivered within 1000ms");
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
      emit([
        { args: { claimId: `0x${"99".repeat(32)}` as Hex, factBlob: FACT_BLOB } },
        { args: { claimId: CLAIM_ID } },
      ]);
      await vi.advanceTimersByTimeAsync(999);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleans up timed-out pending facts so later events do not resolve them", async () => {
    vi.useFakeTimers();
    try {
      const { provider, emit } = makeProvider();
      await provider.requestFact(CLAIM_ID, REPO_SLUG, 42n, Kind.Fix);

      const timedOut = provider.awaitFact(CLAIM_ID, 50);
      const rejection = expect(timedOut).rejects.toThrow("fact not delivered within 50ms");
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(50);
      await rejection;

      const next = provider.awaitFact(CLAIM_ID, 50);
      await Promise.resolve();
      emit([{ args: { claimId: CLAIM_ID, factBlob: FACT_BLOB } }]);
      await expect(next).resolves.toBe(FACT_BLOB);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts idempotently and can be stopped", () => {
    const { provider, publicClient, unwatch } = makeProvider();

    provider.start();
    provider.start();
    expect(publicClient.watchContractEvent).toHaveBeenCalledTimes(1);

    provider.stop();
    expect(unwatch).toHaveBeenCalledTimes(1);

    provider.start();
    expect(publicClient.watchContractEvent).toHaveBeenCalledTimes(2);
  });
});
