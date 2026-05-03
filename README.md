# x502

> **x402 = agent pays a service for compute.**
> **x502 = service pays agents for verifiable outcomes.**

x502 is a settlement protocol for paying agents (or humans) in USDC for
**verifiable GitHub contributions** — bug reports, triage, fixes, and
docs/tests — gated by an on-chain fact oracle plus an M-of-N panel of AI
verifiers.

The payout is one transaction. The trust assumptions are pinned at deploy
time. Anyone with the right reveals can call it; the vault re-checks
everything before sending USDC.

---

## TL;DR for judges

A repo owner deposits USDC into a `BountyVault`, configures four prices
(`report` / `triage` / `fix` / `docs_tests`), and picks a trusted set of
**ERC-8004** agent identities with an M-of-N threshold (typically 2-of-3).

A claimant files a `POST /claim` to a coordinator and pays a $0.01
anti-spam fee through **Coinbase x402**. The coordinator then runs two
parallel verification branches:

1. **Chainlink Functions DON** fetches the issue/PR via the GitHub API,
   computes a structural fact (`status`, `mergedBlock`, `labelMask`,
   `ghAuthorBinding`), ABI-encodes it, and signs it. The hash of that
   blob (`factHash`) becomes the on-chain anchor.
2. **Verifier identities** (today: humans driving the
   `/x502-verify` Claude Code skill) re-fetch the GitHub state, judge it
   against a per-kind rubric, and publish an **EAS attestation** under
   the vault's schema with `(claimId, factHash, accept=true)`.

When the coordinator sees `≥ threshold` matching attestations, it calls
`BountyVault.payout(...)` with the attestation UIDs. The vault:

- re-fetches each EAS attestation by UID,
- enforces schema, revocation, claim binding, and trust,
- decodes the DON fact and enforces `recipient == ghAuthorBinding`
  (closes the front-running gap), and
- pays out `price − (outcomeFee × signers)` to the claimant and the
  outcome fee to each attester's address.

`isPaid[claimId]` is the one-shot fuse. `claimId = keccak256(repoId,
externalId, kind)` so the same PR can collect `fix` *and* `docs_tests`
in two independent settlements.

---

## Sponsor stack

| Layer | What we use it for |
|---|---|
| **Coinbase x402** | $0.01 anti-spam gate on `POST /claim`. The same standard meters the coordinator's outbound `POST /verify` calls when those exist. RFC 7231's reserved `402 Payment Required` finally gets a wire format. |
| **Chainlink Functions** | DON-attested GitHub fact. The threshold-signed bytes returned by `chainlink/source.js` are what `factHash` commits to. No single node can forge what GitHub said. |
| **Ethereum Attestation Service (EAS)** | Source-of-truth for verifier consensus. Each verifier identity publishes one attestation under the vault's `schemaUID`; the vault validates UID + schema + revocation on chain. |
| **ERC-8004 IdentityRegistry** | Maps `agentId → wallet` so the vault can pay outcome fees to the correct address (works for EOAs and ERC-1271 smart wallets transparently). |
| **Coinbase CDP / Smart Wallets** | Verifier identity can be a Coinbase Smart Wallet; signatures verify through `SignatureChecker.isValidSignatureNow` on the vault. |
| **Base / Base Sepolia** | Settlement chain. USDC is the canonical Base Sepolia testnet USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. |
| **Anthropic Claude (Opus 4.7)** | The decision policy inside `/x502-verify`: structured JSON-schema output + adaptive thinking, run independently by each verifier identity. |

---

## What problem does this solve?

Open-source maintainers pay people in goodwill. Contribution bounties
exist but are payment-promise centric — nothing on-chain ties the
payout to the actual merge/triage event, and nothing protects the
maintainer from paying the wrong wallet.

x502 splits the contribution into **typed bounties** (the four kinds)
and gives each one a verifiable settlement path:

