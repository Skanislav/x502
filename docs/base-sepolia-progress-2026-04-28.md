# Base Sepolia Deployment Progress - 2026-04-28

Checkpoint captured at `2026-04-28 15:58:57 IST (+0530)`.

## Network

- Network: Base Sepolia
- Chain ID: `84532`
- RPC env: `BASE_SEPOLIA_RPC_URL`
- Repo slug: `skanislav/x502`
- Repo ID: `0x1492f36cb3574897acc481255a88821753bd0a710fd4c2d834c533af6913ca59`
- Deployer / repo owner / current verifier wallet: `0x980abF154694Fe3Fea424eD095B04C6365E92F9b`

## Deployed Contracts

- `BountyVault`: `0x8b414bde9F7EA00f58aD143937a31Ae7b8D0c338`
- `GitHubFactReceiver`: `0x8e4f147B51F1013aFa72B9b84EAB67893890edE6`
- Base Sepolia USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Chainlink Functions Router: `0xf9B8fc078197181C841c296C876945aaa425B278`
- ERC-8004 Identity Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Chainlink Functions subscription: `216`

## Current On-Chain State

- `GitHubFactReceiver.config()`:
  - subscription ID: `216`
  - callback gas limit: `300000`
  - DON ID: `fun-base-sepolia-1`
  - secrets slot ID: `0`
  - secrets version: `0`
- Chainlink consumer state for receiver on subscription `216`: `(true, 1, 1)`
  - consumer is allowed
  - one request initiated
  - one request completed
- ERC-8004 agent ID: `5260`
  - owner: `0x980abF154694Fe3Fea424eD095B04C6365E92F9b`
  - agent wallet: `0x980abF154694Fe3Fea424eD095B04C6365E92F9b`
- Vault repo config for `skanislav/x502`:
  - repo owner: `0x980abF154694Fe3Fea424eD095B04C6365E92F9b`
  - trusted agents: `[5260]`
  - threshold: `1`
  - prices, raw USDC units:
    - report: `5000000` (`5 USDC`)
    - triage: `2000000` (`2 USDC`)
    - fix: `10000000` (`10 USDC`)
    - docsTests: `8000000` (`8 USDC`)
  - verifier outcome fee: `100000` (`0.10 USDC`)
  - internal repo balance: `15000000` (`15 USDC`)
- Token balances:
  - deployer: `5000000` (`5 USDC`)
  - vault token balance: `15000000` (`15 USDC`)
  - vault internal repo balance: `15000000` (`15 USDC`)

## Environment Updates

`.env` was updated locally with deterministic deployment values. It is ignored by git.

Key values set:

- `CHAINLINK_SUBSCRIPTION_ID=216`
- `AUTHORIZER=0x980abF154694Fe3Fea424eD095B04C6365E92F9b`
- `VAULT_ADDRESS=0x8b414bde9F7EA00f58aD143937a31Ae7b8D0c338`
- `FACT_PROVIDER_ADDRESS=0x8e4f147B51F1013aFa72B9b84EAB67893890edE6`
- `X402_PAY_TO=0x980abF154694Fe3Fea424eD095B04C6365E92F9b`
- `VERIFIER_VAULT_ADDRESS=0x8b414bde9F7EA00f58aD143937a31Ae7b8D0c338`
- `VERIFIER_AGENT_ID=5260`
- `RPC_URL=$BASE_SEPOLIA_RPC_URL`

`PRIVATE_KEY`, `COORDINATOR_PRIVATE_KEY`, and `VERIFIER_PRIVATE_KEY` are present in `.env` and were not copied into this document.

## Transactions

All status values below were checked with `cast receipt` against Base Sepolia. `0x1` means success.

