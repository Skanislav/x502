import { oneClawProviderFromEnv } from "./oneclaw.js";
import type { IWalletProvider } from "./types.js";

export * from "./types.js";
export { OneClawWalletProvider, oneClawProviderFromEnv } from "./oneclaw.js";

/// Picks a wallet backend from environment. There is exactly one provider
/// today — `OneClawWalletProvider` — backed by `pickOneClawFromEnv` (local
/// mode = envkey-equivalent, remote mode = stubbed 1claw service).
///
/// Env:
///   ONECLAW_MODE       local (default) | remote
///   ONECLAW_SCOPE_ID   wallet identifier inside 1claw. In local mode it's
///                      the name of the env var holding the private key
///                      (defaults to VERIFIER_PRIVATE_KEY).
export function pickWalletProviderFromEnv(env: NodeJS.ProcessEnv = process.env): IWalletProvider {
  return oneClawProviderFromEnv(env, "VERIFIER_PRIVATE_KEY");
}
