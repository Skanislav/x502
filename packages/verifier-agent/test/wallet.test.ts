/// Unit tests for the wallet-provider abstraction. Today there is exactly one
/// provider — `OneClawWalletProvider` — backed by `pickOneClawFromEnv`. We
/// cover:
///   - bootstrap returns a viem Account whose address matches what 1claw
///     resolved (local mode = derived from the env-bound private key)
///   - signing flows through the OneClaw client (delegation contract)
///   - pickWalletProviderFromEnv routes ONECLAW_MODE / ONECLAW_SCOPE_ID

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { describe, expect, it } from "vitest";

import { localOneClaw } from "@x502/shared";

import { OneClawWalletProvider, pickWalletProviderFromEnv } from "../src/index.js";

const typedData = {
  domain: { name: "x502", version: "1", chainId: 31337 },
  types: {
    Claim: [{ name: "agentId", type: "uint256" }],
  },
  primaryType: "Claim",
  message: { agentId: 101n },
} as const;

describe("OneClawWalletProvider", () => {
  it("bootstrap returns an Account whose address matches the resolved scope", async () => {
    const pk = generatePrivateKey();
    const expected = privateKeyToAccount(pk).address;
    const client = localOneClaw({ MY_KEY: pk });

    const provider = new OneClawWalletProvider(client, "MY_KEY");
    const wallet = await provider.bootstrap({ chain: foundry, agentId: 101n });

    expect(wallet.address.toLowerCase()).toBe(expected.toLowerCase());
    expect(wallet.account.address.toLowerCase()).toBe(expected.toLowerCase());
    expect(wallet.agentId).toBe(101n);
    expect(wallet.source).toBe("oneclaw:eoa");
  });

  it("Account.signTypedData delegates to the OneClaw client and returns its signature", async () => {
    const pk = generatePrivateKey();
    const client = localOneClaw({ MY_KEY: pk });

    const provider = new OneClawWalletProvider(client, "MY_KEY");
    const wallet = await provider.bootstrap({ chain: foundry, agentId: 1n });

    // Deterministic EIP-712 sig — local mode is just viem under the hood.
    const expected = await privateKeyToAccount(pk).signTypedData(typedData);
    const actual = await wallet.account.signTypedData(typedData);
    expect(actual).toBe(expected);
  });

  it("constructed walletClient uses the resolved address as its account", async () => {
    const pk = generatePrivateKey();
    const expected = privateKeyToAccount(pk).address;
    const client = localOneClaw({ MY_KEY: pk });

    const provider = new OneClawWalletProvider(client, "MY_KEY");
    const wallet = await provider.bootstrap({ chain: foundry, agentId: 1n });

    expect(wallet.walletClient.account?.address.toLowerCase()).toBe(expected.toLowerCase());
  });

  it("bootstrap surfaces a clear error when the scope is not bound in env", async () => {
    const client = localOneClaw({});
    const provider = new OneClawWalletProvider(client, "UNSET_KEY");
    await expect(provider.bootstrap({ chain: foundry, agentId: 1n })).rejects.toThrow(/UNSET_KEY/);
  });
});

describe("pickWalletProviderFromEnv", () => {
  it("returns a OneClawWalletProvider that resolves VERIFIER_PRIVATE_KEY by default", async () => {
    const pk = generatePrivateKey();
    const expected = privateKeyToAccount(pk).address;

    const provider = pickWalletProviderFromEnv({ VERIFIER_PRIVATE_KEY: pk });
    expect(provider).toBeInstanceOf(OneClawWalletProvider);
    const wallet = await provider.bootstrap({ chain: foundry, agentId: 1n });
    expect(wallet.address.toLowerCase()).toBe(expected.toLowerCase());
  });

  it("respects ONECLAW_SCOPE_ID override", async () => {
    const pk = generatePrivateKey();
    const expected = privateKeyToAccount(pk).address;

    const provider = pickWalletProviderFromEnv({
      ONECLAW_SCOPE_ID: "MY_SCOPE",
      MY_SCOPE: pk,
    });
    const wallet = await provider.bootstrap({ chain: foundry, agentId: 1n });
    expect(wallet.address.toLowerCase()).toBe(expected.toLowerCase());
  });

  it("ONECLAW_MODE=remote selects the remote stub which fails-fast on bootstrap", async () => {
    const provider = pickWalletProviderFromEnv({ ONECLAW_MODE: "remote" });
    expect(provider).toBeInstanceOf(OneClawWalletProvider);
    await expect(provider.bootstrap({ chain: foundry, agentId: 1n })).rejects.toThrow(
      /not yet wired/,
    );
  });

  it("rejects an unknown ONECLAW_MODE up front", () => {
    expect(() => pickWalletProviderFromEnv({ ONECLAW_MODE: "wat" })).toThrow(/Unknown/);
  });
});
