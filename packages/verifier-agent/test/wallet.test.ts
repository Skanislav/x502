/// Unit tests for the wallet-provider abstraction. Covers:
/// - EnvKeyProvider: derived address matches the private key
/// - pickWalletProviderFromEnv: env routing + missing-key error

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cdpMocks = vi.hoisted(() => ({
  CdpClient: vi.fn(),
  getOrCreateAccount: vi.fn(),
  getOrCreateSmartAccount: vi.fn(),
}));

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: cdpMocks.CdpClient,
}));

import {
  CdpWalletProvider,
  EnvKeyWalletProvider,
  pickWalletProviderFromEnv,
} from "../src/index.js";

const EOA_ADDRESS = "0x1111111111111111111111111111111111111111";
const OWNER_ADDRESS = "0x2222222222222222222222222222222222222222";
const SMART_ADDRESS = "0x3333333333333333333333333333333333333333";

const typedData = {
  domain: { name: "x502", version: "1", chainId: 31337 },
  types: {
    Claim: [{ name: "agentId", type: "uint256" }],
  },
  primaryType: "Claim",
  message: { agentId: 101n },
} as const;

beforeEach(() => {
  vi.resetAllMocks();
  cdpMocks.CdpClient.mockImplementation(() => ({
    evm: {
      getOrCreateAccount: cdpMocks.getOrCreateAccount,
      getOrCreateSmartAccount: cdpMocks.getOrCreateSmartAccount,
    },
  }));
});

function mockEoaAccount(address: `0x${string}` = EOA_ADDRESS) {
  const requestFaucet = vi.fn().mockResolvedValue(undefined);
  const networkAccount = { requestFaucet };
  const signMessage = vi.fn(function (this: { address: `0x${string}` }, parameters: unknown) {
    expect(this.address).toBe(address);
    expect(parameters).toBeDefined();
    return Promise.resolve("0x0101");
  });
  const signTransaction = vi.fn(function (this: { address: `0x${string}` }, parameters: unknown) {
    expect(this.address).toBe(address);
    expect(parameters).toBeDefined();
    return Promise.resolve("0x0202");
  });
  const signTypedData = vi.fn(function (this: { address: `0x${string}` }, parameters: unknown) {
    expect(this.address).toBe(address);
    expect(parameters).toBeDefined();
    return Promise.resolve("0x0303");
  });
  const account = {
    address,
    signMessage,
    signTransaction,
    signTypedData,
    useNetwork: vi.fn().mockResolvedValue(networkAccount),
  };

  cdpMocks.getOrCreateAccount.mockResolvedValue(account);

  return { account, requestFaucet };
}

function mockSmartAccount() {
  const owner = {
    address: OWNER_ADDRESS,
    signMessage: vi.fn().mockResolvedValue("0x01"),
    signTransaction: vi.fn().mockResolvedValue("0x02"),
    signTypedData: vi.fn().mockResolvedValue("0x03"),
    useNetwork: vi.fn(),
  };
  const scoped = {
    signTypedData: vi.fn().mockResolvedValue("0x04"),
    requestFaucet: vi.fn().mockResolvedValue(undefined),
  };
  const smart = {
    address: SMART_ADDRESS,
    useNetwork: vi.fn().mockResolvedValue(scoped),
  };

  cdpMocks.getOrCreateAccount.mockResolvedValue(owner);
  cdpMocks.getOrCreateSmartAccount.mockResolvedValue(smart);

  return { owner, scoped, smart };
}

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

