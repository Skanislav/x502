# Base Sepolia Runbook

This runbook explains how to prepare, run, and verify an x502 demo on Base
Sepolia. Use `docs/sepolia-demo.md` for the latest known-good live proof and
transaction hashes.

## Known-Good Demo State

Use these values when replaying or verifying the current live demo proof:

| Item | Value |
|---|---|
| Network | Base Sepolia |
| Chain ID | `84532` |
| Repo | `skanislav/x502` |
| Repo ID | `0x1492f36cb3574897acc481255a88821753bd0a710fd4c2d834c533af6913ca59` |
| Current vault | `0x951395a508ddF903e8F766960c93D94120F30877` |
| Fact receiver | `0x8e4f147B51F1013aFa72B9b84EAB67893890edE6` |
| EAS | `0x4200000000000000000000000000000000000021` |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` |
| x502 schema UID | `0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| ERC-8004 registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Trusted verifier agent | `5260` |
| Trusted verifier wallet | `0x980abF154694Fe3Fea424eD095B04C6365E92F9b` |

Do not use the older vault from `docs/base-sepolia-progress-2026-04-28.md`
for the current EAS demo. That was a previous deployment.

## Prerequisites

1. Pull the latest `main`.
2. Install dependencies.
3. Make sure `.env` exists and contains the required live secrets.
4. Make sure the deployer/coordinator/verifier wallet has Base Sepolia ETH.
5. Make sure the repo owner wallet has enough Base Sepolia USDC.
6. Make sure the Chainlink Functions subscription is funded with LINK.
7. Make sure `gh`, `cast`, `forge`, and `pnpm` are available locally.

Minimal environment needed:

```sh
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=<deployer-private-key>
COORDINATOR_PRIVATE_KEY=<coordinator-private-key>
VERIFIER_PRIVATE_KEY=<verifier-private-key>
CHAINLINK_SUBSCRIPTION_ID=216
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Never paste private keys into docs, PRs, terminal logs, or issue comments.

## Preflight Checks

Run from the repo root:

```sh
set -a
source .env
set +a

cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast wallet address --private-key "$PRIVATE_KEY"
cast balance "$(cast wallet address --private-key "$PRIVATE_KEY")" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$(cast wallet address --private-key "$PRIVATE_KEY")" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected:

- Chain ID is `84532`.
- Wallet address is the intended deployer/repo owner.
- ETH balance is enough for several testnet transactions.
- USDC balance is enough for the intended vault deposit.

## Register Or Verify The EAS Schema

The x502 schema is:

```text
bytes32 claimId,bytes32 factHash,bool accept
```

Register it once per chain. The helper is idempotent:

```sh
set -a
source .env
set +a

pnpm exec tsx demo/scripts/eas-register.ts \
  --rpc "$BASE_SEPOLIA_RPC_URL" \
  --scope-id PRIVATE_KEY \
  --chain-id 84532
```

Expected UID:

```text
0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6
```

Verify it directly:

```sh
SCHEMA_UID=0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6

cast call 0x4200000000000000000000000000000000000020 \
  "getSchema(bytes32)((bytes32,address,bool,string))" \
  "$SCHEMA_UID" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected schema string is `bytes32 claimId,bytes32 factHash,bool accept`.

## Choose A Deployment Path

There are two supported paths.

### Path A: Reuse The Existing Fact Receiver

Use this for the fastest demo setup. This was the path used for
`docs/sepolia-demo.md`.

You deploy only a fresh current `BountyVault` and reuse:

```text
GitHubFactReceiver=0x8e4f147B51F1013aFa72B9b84EAB67893890edE6
```

This avoids adding a new Chainlink Functions consumer.

### Path B: Full Fresh Deploy

Use this when the fact receiver source/config must change.

The Foundry deploy script deploys both `GitHubFactReceiver` and `BountyVault`:

```sh
cd contracts

set -a
source ../.env
set +a

export X502_SCHEMA_UID=0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6
export FUNCTIONS_SOURCE_PATH=../chainlink/source.js

forge script script/Deploy.s.sol \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast
```

After a full fresh deploy, add the new fact receiver as a consumer on
subscription `216`. Without this, `requestFact(...)` will fail or never
fulfill.

## Deploy A Fresh Vault While Reusing The Fact Receiver

Use this command for Path A:

```sh
cd contracts

set -a
source ../.env
set +a

SCHEMA_UID=0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6
FACT_PROVIDER=0x8e4f147B51F1013aFa72B9b84EAB67893890edE6
REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
EAS=0x4200000000000000000000000000000000000021

forge create src/BountyVault.sol:BountyVault \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args \
  "$USDC_ADDRESS" \
  "$REGISTRY" \
  "$FACT_PROVIDER" \
  "$EAS" \
  "$SCHEMA_UID"