| Step | Tx hash | Block | Status | Gas used | Notes |
|---|---|---:|---:|---:|---|
| Deploy `GitHubFactReceiver` | `0xd500c060ee088194895d3c0c886078122fb29058e5471fb702e369ff8d2496a7` | `0x26e912b` | `0x1` | `0x11d00` | Receiver at `0x8e4f147B51F1013aFa72B9b84EAB67893890edE6` |
| `GitHubFactReceiver.setSource` | `0x3c276e794edae82ccb7e4a750378b1fa2756aa985321860d7d041cc9fa98705b` | `0x26e912b` | `0x1` | `0x1a8082` | Uploaded inline Chainlink source |
| `GitHubFactReceiver.setConfig` | `0x9ca1ee4a9e47b0d8e8b77d96fb5975dbfdc6d7cab7586a20a6318bd28354c288` | `0x26e912b` | `0x1` | `0x1a9961` | Set subscription `216`, DON ID, gas limit |
| `GitHubFactReceiver.setAuthorizer` | `0xd5a58e8c98d4f223f42568fa3b3f20c83914627d06f0eba048fe0fab413f1843` | `0x26e912b` | `0x1` | `0x6a77` | Authorizer is deployer wallet |
| Deploy `BountyVault` | `0x88746f93a63d77c77998ea281e3ed85108fabc1521c05042cef2268c20489071` | `0x26e912b` | `0x1` | `0x2fd2a3` | Vault at `0x8b414bde9F7EA00f58aD143937a31Ae7b8D0c338` |
| Add receiver as Chainlink consumer | `0x2d276fb9393819ae6f566c6dfc82dd11bb6456c544b9b88dc72cfd9360b8aca9` | `0x26e913b` | `0x1` | `0x169a9` | Router consumer allowlist updated |
| Initial repo config with placeholder agent `101` | `0xa1fa170a6bdee582659f40afc6c75564b068afa37ca71fb066b7621e6999476c` | `0x26e95b0` | `0x1` | `0x3c5f7` | Superseded by agent `5260` config |
| Approve `15 USDC` to vault | `0xe757449725095093a868c2620b9f9dadef926a8b9dcd111596576fab48b89cb3` | `0x26e95b3` | `0x1` | `0xd88d` | USDC allowance for deposit |
| Deposit `15 USDC` into vault | `0x8a87814c5d255afaeab77623568a3a70a074634f4f8513eac99c8d5ca29bf737` | `0x26e95b7` | `0x1` | `0x16b32` | Internal repo balance updated |
| Register ERC-8004 agent | `0x116c9a64758b32f88bb67421558a6adc7f9d85a617c82c1942ab29ec2fe7a8a9` | `0x26e95e9` | `0x1` | `0x1a183` | Minted agent ID `5260` |
| Reconfigure repo to trust `5260` | `0x1dda28f5acfeb45e9d3523529609182537f61c35dfe6f0a44e2cfce73043d6c1` | `0x26e95f3` | `0x1` | `0xc672` | Current trusted agent list is `[5260]` |
| Request Chainlink fact for issue `#2` | `0xcff0ec798d6e87a90b9741d4339c46a60f0e290aa92db48410ffb13beba364ae` | `0x26e961a` | `0x1` | `0xb9cec` | Request ID `0x37f2c31e80d0358cee7105ac83742749318cc484f81d0900561b5e3f57fb16fa` |
| Chainlink fulfillment callback | `0x0119459180388aafc8a879760947880d31a6cc7f5359c480397d8f924037acd5` | `0x26e961e` | `0x1` | `0x35df8` | Fulfilled with error, no fact stored |

## Current Smoke Claim

- Repo: `skanislav/x502`
- GitHub external ID: issue `#2`
- Kind: `report` (`0`)
- Claim ID: `0x132167063b9157ad05743480c326f1fe594001c9ae119d3460af0e9d55153847`
- Chainlink request ID: `0x37f2c31e80d0358cee7105ac83742749318cc484f81d0900561b5e3f57fb16fa`
- `requestIdOf(claimId)`: `0x37f2c31e80d0358cee7105ac83742749318cc484f81d0900561b5e3f57fb16fa`
- `getFact(claimId)`: `false, 0x`
- `isPaid(claimId)`: `false`

The Chainlink fulfillment emitted `FactFulfilled` with an empty `factBlob` and this error:

```text
Exec Error: syntax error, RAM exceeded, or other error
```

That means the request reached Chainlink and called back on-chain, but the Functions JavaScript did not successfully produce the encoded fact. No payout was attempted.

## Local Runtime State

- Verifier service is running and answered `GET http://localhost:9000/health`.
- Health response:

```json
{"ok":true,"agentId":"5260","address":"0x980abF154694Fe3Fea424eD095B04C6365E92F9b","vault":"0x8b414bde9F7EA00f58aD143937a31Ae7b8D0c338","chainId":84532}
```

## Local Repo State

- Modified:
  - `contracts/foundry.toml`
    - Added read permission for `../chainlink/source.js`, required by the deploy script.
- Untracked:
  - `contracts/broadcast/`
    - Contains Foundry broadcast artifacts for the Base Sepolia deployment.
- Ignored but updated:
  - `.env`

## Next Steps

1. Fix or reduce the Chainlink Functions JavaScript source so it runs within the DON runtime.
   - Current error is `Exec Error: syntax error, RAM exceeded, or other error`.
   - Likely area to inspect: `chainlink/source.js` and the generated bundle size/imports.
2. Rebuild `chainlink/source.js` if source files change.
3. Call `GitHubFactReceiver.setSource(...)` again via the deployer after rebuilding.
4. Retry `requestFact` for the same claim ID or a new test claim.
5. Once `getFact(claimId)` returns `true`, obtain the verifier signature and call `BountyVault.payout`.
