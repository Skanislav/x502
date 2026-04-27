import type { Hex } from "viem";

import { repoIdFromSlug } from "@x502/shared";
import type { IRepoRegistry } from "../providers.js";

/// Static in-memory registry. v2 could read from the vault contract or a config
/// file; for now, the operator hand-registers repos at boot.
export class StaticRepoRegistry implements IRepoRegistry {
  private readonly bySlug = new Map<
    string,
    { repoId: Hex; threshold: number; trustedAgentIds: bigint[] }
  >();
  private readonly byRepoId = new Map<Hex, string>();

  add(slug: string, threshold: number, trustedAgentIds: bigint[]): Hex {
    const repoId = repoIdFromSlug(slug);
    this.bySlug.set(slug, { repoId, threshold, trustedAgentIds });
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
