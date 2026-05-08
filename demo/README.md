# x502 demo

A tiny self-contained project (`tip-pool helpers`) used as the live subject for
the x502 protocol demo. It has **four planted defects**, one for each bounty
`kind`:

| Kind          | Where it lives                  | What's wrong                                                |
|---------------|---------------------------------|-------------------------------------------------------------|
| `report`      | `src/split.ts`                  | Off-by-remainder bug in `splitEvenly`. Reporter calls it out. |
| `triage`      | (added by the triager on GitHub) | The `report` issue needs `bug` + `accepted` labels + a repro link. |
| `fix`         | `src/split.ts`                  | The PR replaces `splitEvenly` with `fix/split.fixed.ts`.     |
| `docs_tests`  | `test/split.test.ts` + `docs/README.md` | Same PR adds the missing remainder test + corrects the stale `divideEvenly` reference in `docs/README.md` to `splitEvenly`. |

Each defect has a configured price on the `BountyVault` contract:

| Kind         | Default demo price |
|--------------|-------------------:|
| `report`     | 0.05 USDC          |
| `triage`     | 0.02 USDC          |
| `fix`        | 0.50 USDC          |
| `docs_tests` | 0.30 USDC          |

Verifier outcome fee (per attesting agent, deducted from the bounty) is
**0.001 USDC**.

## Run it (Base Sepolia)

```sh
pnpm demo                              # boots seed + coordinator + web (Base Sepolia)
source demo/scripts/skill-env.sh       # exports VERIFIER_<id>_PRIVATE_KEY + X502_*
claude                                 # opens Claude Code
> /x502-verify as agent 5260           # publishes an EAS attestation
```

`pnpm demo` boots:
- **seed.ts** writes `demo/.runtime/addresses.json` from `.env` + the
  documented Base Sepolia constants in `docs/runbook-base-sepolia.md`. No
  on-chain deploys — the vault, fact receiver, EAS, and SchemaRegistry are
  the real live contracts.
- **coordinator** wired to the live `BountyVault`; submits the on-chain
  payout once the trusted verifier's EAS attestation is observed.
- **Next.js web** at `http://127.0.0.1:3000/?mode=demo`.

There are no long-running verifier processes. The verifier identity is a
human running `/x502-verify` in their own Claude Code session — the skill
(`.claude/skills/x502-verify/SKILL.md`) applies the rubric and calls
`EAS.attest` via `demo/scripts/x502.ts`.

The `.env` must have funded keys. The runbook in
`docs/runbook-base-sepolia.md` lists the prerequisites (LINK on Chainlink
subscription, Base Sepolia ETH on the coordinator and verifier wallets,
USDC on the deployer wallet).

## Production deploy

Pre-seed (Base Sepolia):
1. **Register the x502 schema** in EAS — once per chain.
   ```sh
   tsx demo/scripts/eas-register.ts \
     --rpc $BASE_SEPOLIA_RPC_URL --scope-id DEPLOYER_PRIVATE_KEY
   ```
   Prints `{ uid }`. Capture it for the next step.

2. **Deploy the vault + fact receiver.**
   ```sh
   X502_SCHEMA_UID=0x... forge script script/Deploy.s.sol \
     --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
   ```
3. Repo owner calls `BountyVault.configureRepo` for `skanislav/x502` with the
   trusted ERC-8004 agent IDs and the per-kind prices above, then deposits
   USDC.
4. Verifier identities (the wallets registered in ERC-8004) are humans
   driving `/x502-verify`. The coordinator runs with the vault + EAS +
   schema env vars and submits payouts as attestations come in.

Then, for each kind:

### 1. `report` — file the planted bug

The reporter (Alice's wallet) derives her commitment for issue #N:

```sh
tsx demo/scripts/derive-commitment.ts \
  --agent-id <Alice's ERC-8004 ID> \
  --repo skanislav/x502 \
  --external-id <issue number after filing> \
  --salt 0x000000000000000000000000000000000000000000000000000000000000beef
```

Then files an issue on `skanislav/x502` with body:

```markdown
`splitEvenly(10, 3)` returns `[3, 3, 3]` (sum 9) — the function loses the
remainder when `total % n != 0`. Repro: `splitEvenly(10, 3).reduce((a,b) => a+b) === 9`.
Expected: sum equals input `total` for any non-negative integer inputs.

<!-- x502-commitment:0x... -->
<!-- x502:0xALICE_WALLET -->
```

The `x502-commitment` marker binds the GH author to her ERC-8004 agent id;
the `x502:0xWALLET` marker is what the DON parses into the fact's
`ghAuthorBinding`. The vault rejects payouts whose `recipient` doesn't
match that binding (`RecipientNotBound`), so both markers are required —
the same pair of lines for `triage`, `fix`, and `docs_tests`.

Alice then claims:

```sh
curl -X POST https://coordinator.x502.localhost/claim \
  -H 'content-type: application/json' \
  -H 'X-PAYMENT: <x402-fetch settled by alice's wallet>' \
  -d '{
    "repoSlug": "skanislav/x502",
    "externalId": "<issue number>",
    "kind": "report",
    "recipient": "<Alice's wallet>",
    "agentIdReveal": "<Alice's ERC-8004 ID>",
    "saltReveal": "0x...beef"
  }'
```

Coordinator returns `{ claimId, pollUrl }`. Alice polls until 200 → tx hash.
Onchain: Alice receives `0.05 - 0.002 = 0.048 USDC`; each of the 2 signing
verifiers receives `0.001 USDC`.

### 2. `triage` — accept + label the issue

Bob (a triager) adds `bug` + `accepted` labels and a repro comment to the
same issue, then files a `kind=triage` claim using his own commitment. The
DON's `source.js` checks for ≥2 labels; the verifier agents check that the
labels look substantive.

### 3. `fix` — merge the fix PR

The fixer (Carol) opens a PR against `skanislav/x502` that:
- replaces `demo/src/split.ts` with `demo/fix/split.fixed.ts`
- replaces `demo/test/split.test.ts` with `demo/fix/split.fixed.test.ts`
- replaces `demo/docs/README.md` with `demo/fix/README.fixed.md`

PR body must contain `Fixes #<issue_number>` (so the DON's `source.js` link
check passes) and a commitment line matching Carol's wallet.

After the PR is merged on the default branch, Carol files a `kind=fix` claim
referencing the PR number. She receives `0.50 - 0.002 = 0.498 USDC`.

### 4. `docs_tests` — same PR, second bounty

Carol's PR also touches `demo/test/` and `demo/docs/`, so once it's merged
she can ALSO file `kind=docs_tests` against the same PR number. The DON
checks that merged files include test/ or docs/ paths; verifier agents
check substance. Carol receives `0.30 - 0.002 = 0.298 USDC`.

(`claimId = keccak256(repoId, externalId, kind)` — different kinds
produce different `claimId`s for the same external PR, so the vault's
one-shot fuse doesn't collide.)

## Why the GH-body commitment

The vault doesn't know whether the wallet making the claim corresponds to
the GH user who authored the issue/PR. Without a binding, anyone could
front-run a claim by spotting a popular issue on a watched repo.

Solution: the GH author publishes
`commitment = keccak256(agentId || repoId || externalId || salt)` in the
issue/PR body as `<!-- x502-commitment:0x... -->`. At claim time, the
claimant reveals `(agentId, salt)` and the verifier agent's `ClaudePolicy`
recomputes the commitment and rejects if it doesn't match. Since the
agentId resolves to a wallet via the ERC-8004 IdentityRegistry, the binding
is wallet-bound without OAuth.
