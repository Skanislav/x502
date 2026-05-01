import { http, type Account, createWalletClient } from "viem";

import { type OneClawClient, oneClawAccount, pickOneClawFromEnv } from "@x502/shared";

import type { BootstrapOptions, BootstrappedWallet, IWalletProvider } from "./types.js";

/// Wallet backend that delegates all signing to a OneClawClient. The client
/// itself is env-pickable (local mode = envkey-equivalent today, remote mode
/// = stub until the SDK lands). One provider class, one swap point.
export class OneClawWalletProvider implements IWalletProvider {
  constructor(
    private readonly client: OneClawClient,
    private readonly scopeId: string,
  ) {}

  async bootstrap(opts: BootstrapOptions): Promise<BootstrappedWallet> {
    const scope = await this.client.resolveScope(this.scopeId);
    const account = oneClawAccount(this.client, this.scopeId, scope.address);

    const walletClient = createWalletClient({
      account,
      chain: opts.chain,
      transport: http(opts.rpcUrl),
    });

    return {
      account: account as Account,
      walletClient,
      agentId: opts.agentId,
      address: scope.address,
      source: `oneclaw:${scope.kind}`,
    };
  }
}

/// Convenience env-driven boot. Reads `ONECLAW_MODE` (default `local`) +
/// `ONECLAW_SCOPE_ID` (the wallet's stable identifier inside 1claw; in local
/// mode it's the env-var name holding the private key, e.g.
/// `VERIFIER_PRIVATE_KEY` or `COORDINATOR_PRIVATE_KEY`).
export function oneClawProviderFromEnv(
  env: NodeJS.ProcessEnv,
  defaultScopeId: string,
): OneClawWalletProvider {
  const client = pickOneClawFromEnv(env);
  const scopeId = env.ONECLAW_SCOPE_ID ?? defaultScopeId;
  return new OneClawWalletProvider(client, scopeId);
}
