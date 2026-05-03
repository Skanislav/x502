# Base Sepolia Demo Proof - 2026-05-03

This document captures the live Base Sepolia run used to prove the current
EAS-based x502 settlement path. It is the current demo proof; the older
`docs/base-sepolia-progress-2026-04-28.md` describes a previous pre-EAS vault.

## Summary

- Network: Base Sepolia
- Chain ID: `84532`
- Repo: `skanislav/x502`
- Repo ID: `0x1492f36cb3574897acc481255a88821753bd0a710fd4c2d834c533af6913ca59`
- Claim kind: `report` (`0`)
- GitHub external ID: issue `#2`
- Claim ID: `0x132167063b9157ad05743480c326f1fe594001c9ae119d3460af0e9d55153847`
- Claimant / payout recipient: `0xc2603c34e6C50E1389a008764A05Ac24919Bc3B3`
- Repo owner / deployer / live verifier wallet: `0x980abF154694Fe3Fea424eD095B04C6365E92F9b`
- Trusted verifier ERC-8004 agent ID: `5260`

## Contracts

| Contract / service | Address / ID | Notes |
|---|---|---|
| Current `BountyVault` | `0x951395a508ddF903e8F766960c93D94120F30877` | Fresh current-code vault deployed for this EAS demo |
| Reused `GitHubFactReceiver` | `0x8e4f147B51F1013aFa72B9b84EAB67893890edE6` | Existing Chainlink Functions consumer |
| EAS | `0x4200000000000000000000000000000000000021` | Canonical Base Sepolia/Superchain predeploy |
| EAS SchemaRegistry | `0x4200000000000000000000000000000000000020` | Used to register the x502 attestation schema |
| x502 schema UID | `0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6` | Schema string: `bytes32 claimId,bytes32 factHash,bool accept` |
| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 decimals |
| ERC-8004 Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | Agent `5260` resolves to verifier wallet |
| Chainlink Functions Router | `0xf9B8fc078197181C841c296C876945aaa425B278` | Router used by the reused receiver |
| Chainlink Functions subscription | `216` | Existing subscription used by receiver |

## Current Vault Wiring

Read from `0x951395a508ddF903e8F766960c93D94120F30877` after deployment:

| Getter | Value |
|---|---|
| `usdc()` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| `agentRegistry()` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| `factProvider()` | `0x8e4f147B51F1013aFa72B9b84EAB67893890edE6` |
| `eas()` | `0x4200000000000000000000000000000000000021` |
| `schemaUID()` | `0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6` |

Repo config for `skanislav/x502`:

| Field | Value |
|---|---|
| Owner | `0x980abF154694Fe3Fea424eD095B04C6365E92F9b` |
| Trusted agents | `[5260]` |
| Threshold | `1` |
| Report price | `50000` USDC units (`0.05 USDC`) |
| Triage price | `20000` USDC units (`0.02 USDC`) |
| Fix price | `500000` USDC units (`0.5 USDC`) |
| Docs/tests price | `300000` USDC units (`0.3 USDC`) |
| Outcome fee per verifier | `1000` USDC units (`0.001 USDC`) |
| Initial deposit | `2000000` USDC units (`2 USDC`) |

## Transaction Ledger

All transactions below were checked against Base Sepolia. `status = 1` means
the transaction succeeded.

