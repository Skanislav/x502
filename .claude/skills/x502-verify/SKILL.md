---
name: x502-verify
description: Use when the user wants to verify pending x502 bounty claims as one of the trusted verifier identities. Fetches pending claims from the local coordinator, evaluates each against the kind-specific rubric below using GitHub context, publishes an EAS attestation under the x502 schema with (claimId, factHash, accept), and lets the coordinator's EAS watcher pick it up. Triggered by phrases like "verify x502 claims", "/x502-verify", or "act as verifier 101".
---

# x502 verifier skill

You are a verifier agent in the x502 bounty protocol. The user is running you
on their machine as one of the trusted verifier identities for some repo.
Your job: find pending claims, decide accept/reject against the rubric,
publish an EAS attestation. Auto-approve when the rubric clearly passes;
reject otherwise — there is no human approval gate for this skill.

## Inputs

The user will tell you (or it's already in env / `demo/.runtime/addresses.json`):

- **agent id** — the verifier identity you're acting as (e.g. `101`, `102`, `103`)
- **scope id** — env-var name holding the verifier's private key in 1claw
  local mode (e.g. `VERIFIER_101_PRIVATE_KEY`). Convention: the demo's
  run-stack sets `VERIFIER_<agentId>_PRIVATE_KEY`.
- **coordinator URL** — defaults to `$X502_COORDINATOR` or `http://127.0.0.1:8787`
- **rpc url** — chain RPC the verifier writes to. Defaults to anvil.
- **EAS address** — `$X502_EAS`. The demo's run-stack writes this from
  addresses.json. On Base / Base Sepolia, the canonical predeploy is
  `0x4200000000000000000000000000000000000021`.
- **schema UID** — `$X502_SCHEMA_UID`. The vault rejects attestations
  under any other schema.

If anything is unclear, ask the user once before proceeding.

## Procedure

1. **List pending claims for this agent.**
   ```bash
   tsx demo/scripts/x502.ts pending \
     --coordinator $X502_COORDINATOR --agent-id <ID>
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
      - Compute `keccak256(abi.encode(uint256 agentIdReveal, bytes32 repoId,
        uint256 externalId, bytes32 saltReveal))` where
        `repoId = keccak256("github.com/" + repoSlug)`.
      - Search the issue/PR body for `<!-- x502-commitment:0xHASH -->` and
        check it equals the expected commitment.
      - Also check `<!-- x502:0xRECIPIENT -->` matches the claim's recipient.
      - If commitment is missing or wrong, reject with reason
        `"commitment binding failed"`.

   d. **If accept**, publish the attestation:
      ```bash
      tsx demo/scripts/x502.ts attest \
        --rpc $RPC_URL --eas $X502_EAS --schema $X502_SCHEMA_UID \
        --scope-id <ENV_VAR_NAME> --chain-id $X502_CHAIN_ID \
        --claim-id <claimId> --fact-hash <factHash>
      ```
      Output is JSON: `{ uid, txHash, accept: true, attester: 0x... }`.
      The coordinator's EAS watcher observes the on-chain Attested event
      and threads this attestation into the pending payout. Once threshold
      attestations exist, the coordinator submits vault.payout.

   e. **If reject**, just tell the user *why* — there's nothing to publish.
      The coordinator times out the claim if it doesn't get threshold
      attestations.

3. After processing all pending claims, summarize:
   - N claims accepted + attested (with UIDs)
   - N claims rejected (with reasons)

## Trust + safety

- The vault re-validates every EAS attestation on chain via
  `IEAS.getAttestation(uid)`: schema match, not revoked, not expired,
  data decodes to (claimId, factHash, accept=true), attester is in the
  repo's trusted set, dedup. An invalid attestation only wastes its
  publisher's gas; it can't drain the vault.
- You only attest with the `factHash` the coordinator already received
  from the Chainlink Functions DON, so you can't accidentally bind to
  the wrong fact.
- Each EAS attestation is one transaction. Attesting twice for the same
  claim is wasted gas (vault dedups by attester address).
- This skill is auto-approve: once the rubric passes you publish without
  asking. Do NOT prompt "should I attest?" — apply the rubric and act.
  If you are uncertain about a claim, reject it.

## Where things live

- Coordinator runtime config (chain id, vault, EAS, schema): `demo/.runtime/addresses.json`
- Verifier private keys (local mode): env vars named `VERIFIER_<agentId>_PRIVATE_KEY`
- Skill helper: `demo/scripts/x502.ts`
- Vault Solidity: `contracts/src/BountyVault.sol`
- DON rules: `chainlink/source-core.js`
- EAS predeploy on Base / Base Sepolia: `0x4200000000000000000000000000000000000021`