```

Record:

- New vault address
- Deployment transaction hash
- Block number

Immediately verify the immutable wiring:

```sh
VAULT=<new-vault-address>

cast call "$VAULT" "usdc()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "agentRegistry()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "factProvider()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "eas()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "schemaUID()(bytes32)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected values are the addresses listed in the known-good table.

## Configure The Repo

For `skanislav/x502`, use:

```sh
REPO_ID=0x1492f36cb3574897acc481255a88821753bd0a710fd4c2d834c533af6913ca59
TRUSTED_AGENT=5260
THRESHOLD=1
REPORT_PRICE=50000
TRIAGE_PRICE=20000
FIX_PRICE=500000
DOCS_TESTS_PRICE=300000
OUTCOME_FEE=1000

cast send "$VAULT" \
  "configureRepo(bytes32,uint256[],uint8,(uint256,uint256,uint256,uint256),uint256)" \
  "$REPO_ID" \
  "[$TRUSTED_AGENT]" \
  "$THRESHOLD" \
  "($REPORT_PRICE,$TRIAGE_PRICE,$FIX_PRICE,$DOCS_TESTS_PRICE)" \
  "$OUTCOME_FEE" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

Verify:

```sh
cast call "$VAULT" "repoOwnerOf(bytes32)(address)" "$REPO_ID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "trustedAgentsOf(bytes32)(uint256[])" "$REPO_ID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "thresholdOf(bytes32)(uint8)" "$REPO_ID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "priceOf(bytes32,uint8)(uint256)" "$REPO_ID" 0 --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "outcomeFeeOf(bytes32)(uint256)" "$REPO_ID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

## Fund The Vault

Approve and deposit USDC:

```sh
DEPOSIT=2000000

cast send "$USDC_ADDRESS" \
  "approve(address,uint256)" \
  "$VAULT" \
  "$DEPOSIT" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY"

cast send "$VAULT" \
  "deposit(bytes32,uint256)" \
  "$REPO_ID" \
  "$DEPOSIT" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

Verify vault accounting and token balance:

```sh
cast call "$VAULT" "balanceOf(bytes32)(uint256)" "$REPO_ID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Both should equal the deposited amount before any payout.

## Run The Coordinator

Start the coordinator with live Base Sepolia env:

```sh
set -a
source .env
set +a

export RPC_URL="$BASE_SEPOLIA_RPC_URL"
export COORDINATOR_PORT=8787
export COORDINATOR_CHAIN_ID=84532
export VAULT_ADDRESS="$VAULT"
export FACT_PROVIDER_ADDRESS=0x8e4f147B51F1013aFa72B9b84EAB67893890edE6
export EAS_ADDRESS=0x4200000000000000000000000000000000000021
export X502_SCHEMA_UID=0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6
export COORDINATOR_REPO=skanislav/x502
export COORDINATOR_THRESHOLD=1
export COORDINATOR_TRUSTED_AGENT_IDS=5260
export COORDINATOR_TRUSTED_ATTESTERS=0x980abF154694Fe3Fea424eD095B04C6365E92F9b
export COORDINATOR_FACT_TIMEOUT_MS=300000
export COORDINATOR_ATTESTATION_TIMEOUT_MS=900000
export ONECLAW_MODE=local
export COORDINATOR_ONECLAW_SCOPE_ID=COORDINATOR_PRIVATE_KEY

pnpm exec tsx packages/coordinator/src/main.ts
```

Health check:

```sh
curl -sS http://127.0.0.1:8787/health
```

## Submit A Claim

For the report demo against issue `#2`:

```sh
curl -sS -X POST http://127.0.0.1:8787/claim \
  -H 'content-type: application/json' \
  --data '{
    "repoSlug": "skanislav/x502",
    "externalId": "2",
    "kind": "report",
    "recipient": "0xc2603c34e6C50E1389a008764A05Ac24919Bc3B3",
    "agentIdReveal": "101",
    "saltReveal": "0x000000000000000000000000000000000000000000000000000000000000beef"
  }'
```

Poll:

```sh
CLAIM=<claim-id>

curl -sS "http://127.0.0.1:8787/payout/$CLAIM"
pnpm exec tsx demo/scripts/x502.ts pending \
  --coordinator http://127.0.0.1:8787 \
  --agent-id 5260
```

When `pending` returns a `factHash`, move to attestation.

## Publish The Verifier Attestation

Use the `factHash` returned by `pending`:

```sh
CLAIM=<claim-id>
FACT_HASH=<fact-hash-from-pending>

set -a
source .env
set +a

pnpm exec tsx demo/scripts/x502.ts attest \
  --rpc "$BASE_SEPOLIA_RPC_URL" \
  --eas 0x4200000000000000000000000000000000000021 \
  --schema 0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6 \
  --scope-id VERIFIER_PRIVATE_KEY \
  --chain-id 84532 \
  --claim-id "$CLAIM" \
  --fact-hash "$FACT_HASH"
```

