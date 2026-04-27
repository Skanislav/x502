import type { Hex } from "viem";

export function formatUsdc(amount: bigint): string {
  const dollars = amount / 1_000_000n;
  const cents = (amount % 1_000_000n) / 10_000n;
  return `$${dollars}.${cents.toString().padStart(2, "0")}`;
}

export function shortHash(h: Hex | string): string {
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export function basescanTx(txHash: Hex, chainId = 84532): string {
  if (chainId === 8453) return `https://basescan.org/tx/${txHash}`;
  return `https://sepolia.basescan.org/tx/${txHash}`;
}
