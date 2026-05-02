import type { Address, Hex, TransactionSerializable, TypedDataDefinition } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/// 1claw is the canonical custody + secrets surface for x502.
///
/// All wallet keys (verifier signers, coordinator submitter) and out-of-band
/// secrets (ANTHROPIC_API_KEY, GITHUB_TOKEN) sit behind this interface. Two
/// modes:
///
///   - `local` — reads private keys / secrets from environment variables.
///     Used by tests, CI, and the local demo. Behaves identically to the
///     legacy envkey provider.
///
///   - `remote` — calls the 1claw service. NOT YET WIRED. The interface below
///     is the contract the SDK has to satisfy; when the SDK lands, replace
///     `notImplementedRemote` with a real implementation and the rest of the
///     codebase keeps working.
///
/// Shape notes for the eventual remote implementation:
///   - `kind = "smart"` returns ERC-1271 signatures from `signTypedData`. The
///     vault accepts these via `SignatureChecker.isValidSignatureNow`.
///   - For undeployed (counterfactual) smart accounts, wrap the inner ERC-1271
///     sig with the EIP-6492 magic suffix:
///         `abi.encode(factory, factoryCalldata, innerSig) || 0x6492…6492`
///     The vault's `ERC6492SignatureChecker` deploys via the factory then
///     verifies — first claim from a fresh wallet "just works".
///   - `signTransaction` returns a fully signed raw tx. Smart-account mode
///     should reject this and expose `sendUserOperation` instead (TODO).

export type OneClawAccountKind = "eoa" | "smart";

export interface OneClawScope {
  /// Stable identifier the 1claw service uses to look up custody. The SDK
  /// decides the format; the local mode treats this as a private key alias.
  scopeId: string;
  kind: OneClawAccountKind;
  address: Address;
}

export interface OneClawClient {
  /// Resolves a scope to its current on-chain address + kind. Cheap; cache.
  resolveScope(scopeId: string): Promise<OneClawScope>;
  /// EIP-712 sign. For smart accounts this returns an ERC-1271 wrapped sig.
  signTypedData(scopeId: string, typedData: TypedDataDefinition): Promise<Hex>;
  /// EIP-191 personal_sign. Currently unused by the codebase but part of the
  /// contract because consumers' viem Account interface needs it.
  signMessage(scopeId: string, message: { message: string | { raw: Hex } }): Promise<Hex>;
  /// Returns a fully signed raw tx for EOA scopes. Throws for smart accounts
  /// — those go through `sendUserOperation` (not implemented yet).
  signTransaction(scopeId: string, tx: TransactionSerializable): Promise<Hex>;
  /// Out-of-band secrets (ANTHROPIC_API_KEY, GITHUB_TOKEN, ...). The local
  /// implementation reads from process env; the remote implementation pulls
  /// from 1claw's secret store.
  getSecret(name: string): Promise<string | undefined>;
}

export interface OneClawConfig {
  mode: "local" | "remote";
  /// Remote mode only: 1claw service endpoint + auth.
  endpoint?: string;
  apiKey?: string;
}

/// `local` mode: every scopeId is "<env-var-name>" and the underlying key is
/// read from that env var when first used. Secrets are read directly from env.
export function localOneClaw(env: NodeJS.ProcessEnv = process.env): OneClawClient {
  const accountFor = (scopeId: string) => {
    const pk = env[scopeId];
    if (!pk || !pk.startsWith("0x")) {
      throw new Error(
        `OneClaw(local): scopeId="${scopeId}" not bound — set ${scopeId}=0x... in env`,
      );
    }
    return privateKeyToAccount(pk as Hex);
  };

  return {
    async resolveScope(scopeId) {
      const acc = accountFor(scopeId);
      return { scopeId, kind: "eoa", address: acc.address };
    },
    async signTypedData(scopeId, typedData) {
      return accountFor(scopeId).signTypedData(typedData);
    },
    async signMessage(scopeId, message) {
      return accountFor(scopeId).signMessage(message);
    },
    async signTransaction(scopeId, tx) {
      return accountFor(scopeId).signTransaction(tx);
    },
    async getSecret(name) {
      return env[name];
    },
  };
}

/// `remote` mode stub. Throws on every operation. Replace with the 1claw SDK
/// once credentials + package are available — the rest of the codebase calls
/// only through the OneClawClient interface, so no other call sites change.
export function remoteOneClawStub(_cfg: OneClawConfig): OneClawClient {
  const reject = (op: string) => {
    throw new Error(
      `OneClaw(remote).${op} not yet wired — see packages/shared/src/oneclaw/client.ts. Set ONECLAW_MODE=local (envkey-equivalent) until the SDK is integrated.`,
    );
  };
  return {
    async resolveScope() {
      return reject("resolveScope");
    },
    async signTypedData() {
      return reject("signTypedData");
    },
    async signMessage() {
      return reject("signMessage");
    },
    async signTransaction() {
      return reject("signTransaction");
    },
    async getSecret() {
      return reject("getSecret");
    },
  };
}

/// Single env-driven entry point. Defaults to `local` so the demo + tests
/// keep working without configuration.
export function pickOneClawFromEnv(env: NodeJS.ProcessEnv = process.env): OneClawClient {
  const mode = (env.ONECLAW_MODE ?? "local").toLowerCase();
  if (mode === "local") return localOneClaw(env);
  if (mode === "remote") {
    return remoteOneClawStub({
      mode: "remote",
      endpoint: env.ONECLAW_ENDPOINT,
      apiKey: env.ONECLAW_API_KEY,
    });
  }
  throw new Error(`Unknown ONECLAW_MODE=${mode}; expected "local" or "remote"`);
}
