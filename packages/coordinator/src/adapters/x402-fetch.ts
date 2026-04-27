import type { Account, WalletClient } from "viem";
import { wrapFetchWithPayment } from "x402-fetch";

/// Wraps `globalThis.fetch` with x402 client-side payment handling. Hand the
/// returned function to a `FetchVerifierClient` to make the coordinator
/// auto-settle the verifier endpoint's 402 response.
///
/// `walletClient` must be a viem WalletClient with an EIP-3009-capable USDC
/// account; on Base Sepolia / Base mainnet, EIP-3009 is built into Circle USDC.
export function buildX402Fetch(walletClient: WalletClient & { account: Account }): typeof fetch {
  // x402-fetch's signer type is structurally compatible with viem's WalletClient.
  return wrapFetchWithPayment(globalThis.fetch, walletClient as never) as typeof fetch;
}
