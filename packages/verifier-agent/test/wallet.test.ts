/// Unit tests for the wallet-provider abstraction. Covers:
/// - EnvKeyProvider: derived address matches the private key
/// - pickWalletProviderFromEnv: env routing + missing-key error
///
/// CdpWalletProvider needs real CDP credentials and a network; not covered
/// here (would be an integration test with secrets in CI).

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { describe, expect, it } from "vitest";

import {
  CdpWalletProvider,
  EnvKeyWalletProvider,
  pickWalletProviderFromEnv,
} from "../src/index.js";

describe("EnvKeyWalletProvider", () => {
  it("returns an Account whose address matches the private key", async () => {
    const pk = generatePrivateKey();
    const expected = privateKeyToAccount(pk).address;

    const provider = new EnvKeyWalletProvider(pk);
    const wallet = await provider.bootstrap({
      chain: foundry,
      agentId: 100n,
    });

    expect(wallet.address.toLowerCase()).toBe(expected.toLowerCase());
    expect(wallet.account.address.toLowerCase()).toBe(expected.toLowerCase());
    expect(wallet.agentId).toBe(100n);
    expect(wallet.source).toBe("envkey");
  });

  it("constructed walletClient signs with the same address", async () => {
    const pk = generatePrivateKey();
    const provider = new EnvKeyWalletProvider(pk);
    const wallet = await provider.bootstrap({ chain: foundry, agentId: 1n });
    expect(wallet.walletClient.account?.address.toLowerCase()).toBe(wallet.address.toLowerCase());
  });
});

describe("pickWalletProviderFromEnv", () => {
  it("defaults to envkey when WALLET_PROVIDER is unset", () => {
    const pk = generatePrivateKey();
    const provider = pickWalletProviderFromEnv({ VERIFIER_PRIVATE_KEY: pk });
    expect(provider).toBeInstanceOf(EnvKeyWalletProvider);
  });

  it("returns EnvKeyWalletProvider when WALLET_PROVIDER=envkey", () => {
    const pk = generatePrivateKey();
    const provider = pickWalletProviderFromEnv({
      WALLET_PROVIDER: "envkey",
      VERIFIER_PRIVATE_KEY: pk,
    });
    expect(provider).toBeInstanceOf(EnvKeyWalletProvider);
  });

  it("throws when envkey is selected but VERIFIER_PRIVATE_KEY is missing", () => {
    expect(() => pickWalletProviderFromEnv({ WALLET_PROVIDER: "envkey" })).toThrow(
      /VERIFIER_PRIVATE_KEY/,
    );
  });

  it("returns CdpWalletProvider when WALLET_PROVIDER=cdp", () => {
    // Constructor doesn't make a network call — only `bootstrap()` does — so
    // we can pin the type without real credentials.
    const provider = pickWalletProviderFromEnv({
      WALLET_PROVIDER: "cdp",
      VERIFIER_AGENT_ID: "101",
      CDP_API_KEY_ID: "fake",
      CDP_API_KEY_SECRET: "fake",
      CDP_WALLET_SECRET: "fake",
    });
    expect(provider).toBeInstanceOf(CdpWalletProvider);
  });

  it("throws on unknown WALLET_PROVIDER", () => {
    expect(() => pickWalletProviderFromEnv({ WALLET_PROVIDER: "wat" })).toThrow(/Unknown/);
  });
});