| Step | Tx hash | Block | Status | Gas used | Notes |
|---|---|---:|---:|---:|---|
| Register x502 EAS schema | `0x3e8a6081e3b32eca33d97600ccf31449fc337e5d67bdaea4aa762cfce1d1a9c2` | `41024663` | `1` | `144307` | Registered schema UID `0x5dcd6b...65e3c6` |
| Deploy current `BountyVault` | `0x013f1a3d4105b05e16c253d45d7f87f879f9e2ab0c8271fae627d7a4b082d91a` | `41024680` | `1` | `1303568` | Vault at `0x951395a5...20F30877` |
| Configure repo | `0x24da43459c7e83ee4f3cf356d6e01e5947307be443f9756573069d99c0600090` | `41024707` | `1` | `247025` | Trusted agent `[5260]`, threshold `1` |
| Approve `2 USDC` | `0x967f89cb3df8b3146ed2d268e8b6132a17e6cc9cf67db7ae0f14fced6a178ac7` | `41024733` | `1` | `55437` | USDC allowance from deployer to vault |
| Deposit `2 USDC` | `0xef6ac0e5621ba599c73ad7d62b333b75ef808a4b02eb17fcea58638885d447fd` | `41024737` | `1` | `92649` | Vault internal repo balance became `2000000` |
| Chainlink fact request 1 | `0x5a77e79d2aabaf61f068af1a8e77bffc686c36a8735cf97e1f1406088672ed61` | `41024816` | `1` | `806798` | Request ID `0xbcc25880...bf528` |
| Chainlink fact fulfill 1 | `0x47ce4587e6650f621741e984b7fea69b92eaf373c87fe1549221ca6dbaf5378c` | `41024821` | `1` | `296108` | Stored fact for claim ID |
| Chainlink fact request 2 | `0x26d7f4d0c78651e4405b7fdb86cdc2beb7e40229afa771ac09fe6b4b555281ce` | `41024868` | `1` | `806798` | Request ID `0xaa6ddb3f...656331`; created after coordinator restart |
| Chainlink fact fulfill 2 | `0x5fcd96a986e3b9406c8778f3b5a2334963270204aef7137d1475804cd632a357` | `41024872` | `1` | `236384` | Latest `requestIdOf(claimId)` points here |
| Publish EAS attestation | `0x83168e5e3cc84d5bb819cfa59da64a2a685f3e91857b5f438807b86ac8eccd07` | `41024875` | `1` | `239767` | Attestation UID `0xb631d99e...13947b4d` |
| Vault payout | `0x8dda84901de003747a6966d53f71f67be6ea4c9bdb78fdbf798bd4c04af97193` | `41024924` | `1` | `188843` | Paid claimant and verifier outcome fee |

Useful explorer links:

- Payout tx: `https://sepolia.basescan.org/tx/0x8dda84901de003747a6966d53f71f67be6ea4c9bdb78fdbf798bd4c04af97193`
- EAS attestation: `https://base-sepolia.easscan.org/attestation/view/0xb631d99e432b8def12d9cba441cd87b0e14e34b978f393f76fac8c9e13947b4d`
- Vault address: `https://sepolia.basescan.org/address/0x951395a508ddF903e8F766960c93D94120F30877`
- Fact receiver address: `https://sepolia.basescan.org/address/0x8e4f147B51F1013aFa72B9b84EAB67893890edE6`

## Claim Fact

Current receiver state:

- `requestIdOf(claimId)`: `0xaa6ddb3f531b326e545db1953d249c02d81292ef6a31201dcf2f1e9cda656331`
- `getFact(claimId).ready`: `true`
- Fact hash used for the final attestation and payout:
  `0xbae70480321e51abc32665085966a6f7c44fc7bf4cbda31849af9c9eccb3d0bc`

Decoded fact blob:

| Field | Value |
|---|---|
| `status` | `1` |
| `mergedBlock` | `0` |
| `labelMask` | `0x0000000000000000000000000000000000000000000000000000000000000001` |
| `ghAuthorBinding` | `0xc2603c34e6C50E1389a008764A05Ac24919Bc3B3` |

Raw fact blob:

```text
0x0000000000000000000000000000000000000000000000000000000000000001
  0000000000000000000000000000000000000000000000000000000000000000
  0000000000000000000000000000000000000000000000000000000000000001
  000000000000000000000000c2603c34e6c50e1389a008764a05ac24919bc3b3
```

## EAS Attestation

- UID: `0xb631d99e432b8def12d9cba441cd87b0e14e34b978f393f76fac8c9e13947b4d`
- Schema: `0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6`
- Attester: `0x980abF154694Fe3Fea424eD095B04C6365E92F9b`
- Recipient in EAS attestation: `0x0000000000000000000000000000000000000000`
- Revocable: `true`
- Encoded attestation data:

```text
0x132167063b9157ad05743480c326f1fe594001c9ae119d3460af0e9d55153847
  bae70480321e51abc32665085966a6f7c44fc7bf4cbda31849af9c9eccb3d0bc
  0000000000000000000000000000000000000000000000000000000000000001
```

The encoded tuple is `(claimId, factHash, accept=true)`.

## Live EAS Event Log

The attestation transaction emitted the real Base Sepolia EAS `Attested`
event. This is the raw receipt log decoded from transaction
`0x83168e5e3cc84d5bb819cfa59da64a2a685f3e91857b5f438807b86ac8eccd07`.

| Field | Value |
|---|---|
| Block | `41024875` |
| Timestamp | `2026-05-03 14:20:38 UTC` |
| Log index | `0x114` |
| EAS address | `0x4200000000000000000000000000000000000021` |
| Event signature | `Attested(address,address,bytes32,bytes32)` |
| Topic 0 | `0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35` |
| Indexed recipient | `0x0000000000000000000000000000000000000000` |
| Indexed attester | `0x980abF154694Fe3Fea424eD095B04C6365E92F9b` |
| Indexed schema | `0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6` |
| Data / UID | `0xb631d99e432b8def12d9cba441cd87b0e14e34b978f393f76fac8c9e13947b4d` |