Record:

- EAS attestation UID
- EAS attestation tx hash

## Wait For Coordinator Payout

If the coordinator watcher observes the attestation, it should submit
`BountyVault.payout(...)` automatically.

Poll:

```sh
curl -sS "http://127.0.0.1:8787/payout/$CLAIM"
cast call "$VAULT" "isPaid(bytes32)(bool)" "$CLAIM" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected terminal state:

- Coordinator poll returns `paid`, or
- `isPaid(claimId)` returns `true`.

## Permissionless Payout Fallback

If EAS attestation exists but the coordinator does not count it, use the
permissionless vault path. First simulate the call:

```sh
RECIPIENT=0xc2603c34e6C50E1389a008764A05Ac24919Bc3B3
EXTERNAL_ID=2
KIND=0
DEADLINE=<deadline-from-pending>
UID=<eas-attestation-uid>

cast call "$VAULT" \
  "payout(bytes32,uint256,uint8,address,uint256,bytes32,bytes32[])" \
  "$REPO_ID" \
  "$EXTERNAL_ID" \
  "$KIND" \
  "$RECIPIENT" \
  "$DEADLINE" \
  "$FACT_HASH" \
  "[$UID]" \
  --from "$(cast wallet address --private-key "$PRIVATE_KEY")" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Only broadcast if the simulation returns `0x`:

```sh
cast send "$VAULT" \
  "payout(bytes32,uint256,uint8,address,uint256,bytes32,bytes32[])" \
  "$REPO_ID" \
  "$EXTERNAL_ID" \
  "$KIND" \
  "$RECIPIENT" \
  "$DEADLINE" \
  "$FACT_HASH" \
  "[$UID]" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

Record the payout tx hash.

## Final Verification

Verify the settlement:

```sh
ATTESTER=0x980abF154694Fe3Fea424eD095B04C6365E92F9b

cast call "$VAULT" "isPaid(bytes32)(bool)" "$CLAIM" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "balanceOf(bytes32)(uint256)" "$REPO_ID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$RECIPIENT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$ATTESTER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

For a single report payout with one verifier:

- Repo balance decreases by `50000` USDC units.
- Recipient receives `49000` USDC units.
- Verifier receives `1000` USDC units.
- `isPaid(claimId)` becomes `true`.

## What To Capture For Submission

For every live run, capture:

- Network and chain ID
- Vault address
- Fact receiver address
- Schema UID
- Claim ID
- Chainlink request and fulfill tx hashes
- EAS attestation UID and tx hash
- Payout tx hash
- Final `isPaid(claimId)` value
- Final recipient and verifier USDC balances
- Any caveat, especially whether payout was coordinator-driven or
  permissionless fallback

Update `docs/sepolia-demo.md` if the live proof changes.

## Troubleshooting

### Schema is missing

Run `demo/scripts/eas-register.ts` again. It is idempotent.

### `forge create` dry-runs instead of broadcasting

Add `--broadcast`.

### `requestFact(...)` reverts

Check:

- `GitHubFactReceiver.authorizer()`
- `GitHubFactReceiver.config()`
- Chainlink subscription has LINK
- Receiver is added as a consumer if it is a new receiver

### `pending` never returns a fact hash

Check:

```sh
cast call "$FACT_PROVIDER_ADDRESS" "requestIdOf(bytes32)(bytes32)" "$CLAIM" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$FACT_PROVIDER_ADDRESS" "getFact(bytes32)(bool,bytes)" "$CLAIM" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

If `getFact` is ready but the coordinator is stale, restart the coordinator
and resubmit the same claim. The claim ID is deterministic.

### Attestation exists but coordinator shows `sigs=0`

Verify the EAS attestation:

```sh
cast call 0x4200000000000000000000000000000000000021 \
  "getAttestation(bytes32)((bytes32,bytes32,uint64,uint64,uint64,bytes32,address,address,bool,bytes))" \
  "$UID" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Check that:

- Schema equals `X502_SCHEMA_UID`
- Attester equals the trusted wallet for agent `5260`
- Data contains the same `claimId`
- Data contains the same `factHash`
- Final bool is `true`

If all checks pass, use the permissionless payout fallback.

### Payout simulation reverts

Do not broadcast. Check:

- `isPaid(claimId)` is still `false`
- Fact is ready
- `keccak256(factBlob)` equals the attested `factHash`
- `ghAuthorBinding` equals the payout recipient
- Agent `5260` resolves to the attester wallet in ERC-8004
- Vault has enough repo balance
- Deadline has not expired
