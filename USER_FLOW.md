# x502 — End-to-End User Flow

A walkthrough of the system from the perspective of the people using it. Follow a single bug from "I noticed something" → "USDC in my wallet."

> **Scope:** this doc describes the **currently-implemented behavior** as of commit `0476864` (post PR #3 merge). Where current code diverges from the design intent stated in [`demo/README.md`](demo/README.md), this doc says so explicitly with a "**Current vs. intent**" callout. Do not read aspirational prose into sections without that callout.

For the contract surface see [`contracts/src/BountyVault.sol`](contracts/src/BountyVault.sol).

---

## The cast

| Actor | Role | Wallet | ERC-8004 ID |
|---|---|---|---|
| **Repo Owner** (Skanislav) | Funds the bounty pool, picks trusted verifiers | EOA | n/a |
| **Verifier-Agent operators (×3)** | Run AI judges that sign attestations | EOA *or* Coinbase Smart Wallet | 101, 102, 103 |
| **Alice** (Reporter) | Files the bug | EOA | her own |
| **Bob** (Triager) | Labels & dedup-links the issue | EOA | his own |
| **Carol** (Fixer) | Opens the PR that fixes it | EOA | 103 (in the demo) |

---

## Phase 0 — One-time setup (Repo Owner)

### Step 0.1 — Deploy contracts

```sh
cd contracts && forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
```

This runs [`contracts/script/Deploy.s.sol`](contracts/script/Deploy.s.sol):

1. Deploys **`GitHubFactReceiver`** with the Chainlink Functions Router address hardcoded for Base Sepolia (`0xf9B8...B278`) and uploads `chainlink/source.js` as the inline JavaScript the DON will execute.
2. Deploys **`BountyVault`** wired to:
   - **USDC** at `0x036C...CF7e` (the canonical Base Sepolia testnet USDC),
   - **ERC-8004 Identity Registry** at `0x8004...BD9e` (the canonical "AI agent identity" registry),
   - the just-deployed `GitHubFactReceiver` as the fact provider.

3. **Manual follow-up** (not run by the script — it only prints the command at [`Deploy.s.sol:75-78`](contracts/script/Deploy.s.sol)): add the `GitHubFactReceiver` as a consumer of your funded Chainlink Functions subscription:

   ```sh
   npx @chainlink/functions-toolkit subscription add-consumer \
     --subId  $CHAINLINK_SUBSCRIPTION_ID \
     --consumer  <GitHubFactReceiver address>
   ```

   Without this step, every `requestFact` call will revert at the Functions Router with `OnlySubscriptionOwner` / unauthorized-consumer errors.

4. **Manual follow-up** (also not run by the script): upload the GitHub PAT as a DON-hosted secret and call `factReceiver.setConfig(...)` again with the resulting `secretsVersion` so the fact source has API-rate headroom. See [`@chainlink/functions-toolkit` docs](https://github.com/smartcontractkit/functions-toolkit).

> **Insight**
> - The `Deploy.s.sol` script is **chain-bound** — those four addresses are hardcoded. To deploy on a different chain you'd need to swap them. This is intentional: testnet demos shouldn't accidentally go to mainnet.
> - The `GitHubFactReceiver` is a **separate contract** from the vault. This separation lets the protocol swap fact providers (a different oracle, a manual provider for testing) without redeploying the vault. The vault only knows the `IGitHubFactProvider` interface.
> - The DON-hosted secret (the GitHub PAT) lifts the rate limit from 60 req/h → 5k/h. Without the secret, public GitHub API would throttle hard during a demo.
> - **Two manual steps live outside the deploy script** (consumer-add and secrets upload). They're separated because both involve interactive Chainlink tooling that doesn't fit Foundry's broadcast model. If you only run `forge script` and stop there, fact requests will fail.

### Step 0.2 — Configure the repo and deposit USDC

```solidity
vault.configureRepo(
  repoIdFromSlug("skanislav/x502"),       // bytes32(keccak256("github.com/skanislav/x502"))
  trustedAgents = [101, 102, 103],         // ERC-8004 token IDs
  threshold = 2,                           // 2-of-3 M-of-N
  prices = Prices({ report: 5e6, triage: 2e6, fix: 50e6, docsTests: 30e6 }),  // USDC has 6 decimals
  outcomeFeePerVerifier = 0.10e6
);
vault.deposit(repoId, 1000e6);  // 1000 USDC, after USDC.approve(vault, ...)
```

This stores a `RepoConfig` ([`contracts/src/BountyVault.sol:38-46`](contracts/src/BountyVault.sol)) keyed by `repoId`. The owner is `msg.sender`. The vault is now armed for `skanislav/x502`.

> **Insight**
> - **One vault, many repos.** A single deployed `BountyVault` serves *all* repos — config is keyed by `bytes32 repoId`. Anyone can call `configureRepo` for a fresh `repoId` and become its owner. This is a classic first-write-wins ownership pattern that lets the protocol be permissionless to onboard onto.
> - **Why M-of-N (2-of-3 here)?** A single AI verifier could be jailbroken, prompt-injected through the GitHub issue body, or have its key compromised. Requiring multiple independent verifiers to sign means an attacker has to compromise (or convince) `threshold` of them simultaneously.
> - The `outcomeFeePerVerifier` is the **economic incentive for verifiers to be online**. Each call to `payout` pays each signing verifier's wallet `0.10 USDC` from the bounty. This funds their RPC + Anthropic API costs and gives them skin in the game.

### Step 0.3 — Boot the off-chain services

Three verifier-agent processes ([`packages/verifier-agent/src/main.ts`](packages/verifier-agent/src/main.ts)), each with its own `VERIFIER_AGENT_ID` ∈ {101, 102, 103}, plus one coordinator ([`packages/coordinator/src/server.ts`](packages/coordinator/src/server.ts)):

```
verifier-agent-101  →  http://localhost:9001  (signs as ERC-8004 #101's wallet)
verifier-agent-102  →  http://localhost:9002
verifier-agent-103  →  http://localhost:9003
coordinator         →  http://localhost:8787  (orchestrator + onchain submitter)
```

Each verifier-agent's wallet is either:
- an **EOA** loaded from `VERIFIER_PRIVATE_KEY` (simple), or
- a **Coinbase Smart Wallet** bootstrapped via CDP ([`packages/verifier-agent/src/wallet/cdp.ts`](packages/verifier-agent/src/wallet/cdp.ts)) — a contract wallet that signs via ERC-1271.

For the smart-wallet path, the registered "agent address" is the *contract address*, and signatures are verified by the vault calling `IERC1271(wallet).isValidSignature(digest, sig)` — see how `BountyVault._verifySignatures` uses OpenZeppelin's `SignatureChecker.isValidSignatureNow` at [`contracts/src/BountyVault.sol:220`](contracts/src/BountyVault.sol).

---

## Phase 1 — Alice files the bug (`kind=report`, 5 USDC)

### Step 1.1 — Alice writes the issue body

She finds the bug: `splitEvenly(10, 3)` returns `[3, 3, 3]` (sum 9, not 10). She needs to know the issue number *before* publishing the issue, because that number goes into her commitment hash. Two practical options:

- **Open a draft / placeholder issue first**, note the assigned number `N`, then edit the body to include the commitment for `external-id=N`. (GitHub allows editing an issue's own body.)
- **Predict** the next sequential number from the repo's recent issues — riskier if there's contention.

For this walkthrough say the issue gets number `#2`. Alice runs:

```sh
tsx demo/scripts/derive-commitment.ts \
  --agent-id 101 \
  --repo skanislav/x502 \
  --external-id 2 \
  --salt 0x...beef
```

The script ([`demo/scripts/derive-commitment.ts`](demo/scripts/derive-commitment.ts)) computes:

```
commitment = keccak256(
  abi.encode(uint256(101), bytes32(repoId), uint256(2), bytes32(0x...beef))
)
```

Alice pastes this into her issue body:

```markdown
`splitEvenly(10, 3)` returns `[3, 3, 3]` (sum 9) — loses the remainder.
Repro: ...

<!-- x502-commitment:0xabc...123 -->
```

> **Current vs. intent**
> The system currently has no help for the "I need the issue number to derive the commitment, but I need the commitment to file the issue" chicken-and-egg. The README pattern of "file then claim" assumes the body can be edited post-creation, which works on GitHub but the doc didn't spell it out. A cleaner future would be a UI flow that opens the draft issue, watches for the assigned number, derives + injects the commitment, and publishes — none of which is built today.

> **Insight**
> - **This is a commitment scheme, not a signature.** Alice doesn't sign anything yet — she just *commits* to four values whose hash she publishes in the issue body. She's saying: "When I claim, I'll prove I knew the salt that maps to this hash."
> - **What the commitment actually protects: salt secrecy, not wallet identity.** A front-runner watching `skanislav/x502` who sees Alice's commitment `0xABC...` *cannot* file a successful claim because they don't know Alice's salt — they can't produce a `(saltReveal, agentIdReveal)` pair whose keccak hashes back to `0xABC`. As long as Alice keeps her salt private, only she can submit a valid claim.
> - **Why include `agentId` in the hash at all if the vault doesn't enforce identity?** Today: it's just a domain-separation tag in the hash. The vault never resolves `agentIdReveal` to a wallet, never compares it to `recipient`, and never checks the ERC-8004 registry. The recipient field is whatever Alice (or anyone with her salt) puts in the POST body.
> - **Note the structural mirror:** [`packages/shared/src/claim-id.ts:17-24`](packages/shared/src/claim-id.ts) (`deriveCommitment`) and the verifier-agent's recompute ([`packages/verifier-agent/src/policies/claude.ts:114-129`](packages/verifier-agent/src/policies/claude.ts)) use the *exact same* ABI encoding — `[uint256, bytes32, uint256, bytes32]`. If they drifted, the verifier would silently reject all claims.

> **Current vs. intent**
> The `demo/README.md` describes the commitment as "wallet-bound without OAuth" via the ERC-8004 IdentityRegistry — implying that `agentIdReveal` resolves to a wallet which gets compared to the claim recipient. That comparison **is not in the code today**. Two things are missing for the design to match the prose:
> 1. The vault would need to call `agentRegistry.getAgentWallet(agentIdReveal)` and require it equal `recipient`.
> 2. The verifier-agent's `ClaudePolicy.checkCommitment` would need to do the same check off-chain so the verifier never signs a malformed claim.
>
> A separate marker, `<!-- x502:0x{40-hex-wallet} -->`, *is* parsed by [`chainlink/source.js:49-52`](chainlink/source.js) into the `ghAuthorBinding` field of the fact blob. But (a) it's a different marker from the `x502-commitment` one, (b) the vault never reads that field. So today there are two parallel mechanisms, only one (the salt-secrecy commitment) is enforced, and that one doesn't actually bind to a wallet.

### Step 1.2 — Alice POSTs `/claim`

Once the issue exists (with number `#2` and the commitment in its body), Alice (or her dApp) calls:

```http
POST http://localhost:8787/claim
X-PAYMENT: <x402 settlement header from her wallet>
Content-Type: application/json

{
  "repoSlug": "skanislav/x502",
  "externalId": "2",
  "kind": "report",
  "recipient": "0xAlice...",
  "agentIdReveal": "101",
  "saltReveal": "0x...beef"
}
```

The `X-PAYMENT` header is settled via the **x402 protocol** ([`packages/coordinator/src/adapters/x402-gate.ts`](packages/coordinator/src/adapters/x402-gate.ts)). On Alice's first attempt without a header, the coordinator returns `HTTP 402 Payment Required` with a body describing where to pay $0.01 USDC. Her client (using `x402-fetch`) silently signs the USDC transfer, retries with the header, and the gate lets the request through.

> **Insight**
> - **The $0.01 fee is anti-spam, not revenue.** It's small enough that legitimate claims don't notice, but it makes mass-claiming financially painful (e.g. spamming 100k bogus claims = $1000 of locked-up USDC).
> - The fee flows to `X402_PAY_TO` (typically the coordinator's hot wallet), which then **funds the coordinator's outbound x402 calls** to the verifier-agents. So it's recursive: the same standard prices both inbound and outbound metering.
> - **Why HTTP 402 is suddenly meaningful.** RFC 7231 reserved status `402 Payment Required` decades ago "for future use" and it sat unused. Coinbase's x402 finally puts something there: a standard handshake where servers describe a price and clients pay via stablecoins, all in HTTP headers. x502's coordinator using it is one of its first real-world consumers.

### Step 1.3 — Coordinator validates and starts the pipeline

Inside [`packages/coordinator/src/server.ts:94-153`](packages/coordinator/src/server.ts):

1. **Parse** the request (regex-strict on `repoSlug`, `recipient`, `kind`).
2. **Resolve** `repoSlug → repoId` via the in-memory `repoRegistry`.
3. Compute `claimId = deriveClaimId(repoId, externalId, kind)` — same formula the contract uses.
4. **Idempotency check**: if `claims.has(claimId)`, return the existing `pollUrl` immediately — no double-firing.
5. Create an in-memory `ClaimState{ status: "verifying", deadline: now+30min, ... }` (no DB; pure RAM).
6. **Filter verifiers** to the trusted subset for this repo: `verifiers.filter(v => trusted.has(v.agentId))`.
7. **Reject early** if the coordinator only knows fewer trusted verifiers than the threshold (`503`).
8. **Fire `runClaimPipeline` async** (does NOT await) and respond immediately:

```json
HTTP 200
{ "claimId": "0x...", "pollUrl": "/payout/0x...", "status": "verifying" }
```

Alice's client now polls `/payout/<claimId>` every ~5s.

### Step 1.4 — The pipeline ([`packages/coordinator/src/pipeline.ts`](packages/coordinator/src/pipeline.ts))

```
        ┌──────────────────────────────┐
        │  runClaimPipeline (async)    │
        └──────────┬───────────────────┘
                   │
        ┌──────────▼───────────┐    fact request (Chainlink)
        │ A. factProvider      │  ───────────────────────────┐
        │   .requestFact(...)  │                             ▼
        │   .awaitFact(...)    │              GitHubFactReceiver.requestFact()
        └──────────┬───────────┘              → DON nodes execute chainlink/source.js
                   │                          → fulfillRequest stores _facts[claimId]
                   │ factBlob arrives         → coordinator polls .getFact() until ready
                   ▼
            factHash = keccak256(factBlob)
                   │
        ┌──────────▼─────────────────────────────────┐  POST /verify (x402 paid)
        │ B. verifiers.map(v => v.verify({           │ ─────────────────────────────┐
        │      claimId, factHash, recipient,         │                              ▼
        │      deadline, agentIdReveal, saltReveal   │              Each verifier-agent:
        │    }))                                     │              1. checks commitment
        │    Promise.all + per-verifier timeout      │              2. asks Claude
        └──────────┬─────────────────────────────────┘              3. signs EIP-712
                   │                                                4. returns sig
                   │ ≥ threshold accepted?
                   ▼
        ┌──────────────────────────────┐
        │ C. vault.submitPayout(...)   │  ──→  BountyVault.payout() onchain tx
        └──────────────────────────────┘
                   │
                   ▼
            state.txHash = "0x..."
            state.status = "paid"
```

#### Branch A — the Chainlink fact

Coordinator → `GitHubFactReceiver.requestFact(claimId, "skanislav/x502", 2, kind=0)`. The receiver packages args, uploads to the DON via `_sendRequest(...)`. The DON nodes execute [`chainlink/source.js`](chainlink/source.js):

```js
// args[0]="skanislav/x502", args[1]="2", args[2]="0" (report)
const r = await Functions.makeHttpRequest({
  url: `https://api.github.com/repos/skanislav/x502/issues/2`,
  headers: { Authorization: `Bearer ${secrets.GITHUB_PAT}`, ... },
});
// For kind=0 (report):
const labels = (r.data.labels ?? []).map(l => (l.name || l).toLowerCase());
const accepted = labels.includes("accepted") || labels.includes("bug") || labels.includes("enhancement");
const rejected = labels.includes("wontfix") || labels.includes("duplicate") || labels.includes("invalid");
status = accepted && !rejected ? 1 : 0;
return ABI.encode(["uint8","uint64","bytes32","address"], [status, 0n, labelMask, ghAuthorBinding]);
```

The DON nodes sign this output, ship it back, and `GitHubFactReceiver.fulfillRequest` stores `_facts[claimId] = { ready: true, blob }`.

> **Insight**
> - **The DON is doing two jobs at once: data fetch + multi-party signing.** Chainlink's threshold-signature scheme means the bytes that land on chain were agreed on by many independent nodes — no single node could lie about what GitHub said.
> - **Why ABI-encode instead of just returning `status`?** The fact blob carries `(status, mergedBlock, labelMask, ghAuthorBinding)` so future contracts can read individual fields, but signing over the *whole blob* via `factHash = keccak256(blob)` keeps signature compatibility intact even if those fields gain consumers later.

> **Current vs. intent**
> **The DON's `status` field is currently NOT enforced at the contract level.** [`BountyVault.payout`](contracts/src/BountyVault.sol) only checks `keccak256(L.factBlob) != factHash` — it never decodes the blob or asserts `status == 1`. Likewise the coordinator's [`pipeline.ts`](packages/coordinator/src/pipeline.ts) just hashes the blob without inspecting it. The implication: a fact returning `status=0` (e.g. issue exists but lacks the right labels for `report`) would still settle if M verifiers signed over its hash.
>
> The actual acceptance gate is therefore the verifier-agents alone, who fetch GitHub directly via Octokit and judge with Claude — they never consult the DON's `status` field. The DON's role today is closer to "tamper-proof anchor that GitHub state at this snapshot really exists" than "structural acceptance check". For the original two-layer-gate design, the vault would need a `bytes calldata` decode + `require(status == 1)` next to the `factHash` check.

#### Branch B — the verifier sigs

Once `factHash` is known, coordinator fans out a POST `/verify` to each verifier (using x402-fetch — yes, *the verifier endpoints are also paid*). Each verifier ([`packages/verifier-agent/src/server.ts`](packages/verifier-agent/src/server.ts)) does:

1. **Parse + repo guard.** Resolve `repoId → slug`; reject if it doesn't match this agent's configured repo.
2. **Run `policy.decide(ctx)`** — the [`ClaudePolicy`](packages/verifier-agent/src/policies/claude.ts) does:
   - Fetch the issue (or PR) via Octokit using a real GitHub token.
   - **Recompute the commitment** from `(agentIdReveal, repoId, externalId, saltReveal)` and grep the body for `<!-- x502-commitment:0x… -->`. If it doesn't match, `commitmentVerified = false`.
   - Build a structured prompt with the issue title/body/labels/state and the `commitmentVerified` flag.
   - Call **Claude Opus 4.7** with `output_config.format = json_schema { accept: bool, reason: string }` and `thinking: { type: "adaptive" }` — Claude will think more on harder claims, less on obvious ones.
   - The system prompt encodes the per-kind rules ("Drive-by typo PRs do NOT qualify for `fix`", etc.).
3. If `decision.accept === true`, **sign EIP-712**:

```ts
attestation = { claimId, recipient, deadline, factHash };  // 4 fields
digest = hashTypedData({
  domain: { name: "x502", version: "1", chainId, verifyingContract: vault },
  types: { Attestation: [{ claimId, recipient, deadline, factHash }] },
  ...
});
signature = account.signTypedData(...);
return { agentId, signature, attestation };
```

> **Insight**
> - **Why sign over `factHash` and not the raw `factBlob`?** Signatures are bound to a 32-byte hash. If the vault re-derives `keccak256(factBlob)` and matches it, the verifier's signature transitively binds to the *exact* DON-attested state of GitHub. No race where the verifier signed off on one labeling and the contract sees a different one.
> - **`deadline` makes attestations time-boxed.** Set to `now + 30min` by default. If the coordinator can't get all signatures and submit the tx in 30 minutes, the whole claim has to restart. This caps blast radius if a verifier key is compromised.
> - **The Claude policy is pluggable.** `DecisionPolicy` is a TypeScript interface ([`packages/verifier-agent/src/decide.ts`](packages/verifier-agent/src/decide.ts)) — you could swap in a manual reviewer, a different model, a deterministic rule engine. The vault doesn't care; it just needs M valid EIP-712 sigs from trusted agents.
> - **Adaptive thinking + JSON schema together** mean the verifier's response is both *cheap* (Claude thinks less on easy cases) and *parseable* (no markdown stripping, no JSON repair) — a good production-quality detail.

### Step 1.5 — The vault settles

Once ≥ threshold (here, 2-of-3) signatures came back, coordinator submits ([`packages/coordinator/src/adapters/viem-vault.ts`](packages/coordinator/src/adapters/viem-vault.ts)):

```solidity
vault.payout(
  repoId,
  externalId = 2,
  kind = Kind.Report,           // 0
  recipient = 0xAlice,
  deadline,
  factHash,
  agentIds = [101, 102],        // sorted ascending for determinism
  signatures = [sig101, sig102]
);
```

Inside [`BountyVault.sol:143-197`](contracts/src/BountyVault.sol):

```
1.  block.timestamp <= deadline                                   (DeadlineExpired)
2.  agentIds.length == signatures.length                          (LengthMismatch)
3.  cfg.exists                                                    (RepoNotConfigured)
4.  agentIds.length >= cfg.threshold                              (InsufficientSignatures)
5.  claimId = keccak256(repoId, externalId, kind)
6.  !isPaid[claimId]                                              (AlreadyPaid)
7.  factProvider.getFact(claimId) → (ready=true, blob)            (FactNotReady)
8.  keccak256(blob) == factHash                                   (FactHashMismatch)
9.  digest = hashTypedData(Attestation{claimId, recipient, deadline, factHash})
10. for each signer: trusted? not duplicate? sig valid via SignatureChecker?
11. price = 5e6;  fees = 0.10e6 * 2 = 0.20e6;  claimantAmount = 4.80e6
12. cfg.balance >= price                                          (InsufficientRepoBalance)
13. EFFECTS:
       isPaid[claimId] = true
       cfg.balance -= 5e6
14. INTERACTIONS (after state writes — CEI pattern, nonReentrant):
       USDC.safeTransfer(getAgentWallet(101), 0.10e6)
       USDC.safeTransfer(getAgentWallet(102), 0.10e6)
       USDC.safeTransfer(0xAlice, 4.80e6)
15. emit Paid(claimId, repoId, kind, recipient, 4.80e6, [101,102])
```

> **Insight**
> - **`SignatureChecker.isValidSignatureNow` is the EIP-1271 magic.** For EOAs it's just `ecrecover`. For contract wallets (Coinbase Smart Wallet), it does a `staticcall` to `IERC1271(wallet).isValidSignature(digest, sig)` and checks the magic return value. The vault accepts both transparently.
> - **The `isPaid[claimId]` fuse is per-(repo, externalId, kind).** That's why Carol's PR can pay both `fix` AND `docs_tests` — they hash to different `claimId`s. But Carol can never claim `fix` *twice* for the same PR.
> - **`PriceUnderflow` guard at line 181.** If `outcomeFeePerVerifier * agentIds.length >= price`, the vault reverts — preventing a misconfigured repo where verifier fees would consume the whole bounty (or worse, underflow the claimant's amount).
> - **Why the per-iteration trust check is nested O(N×M).** Both arrays are tiny (≤ ~10 agents), so the gas cost of the nested loop is dwarfed by the SLOAD-per-iteration savings of not building a hash set in storage. A pragmatic, gas-conscious choice for the expected scale.

Alice's poll finally returns:

```json
HTTP 200
{ "status": "paid", "txHash": "0x...", "claimId": "0x...", "recipient": "0xAlice" }
```

Her wallet shows **+4.80 USDC**. Done.

---

## Phase 2 — Bob triages (`kind=triage`, 2 USDC)

This is structurally the same as Phase 1 but the *fact rules differ*. Bob:

1. Adds `bug` + `accepted` labels to issue #2, and edits the **issue body** to include both his commitment marker and any repro / dedup evidence he wants the verifier to see (see callout below — comments are not visible to the verifier today).
2. Derives his commitment with *his* `agentId`, *his* salt and confirms the marker is in the body.
3. POSTs `/claim` with `kind: "triage"` to coordinator.

> **Current vs. intent**
> **Anything Bob wants the verifier to consider must live in the issue body.** [`ClaudePolicy.decide`](packages/verifier-agent/src/policies/claude.ts) calls `octokit.rest.issues.get` and uses only `issue.data.body` and `issue.data.labels` — comments are never fetched. This affects:
>
> - **The commitment marker** (`<!-- x502-commitment:0x... -->`) must be in the body, or `checkCommitment` returns false and Claude rejects.
> - **Repro / dedup evidence** (the substance Claude judges for `triage`) must also be in the body. A comment chain showing Bob's reproduction work is invisible to the policy.
>
> Practical implications:
> - Bob needs **repo-write permission** to edit Alice's issue body. Triagers typically have it; random contributors don't.
> - Or Alice has to add Bob's commitment + evidence to her body for him — requires off-band coordination Alice can't do without knowing Bob's `(agentId, salt)`.
> - The clean fix is to extend `ClaudePolicy.decide` to also fetch comments via `octokit.rest.issues.listComments` and concatenate their bodies before running both `checkCommitment` and the Claude judgment. ~10 lines of code; not done today.

Different verification logic kicks in:

| Layer | What changes for `triage` |
|---|---|
| `chainlink/source.js` (kind=1) | Computes `status = labels.length >= 2 ? 1 : 0` and packs it into the fact blob. **Note:** as in Phase 1's "Current vs. intent" callout, this status field is not enforced by the coordinator or vault — it's signed bytes the DON returns, not a runtime gate. |
| `ClaudePolicy` system prompt | "at least 2 *meaningful* labels added, with clear repro steps or dedup links" — Claude judges *substance*, not just count. This is the only acceptance gate that actually executes today. |
| Vault | Same `payout` flow, just with `kind = Kind.Triage` ⇒ different `claimId` ⇒ different `isPaid` slot ⇒ **separate from Alice's `report` claim**. Both can be paid against the same issue. |

Bob receives `2 - 0.20 = 1.80 USDC`.

> **Insight**
> - **Bob's wallet ≠ Alice's wallet.** Each gets their own commitment. The vault doesn't know they're collaborating on the same issue — it just sees two distinct `claimId`s.
> - This **decouples authorship from fixability**: the protocol pays the *act of triaging* even if a different person reported and a third person fixes. That's the core innovation — granular bounties for *each contribution type*, not just merged PRs.
> - **Cost intuition for the layered design as intended.** The DON's label-count check would be the cheap broad filter; Claude's substance judgment would be the expensive narrow filter. As coded today, only the expensive layer executes — every claim that passes the commitment check spends Anthropic API tokens regardless of label count. Wiring the DON's `status` field into the vault would close the gap.

---

## Phase 3 — Carol fixes it (`kind=fix`, 50 USDC + `kind=docs_tests`, 30 USDC)

This is what we just merged in PR #3. Carol:

### Step 3.1 — Carol forks/branches and writes the fix
She replaces the buggy `splitEvenly` with the correct front-loaded-remainder version, adds three tests, and updates the doc.

### Step 3.2 — She derives her commitment for the PR she's about to open

```sh
tsx demo/scripts/derive-commitment.ts \
  --agent-id 103 \
  --repo skanislav/x502 \
  --external-id 3 \           # the PR number that will be assigned
  --salt 0x...cafe
# → 0xe5ed81793c6ec16c1094e2f8498d760cc9777ab40dd52b82d226c5d01aa63df0
```

She knows the PR number in advance because she can guess the next sequential GitHub issue/PR number — or she opens a draft, observes the number, then edits in the commitment.

### Step 3.3 — She opens the PR with the right body

The PR body must contain:
- `Fixes #2` (or `Closes`/`Resolves`) — required by [`chainlink/source.js:79`](chainlink/source.js) for `kind=fix`.
- `<!-- x502-commitment:0xe5ed... -->` — required by Claude policy for both kinds.

### Step 3.4 — Repo Owner (or anyone with merge perms) merges the PR

This is the crucial state transition: the DON's GitHub fetch will only return `merged === true` after the merge.

### Step 3.5 — Carol files claim #1 (`kind=fix`)

```http
POST /claim
{
  "repoSlug": "skanislav/x502",
  "externalId": "3",
  "kind": "fix",
  "recipient": "0xCarol",
  "agentIdReveal": "103",
  "saltReveal": "0x...cafe"
}
```

The pipeline runs:
- DON: fetches `/repos/skanislav/x502/pulls/3`, sees `merged=true` AND body matches `/(?:fixes|closes|resolves)\s+#\d+/i` → `status=1`, plus `mergedBlock = first 8 bytes of merge_commit_sha`.
- Verifiers (×2 of 3): commitment matches → Claude gets the PR title, state, labels, body → judges "real fix, not churn" → returns `accept=true`, signs EIP-712.
- Vault: pays Carol `50 - 0.20 = 49.80 USDC`.

### Step 3.6 — Carol files claim #2 (`kind=docs_tests`) for the same PR

```http
POST /claim
{ "externalId": "3", "kind": "docs_tests", ... }
```

This time:
- `claimId = keccak256(repoId, 3, kind=3)` — a *different* hash than the `fix` claim, so `isPaid[claimId]` is fresh.
- DON fetches `/repos/.../pulls/3/files`, scans filenames for `(test|tests|spec|__tests__)/` and `(docs|readme)`. Both hit → `status=1`, `labelMask = 0x3` (bits 1 and 2 set).
- Verifiers re-judge for *substance* on this kind: tests must be meaningful, docs must not be churn. Carol's PR has both → accepted.
- Vault: pays Carol `30 - 0.20 = 29.80 USDC`.

**Carol's total earnings from one PR: 49.80 + 29.80 = 79.60 USDC.**

> **Insight**
> - **Same PR, two bounties, two onchain txs.** The protocol natively supports this because `claimId` is `kind`-aware. There's no "split a PR's bounty into types" complexity — it's just two independent claims.
> - **Today, only the AI verifiers actually decide acceptance.** Each Claude verifier independently fetches the PR via Octokit and checks the same structural conditions (`merged`, `Fixes #N`, file paths) plus the qualitative ones (real fix vs. typo, meaningful tests vs. churn). The DON's `chainlink/source.js` *also* computes structural status into the fact blob, but the vault only enforces `keccak256(blob) == factHash` — it never reads `status`. So a single jailbroken or prompt-injected verifier still has to convince M-1 others; that's the multi-verifier safety, not a DON-vs-AI cross-check. Wiring the DON's `status` into the vault is what would turn this into the two-layer gate `demo/README.md` describes.
> - **The `mergedBlock` field** (first 8 bytes of `merge_commit_sha`, repurposed as a `uint64` "block-ish" identifier) lets future contracts gate payouts by merge block height — e.g. "only pay if merged before deadline-block N". Currently unused by the vault, but it's there in the fact blob.
> - **Notice what Carol does NOT do:** she never directly interacts with the smart contract. The coordinator submits the tx and pays the gas. Carol only ever signs:
>   - the `X-PAYMENT` header (USDC transfer for the $0.01 fee),
>   - nothing else on chain — her recipient address is just a payout destination.
>
>   This is a UX win: from her wallet's POV, she just paid $0.01 once and received $79.60 back.

---

## Cross-cutting: what protects the system?

| Threat | Defense (today) | Where in code |
|---|---|---|
| Front-running a claim with the same commitment | Salt secrecy — front-runner can't produce reveal pair without knowing Alice's salt | [`packages/verifier-agent/src/policies/claude.ts:114`](packages/verifier-agent/src/policies/claude.ts) |
| Compromising one verifier key | M-of-N threshold | [`contracts/src/BountyVault.sol:158`](contracts/src/BountyVault.sol) |
| Lying about GitHub state to verifiers | Each verifier-agent fetches GitHub independently via Octokit; M of them must agree | [`packages/verifier-agent/src/policies/claude.ts:65-99`](packages/verifier-agent/src/policies/claude.ts) |
| Replaying an old payout | `isPaid[claimId]` one-shot fuse | [`contracts/src/BountyVault.sol:162,186`](contracts/src/BountyVault.sol) |
| Signing valid attestations forever | EIP-712 `deadline` field | [`contracts/src/lib/Attestations.sol:11-16`](contracts/src/lib/Attestations.sol) |
| Spamming the coordinator | x402 anti-spam fee on `/claim` | [`packages/coordinator/src/adapters/x402-gate.ts`](packages/coordinator/src/adapters/x402-gate.ts) |
| Reentering payout via USDC callback | OpenZeppelin `ReentrancyGuard` + CEI ordering | [`contracts/src/BountyVault.sol:124,152`](contracts/src/BountyVault.sol) |
| Verifier accepting a malicious PR after prompt injection | M-of-N independent Claude calls (single layer today; see gap below) | [`packages/verifier-agent/src/policies/claude.ts`](packages/verifier-agent/src/policies/claude.ts) |
| Stale fact (e.g. PR merged then reverted between fact-fetch and payout) | `factHash` binds attestation to *the specific blob* the DON returned | [`contracts/src/BountyVault.sol:166-168`](contracts/src/BountyVault.sol) |

### Known gaps (defenses that are described but not implemented)

| Threat | Stated defense (in `demo/README.md`) | Why it doesn't actually defend today |
|---|---|---|
| Claim filed by non-author who learned the salt | "Wallet binding via ERC-8004 IdentityRegistry — recipient must equal `getAgentWallet(agentIdReveal)`" | Vault never resolves `agentIdReveal` to a wallet, never compares to `recipient`. Whoever knows the salt can pay any address. |
| DON returning `status=0` because labels missing | "DON's structural check is the cheap broad filter" | Vault and coordinator only check `keccak256(blob) == factHash`; `status` field is never decoded or asserted. |
| Triager's commitment in a PR comment | "Verifier reads body and comments alongside" | `ClaudePolicy.decide` only fetches issue body; comments are not retrieved. |
| GitHub-author binding via `<!-- x502:0x{wallet} -->` marker | Fact blob carries `ghAuthorBinding` | The marker is parsed by `chainlink/source.js` but the vault never reads the field. |

---

## Mental model in one sentence

> A repo owner deposits USDC into a vault that pays anyone who can produce **M-of-N EIP-712 attestations from trusted AI verifier agents, each of which independently fetches GitHub and asks Claude whether the work qualifies for the chosen `kind`** — anchored on chain by a Chainlink-DON-signed snapshot of the underlying GitHub state (`factHash`) so the verifiers' attestations can't be reused against a different snapshot, with x402 micropayments providing the anti-spam fee on the coordinator's `/claim` endpoint and a salt-based commitment in the issue/PR body preventing claim front-running.

> **Where this sentence diverges from `demo/README.md`'s framing:** the README pitches the DON as a *structural acceptance gate* and the commitment as a *wallet binding*. As implemented, the DON is a tamper-proof anchor (no `status` enforcement) and the commitment is a salt-secrecy lock (no wallet binding). See the "Known gaps" subtable above.

---

## Where to go next

If you want to dig into a single layer end-to-end:

- **EIP-712 attestation flow** → [`contracts/src/lib/Attestations.sol`](contracts/src/lib/Attestations.sol), [`packages/shared/src/eip712.ts`](packages/shared/src/eip712.ts), [`packages/verifier-agent/src/sign.ts`](packages/verifier-agent/src/sign.ts).
- **x402 payment handshake** → [`packages/coordinator/src/adapters/x402-gate.ts`](packages/coordinator/src/adapters/x402-gate.ts), [`packages/coordinator/src/adapters/x402-fetch.ts`](packages/coordinator/src/adapters/x402-fetch.ts).
- **CDP smart-wallet vs EOA signing** → [`packages/verifier-agent/src/wallet/cdp.ts`](packages/verifier-agent/src/wallet/cdp.ts) vs [`packages/verifier-agent/src/wallet/env-key.ts`](packages/verifier-agent/src/wallet/env-key.ts).
- **Chainlink Functions DON request lifecycle** → [`contracts/src/GitHubFactReceiver.sol`](contracts/src/GitHubFactReceiver.sol) + [`chainlink/source.js`](chainlink/source.js).
- **ClaudePolicy prompt structure** → [`packages/verifier-agent/src/policies/claude.ts`](packages/verifier-agent/src/policies/claude.ts).
- **End-to-end test that exercises the whole pipeline against an anvil fork** → [`packages/coordinator/test/integration.test.ts`](packages/coordinator/test/integration.test.ts).