Raw log:

```json
{
  "address": "0x4200000000000000000000000000000000000021",
  "topics": [
    "0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x000000000000000000000000980abf154694fe3fea424ed095b04c6365e92f9b",
    "0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6"
  ],
  "data": "0xb631d99e432b8def12d9cba441cd87b0e14e34b978f393f76fac8c9e13947b4d",
  "blockNumber": "0x271fd6b",
  "blockTimestamp": "0x69f759b6",
  "transactionHash": "0x83168e5e3cc84d5bb819cfa59da64a2a685f3e91857b5f438807b86ac8eccd07",
  "transactionIndex": "0xa",
  "logIndex": "0x114",
  "removed": false
}
```

## Final On-Chain State

Verified after payout:

| Check | Value |
|---|---|
| `BountyVault.isPaid(claimId)` | `true` |
| Vault internal repo balance | `1950000` USDC units (`1.95 USDC`) |
| Vault USDC token balance | `1950000` USDC units (`1.95 USDC`) |
| Claimant USDC balance after run | `49000` USDC units (`0.049 USDC`) |
| Verifier/deployer USDC balance after run | `8001000` USDC units (`8.001 USDC`) |

The payout transaction transferred:

- `49000` USDC units (`0.049 USDC`) to
  `0xc2603c34e6C50E1389a008764A05Ac24919Bc3B3`
- `1000` USDC units (`0.001 USDC`) to
  `0x980abF154694Fe3Fea424eD095B04C6365E92F9b`

## Demo Caveat

The original live coordinator opened the claim and requested the Chainlink
fact, but its EAS watcher did not observe the live EAS attestation log in
time. The settlement was completed by calling the vault's permissionless
`payout(...)` directly with the valid attestation UID after a successful
`cast call` simulation.

The current coordinator now backfills recent EAS `Attested` logs when the
watcher starts, then keeps the live subscription open. That makes the demo
more tolerant of restart or RPC polling gaps while preserving the same
on-chain validation path.

This still proves the live Base Sepolia contract path:

1. EAS schema registered on Base Sepolia.
2. Current vault deployed and configured with EAS + SchemaRegistry-derived UID.
3. Chainlink Functions fact stored on the reused receiver.
4. Verifier wallet published an EAS attestation under the x502 schema.
5. `BountyVault.payout(...)` validated the fact, schema, attestation data,
   trusted ERC-8004 agent wallet, recipient binding, and transferred USDC.

For a staged UI walkthrough, use the local demo UI for the animated flow and
then show the Base Sepolia transaction hashes above as real-network proof.

## Verification Commands

Use these commands from the repo root. They assume `.env` contains
`BASE_SEPOLIA_RPC_URL`. Do not print private keys.

```sh
VAULT=0x951395a508ddF903e8F766960c93D94120F30877
FACT=0x8e4f147B51F1013aFa72B9b84EAB67893890edE6
EAS=0x4200000000000000000000000000000000000021
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
REPO_ID=0x1492f36cb3574897acc481255a88821753bd0a710fd4c2d834c533af6913ca59
CLAIM=0x132167063b9157ad05743480c326f1fe594001c9ae119d3460af0e9d55153847
UID=0xb631d99e432b8def12d9cba441cd87b0e14e34b978f393f76fac8c9e13947b4d
RECIPIENT=0xc2603c34e6C50E1389a008764A05Ac24919Bc3B3
ATTESTER=0x980abF154694Fe3Fea424eD095B04C6365E92F9b

cast call "$VAULT" "isPaid(bytes32)(bool)" "$CLAIM" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$VAULT" "balanceOf(bytes32)(uint256)" "$REPO_ID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$FACT" "requestIdOf(bytes32)(bytes32)" "$CLAIM" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$FACT" "getFact(bytes32)(bool,bytes)" "$CLAIM" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$EAS" "getAttestation(bytes32)((bytes32,bytes32,uint64,uint64,uint64,bytes32,address,address,bool,bytes))" "$UID" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast receipt 0x83168e5e3cc84d5bb819cfa59da64a2a685f3e91857b5f438807b86ac8eccd07 --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$USDC" "balanceOf(address)(uint256)" "$RECIPIENT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$USDC" "balanceOf(address)(uint256)" "$ATTESTER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```
