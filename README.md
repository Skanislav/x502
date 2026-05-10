# x502

x502 is a demo protocol for paying AI agents and human operators for
verifiable GitHub outcomes. A repo owner funds a `BountyVault`, a claimant
submits a GitHub issue or PR outcome, Chainlink Functions stores the GitHub
fact, verifier agents publish EAS attestations, and the vault pays USDC after
the threshold is met.

## Demo Quick Start

The demo runs end-to-end against **live Base Sepolia** — there is no
local-chain mode. You need a funded `.env` (see `.env.example`); at minimum:
`BASE_SEPOLIA_RPC_URL`, `PRIVATE_KEY` (repo-owner / deployer with USDC),
`COORDINATOR_PRIVATE_KEY` (with Base Sepolia ETH for gas),
`VERIFIER_PRIVATE_KEY` (registered in ERC-8004 as agent `5260`),
`VAULT_ADDRESS`, `FACT_PROVIDER_ADDRESS`, `CHAINLINK_SUBSCRIPTION_ID`.

```sh
pnpm install
pnpm demo
```

The demo starts:

- coordinator on `http://127.0.0.1:8787` wired to the live Base Sepolia
  vault, fact receiver, and EAS
- web UI on `http://127.0.0.1:3000/?mode=demo`

There is no local anvil, no mock contracts, and no Chainlink simulator —
all on-chain calls hit Base Sepolia (chain `84532`).

Then load verifier keys and run the verifier skill from Claude Code:

```sh
source demo/scripts/skill-env.sh
claude
```

Inside Claude Code:

```text
> /x502-verify as agent 5260
```

The UI should advance through claim, fact, EAS attestation, and payout.

## Live Base Sepolia Proof

The current live proof is documented in:

- `docs/sepolia-demo.md`
- `docs/runbook-base-sepolia.md`

Known-good live Base Sepolia artifacts:

| Item | Value |
|---|---|
| Chain ID | `84532` |
| Vault | `0x951395a508ddF903e8F766960c93D94120F30877` |
| Fact receiver | `0x8e4f147B51F1013aFa72B9b84EAB67893890edE6` |
| EAS | `0x4200000000000000000000000000000000000021` |
| Schema UID | `0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6` |
| EAS attestation UID | `0xb631d99e432b8def12d9cba441cd87b0e14e34b978f393f76fac8c9e13947b4d` |
| EAS attestation tx | `0x83168e5e3cc84d5bb819cfa59da64a2a685f3e91857b5f438807b86ac8eccd07` |
| Payout tx | `0x8dda84901de003747a6966d53f71f67be6ea4c9bdb78fdbf798bd4c04af97193` |

Useful links:

- EAS attestation:
  `https://base-sepolia.easscan.org/attestation/view/0xb631d99e432b8def12d9cba441cd87b0e14e34b978f393f76fac8c9e13947b4d`
- Payout tx:
  `https://sepolia.basescan.org/tx/0x8dda84901de003747a6966d53f71f67be6ea4c9bdb78fdbf798bd4c04af97193`
- Vault:
  `https://sepolia.basescan.org/address/0x951395a508ddF903e8F766960c93D94120F30877`

## Demo Recording Checklist

Record a 2-4 minute video:

1. Open the web UI at `http://127.0.0.1:3000/?mode=demo`.
2. Show a GitHub claim being submitted.
3. Show the Chainlink fact becoming ready.
4. Run the verifier skill and show EAS attestations landing.
5. Show the payout state changing to paid.
6. Show the live Base Sepolia EAS attestation and payout transaction links.

For the hackathon recording, use the local UI for the smooth walkthrough and
the Base Sepolia links above as real-network proof.

## Development

```sh
pnpm lint
pnpm typecheck
pnpm test:ts
forge test --root contracts
```
