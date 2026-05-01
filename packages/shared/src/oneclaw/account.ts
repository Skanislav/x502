import type {
  LocalAccount,
  SignableMessage,
  TransactionSerializable,
  TypedDataDefinition,
} from "viem";
import { toAccount } from "viem/accounts";

import type { OneClawClient } from "./client.js";

/// Builds a viem `LocalAccount` whose signing operations delegate to a
/// OneClawClient scope. Used by the verifier-agent wallet provider AND the
/// coordinator's submitter — the only difference between callers is the
/// scopeId.
///
/// viem's signMessage/signTypedData are parametric over types we don't want
/// to mirror in the OneClawClient interface; the runtime payload shapes are
/// equivalent, so we narrow at this seam.
export function oneClawAccount(
  client: OneClawClient,
  scopeId: string,
  address: `0x${string}`,
): LocalAccount {
  return toAccount({
    address,
    signMessage: ({ message }: { message: SignableMessage }) =>
      client.signMessage(scopeId, { message: normalizeSignableMessage(message) }),
    signTransaction: (tx: TransactionSerializable) => client.signTransaction(scopeId, tx),
    signTypedData: (typedData) => client.signTypedData(scopeId, typedData as TypedDataDefinition),
  });
}

function normalizeSignableMessage(message: SignableMessage): string | { raw: `0x${string}` } {
  if (typeof message === "string") return message;
  if ("raw" in message) {
    if (typeof message.raw === "string") return { raw: message.raw };
    return { raw: bytesToHex(message.raw) };
  }
  return JSON.stringify(message);
}

function bytesToHex(b: Uint8Array): `0x${string}` {
  let s = "0x";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s as `0x${string}`;
}
