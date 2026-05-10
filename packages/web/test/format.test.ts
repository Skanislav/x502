import { describe, expect, test } from "vitest";
import { basescanTx, formatUsdc, shortHash } from "../lib/format";

describe("formatUsdc", () => {
  test.each([
    [0n, "$0.00"],
    [1n, "$0.000001"],
    [1_000n, "$0.001"], // per-verifier outcome fee
    [10_000n, "$0.01"],
    [20_000n, "$0.02"], // triage bounty
    [49_000n, "$0.049"], // report claimant amount after fee
    [50_000n, "$0.05"], // report bounty
    [1_000_000n, "$1.00"],
    [1_234_567n, "$1.234567"],
    [123_456_789_000_000n, "$123456789.00"],
  ])("formats %s as %s", (amount, expected) => {
    expect(formatUsdc(amount)).toBe(expected);
  });

  test("renders negative amounts with leading minus", () => {
    expect(formatUsdc(-49_000n)).toBe("-$0.049");
  });
});

describe("shortHash", () => {
  test("leaves short hashes unchanged", () => {
    expect(shortHash("0x1234")).toBe("0x1234");
  });

  test("shortens long hashes", () => {
    expect(shortHash(`0x${"ab".repeat(32)}`)).toBe("0xababab…ababab");
  });
});

describe("basescanTx", () => {
  const txHash = `0x${"12".repeat(32)}` as const;

  test("uses Base Sepolia by default", () => {
    expect(basescanTx(txHash)).toBe(`https://sepolia.basescan.org/tx/${txHash}`);
  });

  test("uses Base mainnet for chainId 8453", () => {
    expect(basescanTx(txHash, 8453)).toBe(`https://basescan.org/tx/${txHash}`);
  });
});