describe("CdpWalletProvider", () => {
  it("bootstraps an EOA wallet and requests testnet ETH when enabled", async () => {
    const { account, requestFaucet } = mockEoaAccount();
    const messagePayload = { message: "hello agent" } as const;
    const transactionPayload = {
      to: "0x4444444444444444444444444444444444444444",
      value: 1n,
      chainId: foundry.id,
      gas: 21_000n,
      nonce: 0,
    } as const;
    const provider = new CdpWalletProvider({
      accountName: "agent",
      mode: "eoa",
      network: "base-sepolia",
      faucet: true,
    });

    const wallet = await provider.bootstrap({
      chain: foundry,
      agentId: 101n,
    });

    expect(cdpMocks.getOrCreateAccount).toHaveBeenCalledWith({ name: "agent" });
    expect(account.useNetwork).toHaveBeenCalledWith("base-sepolia");
    expect(requestFaucet).toHaveBeenCalledWith({ token: "eth" });
    expect(wallet.source).toBe("cdp:eoa");
    expect(wallet.address).toBe(EOA_ADDRESS);
    expect(wallet.account.address).toBe(EOA_ADDRESS);
    expect(wallet.agentId).toBe(101n);
    await expect(wallet.account.signMessage(messagePayload)).resolves.toBe("0x0101");
    expect(account.signMessage).toHaveBeenCalledWith(messagePayload);
    await expect(wallet.account.signTransaction(transactionPayload)).resolves.toBe("0x0202");
    expect(account.signTransaction).toHaveBeenCalledWith(transactionPayload);
    await expect(wallet.account.signTypedData(typedData)).resolves.toBe("0x0303");
    expect(account.signTypedData).toHaveBeenCalledWith(typedData);
  });

  it("bootstraps a smart wallet with scoped typed-data signing", async () => {
    const { owner, scoped, smart } = mockSmartAccount();
    const provider = new CdpWalletProvider({ accountName: "agent", mode: "smart" });

    const wallet = await provider.bootstrap({
      chain: foundry,
      agentId: 101n,
    });

    expect(cdpMocks.getOrCreateAccount).toHaveBeenCalledWith({ name: "agent-owner" });
    expect(cdpMocks.getOrCreateSmartAccount).toHaveBeenCalledWith({
      name: "agent",
      owner,
    });
    expect(smart.useNetwork).toHaveBeenCalledWith("base-sepolia");
    expect(wallet.source).toBe("cdp:smart");
    await expect(wallet.account.signMessage({ message: "hello" })).rejects.toThrow(
      /signMessage is not supported/,
    );

    await expect(wallet.account.signTypedData(typedData)).resolves.toBe("0x04");
    expect(scoped.signTypedData).toHaveBeenCalledWith(typedData);
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

  it("returns CdpWalletProvider (smart, default) when WALLET_PROVIDER=cdp", () => {
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

  it("accepts CDP_WALLET_MODE=eoa", () => {
    const provider = pickWalletProviderFromEnv({
      WALLET_PROVIDER: "cdp",
      CDP_WALLET_MODE: "eoa",
      VERIFIER_AGENT_ID: "101",
      CDP_API_KEY_ID: "fake",
      CDP_API_KEY_SECRET: "fake",
      CDP_WALLET_SECRET: "fake",
    });
    expect(provider).toBeInstanceOf(CdpWalletProvider);
  });

  it("maps VERIFIER_NETWORK and faucet flag", async () => {
    const { scoped, smart } = mockSmartAccount();
    const provider = pickWalletProviderFromEnv({
      WALLET_PROVIDER: "cdp",
      CDP_WALLET_MODE: "smart",
      VERIFIER_NETWORK: "base",
      CDP_REQUEST_FAUCET: "true",
      CDP_API_KEY_ID: "fake",
      CDP_API_KEY_SECRET: "fake",
      CDP_WALLET_SECRET: "fake",
    });

    await provider.bootstrap({ chain: foundry, agentId: 101n });

    expect(provider).toBeInstanceOf(CdpWalletProvider);
    expect(smart.useNetwork).toHaveBeenCalledWith("base");
    expect(scoped.requestFaucet).toHaveBeenCalledWith({ token: "eth" });
  });

  it("falls back to base-sepolia for an unknown VERIFIER_NETWORK", async () => {
    const { smart } = mockSmartAccount();
    const provider = pickWalletProviderFromEnv({
      WALLET_PROVIDER: "cdp",
      VERIFIER_NETWORK: "mars",
      CDP_API_KEY_ID: "fake",
      CDP_API_KEY_SECRET: "fake",
      CDP_WALLET_SECRET: "fake",
    });

    await provider.bootstrap({ chain: foundry, agentId: 101n });

    expect(provider).toBeInstanceOf(CdpWalletProvider);
    expect(smart.useNetwork).toHaveBeenCalledWith("base-sepolia");
  });

  it("rejects an unknown CDP_WALLET_MODE", () => {
    expect(() =>
      pickWalletProviderFromEnv({
        WALLET_PROVIDER: "cdp",
        CDP_WALLET_MODE: "wat",
        CDP_API_KEY_ID: "fake",
        CDP_API_KEY_SECRET: "fake",
        CDP_WALLET_SECRET: "fake",
      }),
    ).toThrow(/CDP_WALLET_MODE/);
  });

  it("throws on unknown WALLET_PROVIDER", () => {
    expect(() => pickWalletProviderFromEnv({ WALLET_PROVIDER: "wat" })).toThrow(/Unknown/);
  });
});
