import type { Address, Hex } from "viem";

import { repoIdFromSlug } from "@x502/shared";
import type { IRepoRegistry } from "../providers.js";

/// Static in-memory registry. v2 could read from the vault contract or a config
/// file; for now, the operator hand-registers repos at boot.
export class StaticRepoRegistry implements IRepoRegistry {
  private readonly bySlug = new Map<
    string,
    {
      repoId: Hex;
      threshold: number;
      trustedAgentIds: bigint[];
      trustedAttesters: Address[];
    }
  >();
  private readonly byRepoId = new Map<Hex, string>();

  add(
    slug: string,
    threshold: number,
    trustedAgentIds: bigint[],
    trustedAttesters: Address[],
  ): Hex {
    if (trustedAgentIds.length !== trustedAttesters.length) {
      throw new Error(
        `StaticRepoRegistry.add: trustedAgentIds (${trustedAgentIds.length}) and trustedAttesters (${trustedAttesters.length}) must be the same length`,
      );
    }
    const repoId = repoIdFromSlug(slug);
    this.bySlug.set(slug, { repoId, threshold, trustedAgentIds, trustedAttesters });
    this.byRepoId.set(repoId, slug);
    return repoId;
  }

  resolve(slug: string) {
    return this.bySlug.get(slug);
  }

  resolveSlug(repoId: Hex) {
    return this.byRepoId.get(repoId);
  }
}
