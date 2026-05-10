import type { Hex } from "viem";

/// Renders a USDC amount (6-decimal native units) as a `$X.YY…` string.
///
/// USDC has 6 decimals on chain, so the per-verifier outcome fee
/// (`1_000n` = `0.001 USDC`) lived below the cent boundary. The previous
/// implementation truncated to cents and rendered that fee as `$0.00`,
/// hiding it from the demo's payout breakdown. We now preserve up to
/// native precision while trimming trailing zeros past the second decimal,
/// so `0.05` still reads as `$0.05` (not `$0.050000`) but `0.001`
/// renders honestly as `$0.001`.
export function formatUsdc(amount: bigint): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const dollars = abs / 1_000_000n;
  const fraction = abs % 1_000_000n;
  let frac = fraction.toString().padStart(6, "0");
  // trim trailing zeros, but keep ≥2 digits so whole-cent amounts stay $X.YY
  frac = frac.replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${negative ? "-" : ""}$${dollars}.${frac}`;
}

export function shortHash(h: Hex | string): string {
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export function basescanTx(txHash: Hex, chainId = 84532): string {
  if (chainId === 8453) return `https://basescan.org/tx/${txHash}`;
  return `https://sepolia.basescan.org/tx/${txHash}`;
}
