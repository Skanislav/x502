---
name: x502-verify
description: Use when the user wants to verify pending x502 bounty claims as one of the trusted verifier identities. Fetches pending claims from the local coordinator, evaluates each against the kind-specific rubric below using GitHub context, signs an EIP-712 attestation with the verifier's wallet, and POSTs it back. The coordinator collects M-of-N attestations and submits the on-chain payout. Triggered by phrases like "verify x502 claims", "/x502-verify", or "act as verifier 101".
---

# x502 verifier skill

You are a verifier agent in the x502 bounty protocol. The user is running you on
their machine as one of the trusted verifier identities for some repo. Your
job: find pending claims, decide accept/reject against the rubric, sign +
push to the coordinator. Auto-approve when the rubric clearly passes; reject
otherwise — there is no human approval gate for this skill.

## Inputs

The user will tell you (or it's already in env / `demo/.runtime/addresses.json`):

- **agent id** — the verifier identity you're acting as (e.g. `101`, `102`, `103`)
- **scope id** — env-var name holding the verifier's private key in 1claw
  local mode (e.g. `VERIFIER_101_PRIVATE_KEY`). Conventionally the demo's
  run-stack sets it as `VERIFIER_<agentId>_PRIVATE_KEY`.
- **coordinator URL** — defaults to `http://127.0.0.1:8787`
- **vault address** + **chain id** — read from `demo/.runtime/addresses.json`
  in the local demo, or whatever the operator gave you
- (optional) **smart-wallet config** — if this verifier is registered as a
  counterfactual ERC-1271 wallet, the user passes the wallet address +
  factory + factoryCalldata. The demo writes these into addresses.json under
  `verifiers[i].smartWallet`.

If anything is unclear, ask the user once before proceeding.

## Procedure

1. **List pending claims for this agent.**
   ```bash
   tsx demo/scripts/x502.ts pending \
     --coordinator <URL> --agent-id <ID>
   ```
   Output is JSON: `{ agentId, pending: [{ claimId, repoSlug, externalId,
   kind, recipient, deadline, factHash, agentIdReveal?, saltReveal? }, ...] }`.

   If `pending` is empty, tell the user "no pending claims" and stop.

2. **For each pending claim:**

   a. **Fetch the GitHub context.** Use the `Bash` tool with `gh` CLI (the
      operator has it authenticated). For `kind ∈ {0=report, 1=triage}` fetch
      the issue:
      ```bash
      gh issue view <externalId> --repo <repoSlug> --json title,body,state,labels,author
      ```
      For `kind ∈ {2=fix, 3=docs_tests}` fetch the PR + its files:
      ```bash
      gh pr view <externalId> --repo <repoSlug> --json title,body,state,merged,baseRefName,labels,author
      gh pr diff <externalId> --repo <repoSlug> --name-only
      ```

   b. **Apply the rubric.** Decide accept/reject.

      - **report** (kind=0): Accept iff the issue exists, is novel
        (not duplicate/wontfix/invalid label), and the body has clear repro
        steps. Reject vague/empty bodies.
      - **triage** (kind=1): Accept iff at least 2 substantive labels are
        applied AND the issue body or comments have repro/dedup details.
        Drive-by labels do not qualify.
      - **fix** (kind=2): Accept iff the PR is merged into the default
        branch AND the body explicitly closes a linked issue
        (`Fixes #N` / `Closes #N` / `Resolves #N`). Diff must touch real
        code (not just comments/whitespace).
      - **docs_tests** (kind=3): Accept iff the PR is merged AND the diff
        meaningfully fills a doc gap or adds missing tests. Reject churn
        with no behavior change.

   c. **Verify the commitment binding** (when `agentIdReveal` and
      `saltReveal` are present):
      - Compute the expected commitment:
        `keccak256(abi.encode(uint256 agentIdReveal, bytes32 repoId,
          uint256 externalId, bytes32 saltReveal))`
        where `repoId = keccak256("github.com/" + repoSlug)`.
      - Search the issue/PR body for `<!-- x502-commitment:0xHASH -->` and
        check it equals the expected commitment.
      - Also check `<!-- x502:0xRECIPIENT -->` matches the claim's recipient.
      - If commitment is missing or wrong, reject with reason
        `"commitment binding failed"`.

   d. **If accept**, push the attestation:
      ```bash
      tsx demo/scripts/x502.ts attest \
        --coordinator <URL> --agent-id <ID> --scope-id <ENV_VAR_NAME> \
        --claim-id <claimId> --recipient <recipient> \
        --deadline <deadline> --fact-hash <factHash> \
        --vault <vaultAddress> --chain-id <chainId> \
        [--smart-wallet 0x... --smart-factory 0x... --smart-calldata 0x...]
      ```
      Print the response so the user can see whether the push was
      accepted (`status=200`, `accepted=true`) or rejected (`409` with a
      reason).

   e. **If reject**, just tell the user *why* — there's nothing to push.
      The coordinator times out the claim if it doesn't get threshold
      sigs.

3. After processing all pending claims, summarize what you did:
   - N claims accepted + signed
   - N claims rejected (with reasons)

## Trust + safety

- The vault re-validates every signature on chain via
  `ERC6492SignatureChecker.isValidSig`. An invalid sig only wastes its
  submitter's gas; it can't drain the vault.
- You only ever sign attestations whose `factHash` matches what the
  coordinator already received from the Chainlink Functions DON. The
  coordinator rejects pushes with mismatched `factHash`, so you can't
  accidentally sign over the wrong fact.
- Every push is dedup'd by `agentId` per claim. Re-running this skill on
  the same pending list is safe.
- This skill is auto-approve: once the rubric passes you push without
  asking. Do NOT ask "should I sign?" — apply the rubric and act. If you
  are uncertain about a claim, reject it.

## Where things live

- Coordinator runtime config (chain id, vault, factory): `demo/.runtime/addresses.json`
- Verifier private keys (local mode): env vars named `VERIFIER_<agentId>_PRIVATE_KEY`
- Skill helper: `demo/scripts/x502.ts`
- Vault Solidity (ground truth for sig validation): `contracts/src/BountyVault.sol`
- DON rules (what `factHash` certifies): `chainlink/source-core.js`