- The DON proves *this exact GitHub state was real*.
- The verifier panel proves *this state actually qualifies for this
  kind* (a one-line typo PR doesn't earn `fix`; a label-only triage
  with no repro link doesn't earn `triage`).
- The vault proves *this payout binds to the right wallet, exactly
  once, before USDC moves*.

The maintainer's only ongoing job is funding the vault and trusting M
of N verifier identities. Everything else is permissionless.

---

## Architecture

```
                   ┌──────────────────┐
                   │  Repo Owner      │  funds vault, picks trusted
                   └────────┬─────────┘   ERC-8004 agent IDs (M-of-N)
                            │
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │  BountyVault.sol  (Base Sepolia: 0x8b41…c338)            │
   │  • per-repo config   • USDC balance   • isPaid fuse      │
   │  • on payout: validate EAS attestations + DON fact +     │
   │    ghAuthorBinding == recipient → transfer USDC          │
   └────────────▲──────────────────────────────▲──────────────┘
                │                              │
        attestation UIDs                  factHash anchor
                │                              │
   ┌────────────┴───────────┐    ┌─────────────┴────────────────┐
   │  EAS @ 0x4200…0021     │    │  GitHubFactReceiver          │
   │  schema:               │    │  (Chainlink Functions DON)   │
   │  bytes32 claimId,      │    │  source.js fetches GH API,   │
   │  bytes32 factHash,     │    │  encodes (status, mergedBlock│
   │  bool accept           │    │   labelMask, ghAuthorBinding)│
   └────────────▲───────────┘    └────────────▲─────────────────┘
                │                             │
       attest() per verifier        requestFact() per claim
                │                             │
   ┌────────────┴───────────┐    ┌────────────┴─────────────────┐
   │  Verifier identities   │    │  Coordinator (Hono service)  │
   │  (human + Claude       │◄───┤  • POST /claim (x402-gated)  │
   │   running /x502-verify)│    │  • subscribes to EAS         │
   │  ERC-8004 IDs 101..103 │    │  • submits payout when M sigs│
   └────────────────────────┘    └──────────────────────────────┘
                                           ▲
                                           │  $0.01 USDC (x402)
                                  ┌────────┴─────────┐
                                  │ Claimant wallet  │
                                  └──────────────────┘
```

---

## The four bounty kinds

| Kind | Trigger | Default demo price | Who claims |
|---|---|--:|---|
| `report` | An issue gets `bug` / `accepted` / `enhancement` labels | 0.05 USDC | The original reporter |
| `triage` | An issue accumulates ≥ 2 substantive labels + repro/dedup | 0.02 USDC | The triager |
| `fix` | A PR with `Fixes #N` is merged into the default branch | 0.50 USDC | The PR author |
| `docs_tests` | A merged PR also touches `test/` or `docs/` paths | 0.30 USDC | The PR author |

`claimId = keccak256(repoId, externalId, kind)` — different `kind`s
hash to different `claimId`s, so a single merged PR can settle both
`fix` and `docs_tests` in two independent payouts. The `isPaid` fuse
is per-`claimId`, so neither can be paid twice.

---

## Front-run protection — two markers in the GitHub body

The vault does not know which wallet authored an issue or PR on
GitHub. Without a binding, anyone watching a popular repo could see a
new issue and race to file a claim against their own wallet. x502
defends with two markers placed in the issue/PR body:

```markdown
<!-- x502-commitment:0xe5ed81793c6ec16c1094e2f8498d760cc9777ab40dd52b82d226c5d01aa63df0 -->
<!-- x502:0xALICE_WALLET_ADDRESS -->
```

- **`x502-commitment`** is `keccak256(agentId, repoId, externalId, salt)`.
  At claim time the claimant reveals `(agentId, salt)` and the verifier
  recomputes the hash. A front-runner can't forge a reveal pair without
  the salt.
- **`x502:0xWALLET`** is parsed by `chainlink/source.js` into the
  fact blob's `ghAuthorBinding`. The vault decodes the blob and
  reverts with `RecipientNotBound` if `recipient != ghAuthorBinding`.
  Even if a front-runner stole the salt, USDC can only land at the
  bound wallet.

The two markers compose: salt secrecy stops the cheap attack, on-chain
binding stops the expensive one.

---

## Repository layout

```
contracts/                Foundry project — BountyVault, GitHubFactReceiver, libs, mocks
  src/BountyVault.sol         Settlement contract (USDC out, EAS attestations in)
  src/GitHubFactReceiver.sol  Chainlink Functions consumer
  src/lib/FactBlob.sol        Canonical decoder for the DON fact tuple

chainlink/                Functions DON source bundle
  source-core.js              decideFact() per kind + helpers (no external deps)
  source-wrapper.js           wraps source-core for the DON sandbox
  source.js                   built artifact uploaded to Chainlink Functions

packages/
  shared/                     claim-id derivation, types, viem ABIs
  coordinator/                Hono service: /claim, /payout, EAS watcher,
                              x402 gate, vault writer
  web/                        Next.js demo UI: stepper, verifier theater,
                              Sepolia replay tab
  verifier-agent/             (legacy EIP-712 agent — replaced by the
                              /x502-verify Claude skill)

demo/                     Live demo subject (tip-pool helpers)
  src/split.ts                planted off-by-remainder bug
  fix/                        the canonical fix + tests + docs update
  scripts/x502.ts             pending/attest CLI used by /x502-verify

.claude/skills/x502-verify/   The Claude Code skill that drives a verifier identity
.github/workflows/ci.yml      CI: lint (forge fmt + biome + tsc), forge tests, vitest
```

---

## Run the demo locally

Prereqs: Node 22+, pnpm 10, Foundry, Anthropic API key, Claude Code.

```sh
git clone --recursive https://github.com/Skanislav/x502.git
cd x502
pnpm install

pnpm demo                            # boots anvil + seed + coordinator + web
source demo/scripts/skill-env.sh     # exports VERIFIER_<id>_PRIVATE_KEY + X502_*
claude                               # opens Claude Code in another shell
> /x502-verify as agent 101          # publishes an EAS attestation
> /x502-verify as agent 102          # second attestation → vault settles
```

Then open `http://127.0.0.1:3000/?mode=demo` to watch the verifier
theater (per-agent reasoning + attestation collection) and the stepper
walking through report → triage → fix → docs_tests.

### Fork mode (real EAS contracts on Base Sepolia)

```sh
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org pnpm demo
```

`anvil` starts as a fork and the seed script registers the x502 schema
against the real EAS predeploy at `0x4200000000000000000000000000000000000021`.
Attestations from `/x502-verify` are real on-chain EAS attestations
under the same schema production would use.

---

## Deployed (Base Sepolia, chain `84532`)

| Contract | Address |
|---|---|
| `BountyVault` | `0x8b414bde9F7EA00f58aD143937a31Ae7b8D0c338` |
| `GitHubFactReceiver` | `0x8e4f147B51F1013aFa72B9b84EAB67893890edE6` |
| USDC (testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Chainlink Functions Router | `0xf9B8fc078197181C841c296C876945aaa425B278` |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| EAS predeploy | `0x4200000000000000000000000000000000000021` |
| Chainlink Functions subscription | `216` |

Repo configured: `skanislav/x502` (`repoId`
`0x1492f36cb3574897acc481255a88821753bd0a710fd4c2d834c533af6913ca59`).

---

## Tests

```sh
pnpm test                # forge + all vitest suites
pnpm lint                # forge fmt --check + biome
pnpm typecheck           # tsc --noEmit across the workspace
```

CI (`.github/workflows/ci.yml`) runs three jobs in parallel: `lint
(sol fmt + biome + tsc)`, `contracts (forge test)`, and `typescript
(vitest)`. The TS job also rebuilds the Solidity ABIs and asserts
`packages/shared/src/abis.ts` is in sync — so a contract change that
isn't propagated to the TS side fails CI loudly.

---

## What's novel here

- **Two-layer GitHub fact gate.** The DON proves the bytes; the
  verifier panel proves the meaning. Either alone is too brittle
  (DON can't judge "real fix vs typo"; an LLM panel alone can be
  prompt-injected through the issue body).
- **EAS as the consensus substrate.** The vault's contract surface is
  small (validate UIDs + schema + binding) and verifiers are
  swappable — any wallet that can attest under the schema can
  participate, including ERC-1271 smart wallets and human-driven
  Claude sessions.
- **`ghAuthorBinding` enforced on chain.** Most "GitHub-bounty"
  systems trust an off-chain bridge to map issues to wallets. We
  push the wallet into the GitHub body as a marker, the DON signs
  over it, and the vault refuses to pay anyone else. Custodial-free.
- **Typed bounties.** `claimId` is `(repo, externalId, kind)`-aware,
  so one merged PR pays both `fix` and `docs_tests` without the
  vault needing any "bundle" or "split" logic.
- **x402 in real production traffic.** The same anti-spam standard
  meters both ingress (the user → coordinator) and egress (the
  coordinator → off-chain compute paid services), giving an early
  end-to-end test of the spec.

---

## License

MIT. See [LICENSE](LICENSE).
