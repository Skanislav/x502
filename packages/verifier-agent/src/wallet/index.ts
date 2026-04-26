import type { Hex } from "viem";

import { CdpWalletProvider } from "./cdp.js";
import { EnvKeyWalletProvider } from "./env-key.js";
import type { IWalletProvider } from "./types.js";

export * from "./types.js";
export { EnvKeyWalletProvider } from "./env-key.js";
export { CdpWalletProvider } from "./cdp.js";

/// Picks a wallet backend from environment. `WALLET_PROVIDER` selects:
/// - `envkey` (default) — reads VERIFIER_PRIVATE_KEY
/// - `cdp` — bootstraps a Coinbase-managed EVM EOA, idempotent by
///   VERIFIER_AGENT_NAME (defaults to `x502-verifier-${VERIFIER_AGENT_ID}`)
export function pickWalletProviderFromEnv(env: NodeJS.ProcessEnv = process.env): IWalletProvider {
  const choice = (env.WALLET_PROVIDER ?? "envkey").toLowerCase();
  switch (choice) {
    case "envkey": {
      const pk = env.VERIFIER_PRIVATE_KEY;
      if (!pk || !pk.startsWith("0x")) {
        throw new Error("WALLET_PROVIDER=envkey requires VERIFIER_PRIVATE_KEY (0x-hex) in env");
      }
      return new EnvKeyWalletProvider(pk as Hex);
    }
    case "cdp": {
      const agentId = env.VERIFIER_AGENT_ID ?? "0";
      const accountName = env.VERIFIER_AGENT_NAME ?? `x502-verifier-${agentId}`;
      return new CdpWalletProvider({
        apiKeyId: env.CDP_API_KEY_ID,
        apiKeySecret: env.CDP_API_KEY_SECRET,
        walletSecret: env.CDP_WALLET_SECRET,
        accountName,
        network:
          env.VERIFIER_NETWORK === "base"
            ? "base"
            : env.VERIFIER_NETWORK === "ethereum-sepolia"
              ? "ethereum-sepolia"
              : "base-sepolia",
        faucet: env.CDP_REQUEST_FAUCET === "true",
      });
    }
    default:
      throw new Error(`Unknown WALLET_PROVIDER=${choice}; expected "envkey" or "cdp"`);
  }
}
