# Codebase Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise meaningful automated coverage near 100% for first-party runtime code while keeping generated, deploy-only, live-service, and JSX-rendering exclusions explicit.

**Architecture:** Use characterization-first TDD across existing module boundaries. Add Vitest V8 coverage for TypeScript/JavaScript, Foundry coverage for Solidity, and small pure helper extractions for Chainlink, demo CLI, and web page behavior. Keep current-behavior tests named and commented so future intent-alignment changes can update them deliberately.

**Tech Stack:** Foundry, Solidity 0.8.26, Vitest 2, V8 coverage provider, TypeScript ES modules, Hono, viem, Next.js, Chainlink Functions Deno wrapper.

---

## Reference Inputs

- Design spec: `docs/superpowers/specs/2026-04-28-codebase-coverage-design.md`
- Current behavior review: `USER_FLOW.md`
- Current worktree note: `contracts/foundry.lock` is modified by the baseline coverage run and must be handled first.

## Conventions

- Tests that pin known-divergent behavior use both:
  - test name prefix `currentBehavior_`
  - header comment citing the relevant `USER_FLOW.md` "Current vs. intent" callout
- Do not include `packages/shared/src/abis.ts`, `contracts/script/Deploy.s.sol`, `packages/*/src/main.ts`, or post-extraction `packages/web/app/page.tsx` in strict thresholds.
- Prefer characterization tests for existing behavior. Use classic red-green-refactor for helper extraction and bug fixes.
- Commit after each task. Keep commits scoped to the listed files.

## File Structure

- Modify: `contracts/foundry.lock` for deterministic Forge dependency baseline.
- Modify: `package.json` and package `package.json` files for coverage scripts.
- Create or modify: `packages/*/vitest.config.ts`, `demo/vitest.config.ts`, `chainlink/vitest.config.ts`.
- Modify: `contracts/test/BountyVaultEdges.t.sol`, `contracts/test/GitHubFactReceiver.t.sol`.
- Modify: `packages/shared/test/claim-id.test.ts`; create `packages/shared/test/eip712.test.ts`.
- Modify: `packages/verifier-agent/test/server.test.ts`, `kinds.test.ts`, `wallet.test.ts`; create `packages/verifier-agent/test/claude-policy.test.ts`.
- Create coordinator adapter tests under `packages/coordinator/test/`.
- Create web tests under `packages/web/test/`; create `packages/web/lib/claim-ui.ts`.
- Create demo helper/test files under `demo/scripts/` and `demo/test/`.
- Create `chainlink/source-core.js`, `chainlink/source-wrapper.js`, `chainlink/build-source.mjs`, `chainlink/package.json`, and `chainlink/test/source-core.test.mjs`; regenerate `chainlink/source.js`.

---

### Task 0: Pin Foundry Dependency Baseline

**Files:**
- Modify: `contracts/foundry.lock`

- [ ] **Step 1: Verify the lockfile diff is only the expected dependency baseline**

Run:

```bash
git diff -- contracts/foundry.lock
git submodule status --recursive
```

Expected final `contracts/foundry.lock` content:

```json
{
  "lib/chainlink-brownie-contracts": {
    "rev": "5cb41fbc9b525338b6098da5ea7dd0b7e92f89e4"
  },
  "lib/forge-std": {
    "tag": {
      "name": "v1.16.0",
      "rev": "8987040ede9553cea20c95ad40d0455930f9c8e0"
    }
  },
  "lib/openzeppelin-contracts": {
    "rev": "c64a1edb67b6e3f4a15cca8909c9482ad33a02b0"
  }
}
```

Expected submodule revisions include the same two hashes.

- [ ] **Step 2: Commit only the lockfile baseline**

Run:

```bash
git add contracts/foundry.lock
git commit -m "chore(contracts): pin forge dependency lockfile"
```

- [ ] **Step 3: Verify no uncommitted lockfile drift remains**

Run:

```bash
git status --short
```

Expected: no `contracts/foundry.lock` entry.

---

### Task 1: Add Coverage Tooling

**Files:**
- Modify: `package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/verifier-agent/package.json`
- Modify: `packages/coordinator/package.json`
- Modify: `packages/web/package.json`
- Modify: `demo/package.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/verifier-agent/vitest.config.ts`
- Create: `packages/web/vitest.config.ts`
- Create: `chainlink/vitest.config.ts`
- Modify: `packages/coordinator/vitest.config.ts`
- Modify: `demo/vitest.config.ts`

- [ ] **Step 1: Confirm coverage currently fails because the provider is missing**

Run:

```bash
pnpm --filter @x502/shared exec vitest run --coverage
```

Expected: command fails with missing `@vitest/coverage-v8`.

- [ ] **Step 2: Install the coverage provider**

Run:

```bash
pnpm add -D -w @vitest/coverage-v8
```

- [ ] **Step 3: Add package coverage scripts**

Edit the package scripts to include these exact script names.

Root `package.json` scripts:

```json
{
  "test": "pnpm test:contracts && pnpm test:ts",
  "test:contracts": "cd contracts && forge test",
  "test:ts": "pnpm --filter @x502/shared exec vitest run && pnpm --filter @x502/verifier-agent exec vitest run && pnpm --filter @x502/coordinator exec vitest run",
  "test:coverage": "pnpm test:coverage:contracts && pnpm test:coverage:ts",
  "test:coverage:contracts": "cd contracts && forge coverage --report summary",
  "test:coverage:ts": "pnpm --filter @x502/shared run test:coverage && pnpm --filter @x502/verifier-agent run test:coverage && pnpm --filter @x502/coordinator run test:coverage"
}
```

Each TS package script:

```json
{
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 4: Add Vitest coverage configs**

Create `packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["src/abis.ts", "scripts/**", "dist/**"],
    },
  },
});
```

Create `packages/verifier-agent/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["src/main.ts", "dist/**"],
    },
  },
});
```

Modify `packages/coordinator/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["src/main.ts", "dist/**"],
    },
  },
});
```

Create `packages/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["app/page.tsx", "app/layout.tsx", ".next/**", "dist/**"],
    },
  },
});
```

Modify `demo/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["fix/**"],
    },
  },
});
```

Create `chainlink/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["chainlink/test/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["chainlink/source-core.js"],
      exclude: ["chainlink/source.js"],
    },
  },
});
```

Do not add web, demo, or chainlink to the root `test:ts` and `test:coverage:ts` scripts in this task. Task 10 wires them into the root commands after their test files exist.

- [ ] **Step 5: Run the config-only checks**

Run:

```bash
pnpm --filter @x502/shared exec vitest run --coverage
pnpm --filter @x502/coordinator exec vitest run --coverage
```

Expected: both commands run and report coverage. Low percentages are accepted at this point.

- [ ] **Step 6: Commit coverage tooling**

Run:

```bash
git add package.json pnpm-lock.yaml packages/*/package.json packages/*/vitest.config.ts demo/package.json demo/vitest.config.ts chainlink/vitest.config.ts
git commit -m "test: add coverage tooling"
```

---

### Task 2: Expand Solidity Contract Coverage

**Files:**
- Modify: `contracts/test/BountyVaultEdges.t.sol`
- Modify: `contracts/test/GitHubFactReceiver.t.sol`

- [ ] **Step 1: Add BountyVault edge tests**

Append focused tests to `contracts/test/BountyVaultEdges.t.sol`. Use existing helpers where possible. Include this current-behavior test header:

```solidity
// Current behavior pinned from USER_FLOW.md "Current vs. intent":
// the vault checks keccak256(factBlob) == factHash and verifier signatures,
// but it does not decode or enforce factBlob.status == 1.
function test_currentBehavior_payoutAcceptsStatusZero() public {
    uint256 externalId = 500;
    BountyVault.Kind kind = BountyVault.Kind.Fix;
    bytes32 cid = Attestations.claimId(REPO_A, externalId, uint8(kind));
    bytes memory factBlob = abi.encode(uint8(0), uint64(0), bytes32(0), claimant);
    factProvider.mockFulfill(cid, factBlob);

    uint256 deadline = block.timestamp + 1 hours;
    Attestations.Attestation memory att = Attestations.Attestation({
        claimId: cid, recipient: claimant, deadline: deadline, factHash: keccak256(factBlob)
    });
    uint256[] memory ids = new uint256[](2);
    ids[0] = agentIds[0];
    ids[1] = agentIds[1];
    bytes[] memory sigs = new bytes[](2);
    sigs[0] = _sign(agentKeys[0], att);
    sigs[1] = _sign(agentKeys[1], att);

    vault.payout(REPO_A, externalId, kind, claimant, deadline, keccak256(factBlob), ids, sigs);

    assertTrue(vault.isPaid(cid));
}
```

Add these tests in the same file:

```solidity
function test_configureRepo_revertsWhenThresholdZero() public {
    vm.prank(makeAddr("zeroThresholdOwner"));
    vm.expectRevert(BountyVault.ThresholdZero.selector);
    vault.configureRepo(keccak256("repo/zero"), agentIds, 0, prices, OUTCOME_FEE);
}

function test_deposit_revertsForUnconfiguredRepo() public {
    usdc.mint(address(this), 1);
    usdc.approve(address(vault), 1);
    vm.expectRevert(BountyVault.RepoNotConfigured.selector);
    vault.deposit(keccak256("missing"), 1);
}

function test_withdraw_revertsWhenBalanceTooLow() public {
    vm.prank(vault.repoOwnerOf(REPO_A));
    vm.expectRevert(BountyVault.InsufficientRepoBalance.selector);
    vault.withdraw(REPO_A, DEPOSIT + 1);
}

function test_withdraw_succeedsForRepoOwner() public {
    address owner = vault.repoOwnerOf(REPO_A);
    uint256 beforeOwner = usdc.balanceOf(owner);
    vm.prank(owner);
    vault.withdraw(REPO_A, 123);
    assertEq(usdc.balanceOf(owner) - beforeOwner, 123);
    assertEq(vault.balanceOf(REPO_A), DEPOSIT - 123);
}

function test_payout_revertsOnLengthMismatch() public {
    uint256[] memory ids = new uint256[](1);
    bytes[] memory sigs = new bytes[](0);
    vm.expectRevert(BountyVault.LengthMismatch.selector);
    vault.payout(REPO_A, 600, BountyVault.Kind.Fix, claimant, block.timestamp + 1 hours, bytes32(0), ids, sigs);
}

function test_payout_revertsOnPriceUnderflow() public {
    BountyVault.Prices memory tiny = BountyVault.Prices({report: 1, triage: 1, fix: 1, docsTests: 1});
    bytes32 repo = keccak256("repo/underflow");
    address owner = makeAddr("underflowOwner");
    vm.prank(owner);
    vault.configureRepo(repo, agentIds, 2, tiny, 1);
    usdc.mint(owner, 100);
    vm.startPrank(owner);
    usdc.approve(address(vault), 100);
    vault.deposit(repo, 100);
    vm.stopPrank();
    vm.expectRevert(BountyVault.PriceUnderflow.selector);
    _payHappyKind(repo, 601, BountyVault.Kind.Fix, claimant);
}
```

Add view coverage:

```solidity
function test_views_coverRepoConfigAndEip712() public view {
    assertEq(vault.thresholdOf(REPO_A), 2);
    assertEq(vault.outcomeFeeOf(REPO_A), OUTCOME_FEE);
    uint256[] memory trusted = vault.trustedAgentsOf(REPO_A);
    assertEq(trusted.length, agentIds.length);
    assertEq(trusted[0], agentIds[0]);
    assertEq(vault.priceOf(REPO_A, BountyVault.Kind.Report), prices.report);
    assertEq(vault.priceOf(REPO_A, BountyVault.Kind.Triage), prices.triage);
    assertEq(vault.priceOf(REPO_A, BountyVault.Kind.Fix), prices.fix);
    assertEq(vault.priceOf(REPO_A, BountyVault.Kind.DocsTests), prices.docsTests);
    assertTrue(vault.domainSeparator() != bytes32(0));
}
```

- [ ] **Step 2: Run the BountyVault tests**

Run:

```bash
cd contracts && forge test --match-contract BountyVaultEdgesTest
```

Expected: failures only from test code that needs local syntax correction. Fix test syntax without changing production behavior unless a real bug is exposed.

- [ ] **Step 3: Add GitHubFactReceiver coverage**

Append tests to `contracts/test/GitHubFactReceiver.t.sol`:

```solidity
function test_constructor_setsOwnerAsAuthorizer() public view {
    assertEq(receiver.owner(), owner);
    assertEq(receiver.authorizer(), authorizer);
}

function test_transferOwnership_emitsAndChangesOwner() public {
    address next = makeAddr("nextOwner");
    vm.prank(owner);
    vm.expectEmit(true, true, false, true, address(receiver));
    emit GitHubFactReceiver.OwnershipTransferred(owner, next);
    receiver.transferOwnership(next);
    assertEq(receiver.owner(), next);
}

function test_setSource_emitsLengthAndStoresSource() public {
    vm.prank(owner);
    vm.expectEmit(false, false, false, true, address(receiver));
    emit GitHubFactReceiver.SourceUpdated(11);
    receiver.setSource("hello world");
    assertEq(receiver.source(), "hello world");
}

function test_setAuthorizer_emitsAndStores() public {
    address next = makeAddr("nextAuthorizer");
    vm.prank(owner);
    vm.expectEmit(true, false, false, true, address(receiver));
    emit GitHubFactReceiver.AuthorizerSet(next);
    receiver.setAuthorizer(next);
    assertEq(receiver.authorizer(), next);
}

function test_requestFact_allowsZeroExternalIdAndSecretsConfig() public {
    vm.startPrank(owner);
    receiver.setConfig(8, 400_000, bytes32("don"), 3, 9);
    vm.stopPrank();

    vm.prank(authorizer);
    bytes32 requestId = receiver.requestFact(CLAIM_ID, "foo/bar", 0, 0);
    assertEq(receiver.claimIdOfRequest(requestId), CLAIM_ID);
}

function test_getFact_emptyState() public view {
    (bool ready, bytes memory blob) = receiver.getFact(keccak256("missing"));
    assertFalse(ready);
    assertEq(blob.length, 0);
}
```

- [ ] **Step 4: Run contract tests and coverage**

Run:

```bash
cd contracts && forge test
cd contracts && forge coverage --report summary
```

Expected: tests pass; core contract coverage increases. `Deploy.s.sol` remains outside the strict target.

- [ ] **Step 5: Commit contract coverage**

Run:

```bash
git add contracts/test/BountyVaultEdges.t.sol contracts/test/GitHubFactReceiver.t.sol
git commit -m "test(contracts): cover vault and fact receiver edges"
```

---

### Task 3: Expand Shared Package Coverage

**Files:**
- Modify: `packages/shared/test/claim-id.test.ts`
- Create: `packages/shared/test/eip712.test.ts`

- [ ] **Step 1: Add claim-id and kind mapping tests**

Add to `packages/shared/test/claim-id.test.ts`:

```ts
describe("Kind mappings", () => {
  it("maps enum values to canonical wire names", () => {
    expect(KindName[Kind.Report]).toBe("report");
    expect(KindName[Kind.Triage]).toBe("triage");
    expect(KindName[Kind.Fix]).toBe("fix");
    expect(KindName[Kind.DocsTests]).toBe("docs_tests");
  });
});

describe("repoIdFromSlug", () => {
  it("uses github.com prefix and is case-sensitive", () => {
    expect(repoIdFromSlug("x502-protocol/demo")).toBe(
      "0x88864a76c02eb12528b373ff117dd41eb00f2030837d76a5af79da1fe3df6800",
    );
    expect(repoIdFromSlug("X502-protocol/demo")).not.toBe(repoIdFromSlug("x502-protocol/demo"));
  });

  it("does not normalize a github.com/ prefix supplied by the caller", () => {
    expect(repoIdFromSlug("github.com/x502-protocol/demo")).not.toBe(
      repoIdFromSlug("x502-protocol/demo"),
    );
  });
});
```

- [ ] **Step 2: Add EIP-712 typed-data tests**

Create `packages/shared/test/eip712.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ATTESTATION_TYPES,
  attestationDomain,
  attestationTypedData,
  deriveClaimId,
  repoIdFromSlug,
  Kind,
} from "../src/index.js";

const VAULT = "0x1111111111111111111111111111111111111111" as const;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as const;
const FACT_HASH = `0x${"ab".repeat(32)}` as const;

describe("attestation typed data", () => {
  it("builds the expected domain and message", () => {
    const claimId = deriveClaimId(repoIdFromSlug("x502-protocol/demo"), 42n, Kind.Fix);
    const att = { claimId, recipient: RECIPIENT, deadline: 123n, factHash: FACT_HASH };
    const td = attestationTypedData(84532, VAULT, att);
    expect(td.domain).toEqual(attestationDomain(84532, VAULT));
    expect(td.types).toBe(ATTESTATION_TYPES);
    expect(td.primaryType).toBe("Attestation");
    expect(td.message).toBe(att);
  });

  it("recovers the signer from the typed data", async () => {
    const account = privateKeyToAccount(
      "0x59c6995e998f97a5a004497e5da2c071b89c3e064a3fbd821d5f9b988e5b0c0d",
    );
    const claimId = deriveClaimId(repoIdFromSlug("x502-protocol/demo"), 42n, Kind.Fix);
    const att = { claimId, recipient: RECIPIENT, deadline: 123n, factHash: FACT_HASH };
    const td = attestationTypedData(84532, VAULT, att);
    const signature = await account.signTypedData(td);
    const recovered = await recoverTypedDataAddress({ ...td, signature });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});
```

- [ ] **Step 3: Run shared tests and coverage**

Run:

```bash
pnpm --filter @x502/shared exec vitest run
pnpm --filter @x502/shared run test:coverage
```

Expected: tests pass; coverage excludes `src/abis.ts`.

- [ ] **Step 4: Commit shared coverage**

Run:

```bash
git add packages/shared/test packages/shared/vitest.config.ts packages/shared/package.json
git commit -m "test(shared): cover typed data and repo vectors"
```

---

### Task 4: Expand Verifier Server and Policy Coverage

**Files:**
- Modify: `packages/verifier-agent/test/server.test.ts`
- Modify: `packages/verifier-agent/test/kinds.test.ts`
- Create: `packages/verifier-agent/test/sign.test.ts`
- Create: `packages/verifier-agent/test/claude-policy.test.ts`

- [ ] **Step 1: Tighten unknown repo behavior**

Replace the permissive assertion in `packages/verifier-agent/test/kinds.test.ts` with a resolver that returns `undefined`:

```ts
it("404s on unknown repoId", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = createWalletClient({ account, chain: foundry, transport: http() });
  const app = buildVerifierApp({
    signer: { agentId: 100n, vault: VAULT, chainId: foundry.id, account, wallet },
    policy: new AcceptAllPolicy(),
    repoSlugResolver: () => undefined,
  });
  const r = await postVerify(app, {
    repoId: `0x${"ee".repeat(32)}`,
    externalId: "1",
    kind: Kind.Report,
    recipient: RECIPIENT,
    deadline: "9999999999",
    factHash: `0x${"cd".repeat(32)}`,
  });
  expect(r.status).toBe(404);
});
```

- [ ] **Step 2: Add validation branch cases**

Add table tests in `packages/verifier-agent/test/server.test.ts`:

```ts
it.each([
  ["repoId", { repoId: "0xab" }, /bad repoId/],
  ["externalId", { externalId: null }, /bad externalId/],
  ["kind", { kind: 99 }, /bad kind/],
  ["recipient", { recipient: "0x1234" }, /bad recipient/],
  ["deadline", { deadline: null }, /bad deadline/],
  ["factHash", { factHash: "0xab" }, /bad factHash/],
])("returns 400 on bad %s", async (_name, patch, errorPattern) => {
  const { app } = makeApp({ policy: "accept" });
  const repoId = repoIdFromSlug("x502-protocol/demo");
  const body = {
    repoId,
    externalId: "42",
    kind: Kind.Fix,
    recipient: zeroAddress,
    deadline: "1000",
    factHash: `0x${"ab".repeat(32)}`,
    ...patch,
  };
  const res = await app.request("/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(400);
  await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(errorPattern) });
});
```

- [ ] **Step 3: Add ClaudePolicy request and response tests**

Create `packages/verifier-agent/test/sign.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ATTESTATION_TYPES, attestationDomain } from "@x502/shared";
import { signAttestation } from "../src/sign.js";
import { AcceptAllPolicy, RejectAllPolicy } from "../src/decide.js";

const VAULT = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = { address: "0x2222222222222222222222222222222222222222" } as const;
const ATTESTATION = {
  claimId: `0x${"11".repeat(32)}` as const,
  recipient: "0x3333333333333333333333333333333333333333" as const,
  deadline: 123n,
  factHash: `0x${"44".repeat(32)}` as const,
};

describe("signAttestation", () => {
  it("delegates to attestationTypedData and returns the configured agent ID", async () => {
    const wallet = { signTypedData: vi.fn(async () => `0x${"aa".repeat(65)}` as const) };
    const signed = await signAttestation({
      agentId: 101n,
      vault: VAULT,
      chainId: 84532,
      account: ACCOUNT as never,
      wallet: wallet as never,
    }, ATTESTATION);
    expect(signed.agentId).toBe(101n);
    expect(signed.attestation).toBe(ATTESTATION);
    expect(wallet.signTypedData).toHaveBeenCalledWith({
      account: ACCOUNT,
      domain: attestationDomain(84532, VAULT),
      types: ATTESTATION_TYPES,
      primaryType: "Attestation",
      message: ATTESTATION,
    });
  });
});

describe("built-in decision policies", () => {
  it("return stable reasons", async () => {
    await expect(new AcceptAllPolicy().decide({} as never)).resolves.toEqual({
      accept: true,
      reason: "mock policy (AcceptAll)",
    });
    await expect(new RejectAllPolicy().decide({} as never)).resolves.toEqual({
      accept: false,
      reason: "mock policy (RejectAll)",
    });
  });
});
```

Create `packages/verifier-agent/test/claude-policy.test.ts`. Start with helpers:

```ts
import { describe, expect, it, vi } from "vitest";
import { Kind, deriveCommitment, repoIdFromSlug } from "@x502/shared";
import { ClaudePolicy } from "../src/policies/claude.js";

function anthropicWithText(text: string) {
  return {
    messages: {
      create: vi.fn(async () => ({ content: [{ type: "text", text }] })),
    },
  };
}

function octokitIssue(body: string, labels: unknown[] = ["bug"]) {
  return {
    rest: {
      issues: { get: vi.fn(async () => ({ data: { title: "Bug", state: "open", body, labels } })) },
      pulls: { get: vi.fn() },
    },
  };
}

const RECIPIENT = "0x2222222222222222222222222222222222222222" as const;
const FACT_HASH = `0x${"ab".repeat(32)}` as const;
```

Add the request-shape test:

```ts
it("calls Claude with schema, cache control, model, thinking, and prompt fields", async () => {
  const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "ok" }));
  const repoId = repoIdFromSlug("owner/repo");
  const salt = `0x${"11".repeat(32)}` as const;
  const commitment = deriveCommitment(101n, repoId, 2n, salt);
  const octokit = octokitIssue(`body\n<!-- x502-commitment:${commitment} -->`);

  const policy = new ClaudePolicy({ anthropic: anthropic as never, octokit: octokit as never });
  const result = await policy.decide({
    repoSlug: "owner/repo",
    externalId: 2n,
    kind: Kind.Report,
    recipient: RECIPIENT,
    factHash: FACT_HASH,
    agentIdReveal: 101n,
    saltReveal: salt,
  });

  expect(result).toEqual({ accept: true, reason: "ok" });
  const req = anthropic.messages.create.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(req.model).toBe("claude-opus-4-7");
  expect(req.thinking).toEqual({ type: "adaptive" });
  expect(req.output_config).toMatchObject({
    effort: "medium",
    format: { type: "json_schema" },
  });
  expect(req.system).toMatchObject([
    { type: "text", cache_control: { type: "ephemeral" } },
  ]);
  const messages = req.messages as Array<{ role: string; content: string }>;
  expect(messages[0].content).toContain("Claim type: report");
  expect(messages[0].content).toContain(`Recipient: ${RECIPIENT}`);
  expect(messages[0].content).toContain("Commitment verified: true");
});
```

Add response and failure tests:

```ts
it.each([
  [JSON.stringify({ accept: true, reason: "accepted" }), { accept: true, reason: "accepted" }],
  [JSON.stringify({ accept: false, reason: "rejected" }), { accept: false, reason: "rejected" }],
  ["not json", { accept: false, reason: "bad JSON from Claude: not json" }],
])("handles Claude text response %s", async (text, expected) => {
  const anthropic = anthropicWithText(text);
  const policy = new ClaudePolicy({
    anthropic: anthropic as never,
    octokit: octokitIssue("body") as never,
  });
  const result = await policy.decide({
    repoSlug: "owner/repo",
    externalId: 2n,
    kind: Kind.Report,
    recipient: RECIPIENT,
    factHash: FACT_HASH,
  });
  expect(result).toMatchObject(expected);
});

it("rejects when GitHub fetch fails", async () => {
  const policy = new ClaudePolicy({
    anthropic: anthropicWithText("{}") as never,
    octokit: {
      rest: { issues: { get: vi.fn(async () => { throw new Error("boom"); }) }, pulls: { get: vi.fn() } },
    } as never,
  });
  await expect(policy.decide({
    repoSlug: "owner/repo",
    externalId: 2n,
    kind: Kind.Report,
    recipient: RECIPIENT,
    factHash: FACT_HASH,
  })).resolves.toMatchObject({ accept: false, reason: "gh fetch failed: boom" });
});
```

Add bad input and prompt-context tests:

```ts
it("rejects bad repo slugs before fetching GitHub", async () => {
  const octokit = octokitIssue("body");
  const policy = new ClaudePolicy({
    anthropic: anthropicWithText("{}") as never,
    octokit: octokit as never,
  });
  await expect(policy.decide({
    repoSlug: "not-a-slug",
    externalId: 2n,
    kind: Kind.Report,
    recipient: RECIPIENT,
    factHash: FACT_HASH,
  })).resolves.toEqual({ accept: false, reason: "bad repoSlug" });
  expect(octokit.rest.issues.get).not.toHaveBeenCalled();
});

it("uses PR context and label extraction for fix claims", async () => {
  const anthropic = anthropicWithText(JSON.stringify({ accept: true, reason: "merged fix" }));
  const pullsGet = vi.fn(async () => ({
    data: {
      title: "Fix bug",
      state: "closed",
      merged: true,
      base: { ref: "main" },
      body: "Fixes #2",
      labels: [{ name: "bug" }, "accepted"],
    },
  }));
  const policy = new ClaudePolicy({
    anthropic: anthropic as never,
    octokit: { rest: { pulls: { get: pullsGet }, issues: { get: vi.fn() } } } as never,
  });
  await policy.decide({
    repoSlug: "owner/repo",
    externalId: 3n,
    kind: Kind.Fix,
    recipient: RECIPIENT,
    factHash: FACT_HASH,
  });
  expect(pullsGet).toHaveBeenCalledWith({ owner: "owner", repo: "repo", pull_number: 3 });
  const req = anthropic.messages.create.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
  expect(req.messages[0].content).toContain("PR #3: Fix bug");
  expect(req.messages[0].content).toContain("Labels: bug, accepted");
  expect(req.messages[0].content).toContain("Commitment verified: false");
});

it("rejects when Claude returns no text block", async () => {
  const anthropic = {
    messages: { create: vi.fn(async () => ({ content: [{ type: "tool_use" }] })) },
  };
  const policy = new ClaudePolicy({
    anthropic: anthropic as never,
    octokit: octokitIssue("body") as never,
  });
  await expect(policy.decide({
    repoSlug: "owner/repo",
    externalId: 2n,
    kind: Kind.Report,
    recipient: RECIPIENT,
    factHash: FACT_HASH,
  })).resolves.toEqual({ accept: false, reason: "no text response from Claude" });
});
```

Add the current-behavior comment-fetch test:

```ts
// Current behavior pinned from USER_FLOW.md "Current vs. intent":
// ClaudePolicy fetches the issue or PR body but does not fetch GitHub comments,
// so commitments and repro/dedup evidence in comments are invisible here.
it("currentBehavior_commentsNotFetchedForCommitmentOrEvidence", async () => {
  const anthropic = anthropicWithText(JSON.stringify({ accept: false, reason: "no body proof" }));
  const octokit = octokitIssue("");
  const policy = new ClaudePolicy({ anthropic: anthropic as never, octokit: octokit as never });
  await policy.decide({
    repoSlug: "owner/repo",
    externalId: 2n,
    kind: Kind.Triage,
    recipient: RECIPIENT,
    factHash: FACT_HASH,
  });
  expect(octokit.rest.issues.get).toHaveBeenCalledTimes(1);
  expect((octokit.rest as { issues: Record<string, unknown> }).issues).not.toHaveProperty("listComments");
});
```

- [ ] **Step 4: Run verifier tests and coverage**

Run:

```bash
pnpm --filter @x502/verifier-agent exec vitest run
pnpm --filter @x502/verifier-agent run test:coverage
```

Expected: tests pass; coverage improves across `server.ts`, `decide.ts`, `sign.ts`, and `policies/claude.ts`.

- [ ] **Step 5: Commit verifier policy/server coverage**

Run:

```bash
git add packages/verifier-agent/test packages/verifier-agent/vitest.config.ts packages/verifier-agent/package.json
git commit -m "test(verifier-agent): cover server validation and claude policy"
```

---

### Task 5: Expand Verifier Wallet Coverage

**Files:**
- Modify: `packages/verifier-agent/test/wallet.test.ts`

- [ ] **Step 1: Add CDP SDK module mock tests**

At the top of a new `describe("CdpWalletProvider bootstrap")` block, dynamically import the provider after a `vi.mock`:

```ts
import { beforeEach, vi } from "vitest";

const getOrCreateAccount = vi.fn();
const getOrCreateSmartAccount = vi.fn();

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: vi.fn(() => ({
    evm: { getOrCreateAccount, getOrCreateSmartAccount },
  })),
}));
```

Add EOA coverage:

```ts
it("bootstraps an EOA account and requests faucet best-effort", async () => {
  const signTypedData = vi.fn(async () => `0x${"aa".repeat(65)}`);
  const requestFaucet = vi.fn(async () => undefined);
  getOrCreateAccount.mockResolvedValue({
    address: "0x1111111111111111111111111111111111111111",
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
    signTypedData,
    useNetwork: vi.fn(async () => ({ requestFaucet })),
  });
  const { CdpWalletProvider } = await import("../src/wallet/cdp.js");
  const provider = new CdpWalletProvider({
    accountName: "agent",
    mode: "eoa",
    network: "base-sepolia",
    faucet: true,
  });
  const wallet = await provider.bootstrap({ chain: foundry, agentId: 101n });
  expect(wallet.source).toBe("cdp:eoa");
  expect(wallet.address).toBe("0x1111111111111111111111111111111111111111");
  expect(requestFaucet).toHaveBeenCalledWith({ token: "eth" });
});
```

Add smart-wallet coverage:

```ts
it("bootstraps a smart wallet and forwards signTypedData to the network scope", async () => {
  const scopedSignTypedData = vi.fn(async () => `0x${"bb".repeat(65)}`);
  const owner = { address: "0x2222222222222222222222222222222222222222" };
  const smart = {
    address: "0x3333333333333333333333333333333333333333",
    useNetwork: vi.fn(async () => ({ signTypedData: scopedSignTypedData })),
  };
  getOrCreateAccount.mockResolvedValue(owner);
  getOrCreateSmartAccount.mockResolvedValue(smart);
  const { CdpWalletProvider } = await import("../src/wallet/cdp.js");
  const provider = new CdpWalletProvider({ accountName: "agent", mode: "smart" });
  const wallet = await provider.bootstrap({ chain: foundry, agentId: 101n });
  expect(wallet.source).toBe("cdp:smart");
  await expect(wallet.account.signMessage({ message: "x" })).rejects.toThrow(/signMessage is not supported/);
  await wallet.account.signTypedData({
    domain: {},
    types: { Attestation: [] },
    primaryType: "Attestation",
    message: {},
  } as never);
  expect(scopedSignTypedData).toHaveBeenCalled();
});
```

- [ ] **Step 2: Add environment selector cases**

Extend `pickWalletProviderFromEnv` tests for:

```ts
it("maps VERIFIER_NETWORK and faucet flag", () => {
  const provider = pickWalletProviderFromEnv({
    WALLET_PROVIDER: "cdp",
    CDP_WALLET_MODE: "smart",
    VERIFIER_NETWORK: "base",
    CDP_REQUEST_FAUCET: "true",
    CDP_API_KEY_ID: "fake",
    CDP_API_KEY_SECRET: "fake",
    CDP_WALLET_SECRET: "fake",
  });
  expect(provider).toBeInstanceOf(CdpWalletProvider);
});

it("falls back to base-sepolia for an unknown VERIFIER_NETWORK", () => {
  expect(() => pickWalletProviderFromEnv({
    WALLET_PROVIDER: "cdp",
    VERIFIER_NETWORK: "mars",
    CDP_API_KEY_ID: "fake",
    CDP_API_KEY_SECRET: "fake",
    CDP_WALLET_SECRET: "fake",
  })).not.toThrow();
});
```

- [ ] **Step 3: Run wallet tests**

Run:

```bash
pnpm --filter @x502/verifier-agent exec vitest run test/wallet.test.ts
pnpm --filter @x502/verifier-agent run test:coverage
```

Expected: wallet coverage includes `env-key.ts`, `wallet/index.ts`, and `wallet/cdp.ts` without real CDP credentials.

- [ ] **Step 4: Commit wallet coverage**

Run:

```bash
git add packages/verifier-agent/test/wallet.test.ts
git commit -m "test(verifier-agent): cover wallet providers"
```

---

### Task 6: Expand Coordinator Adapter Coverage

**Files:**
- Create: `packages/coordinator/test/adapters.test.ts`
- Create: `packages/coordinator/test/x402-adapters.test.ts`
- Modify: `packages/coordinator/test/pipeline.test.ts`
- Modify: `packages/coordinator/test/server.test.ts`

- [ ] **Step 1: Add adapter tests for registry and fetch verifier**

Create `packages/coordinator/test/adapters.test.ts` with:

```ts
import { describe, expect, it, vi } from "vitest";
import { Kind, repoIdFromSlug } from "@x502/shared";
import { StaticRepoRegistry } from "../src/adapters/repo-registry.js";
import { FetchVerifierClient } from "../src/adapters/fetch-verifier.js";

const RECIPIENT = "0x2222222222222222222222222222222222222222" as const;
const FACT_HASH = `0x${"ab".repeat(32)}` as const;

describe("StaticRepoRegistry", () => {
  it("adds, resolves, reverse-resolves, and overwrites a repo", () => {
    const registry = new StaticRepoRegistry();
    const repoId = registry.add("owner/repo", 2, [1n, 2n]);
    expect(repoId).toBe(repoIdFromSlug("owner/repo"));
    expect(registry.resolve("owner/repo")).toEqual({ repoId, threshold: 2, trustedAgentIds: [1n, 2n] });
    expect(registry.resolveSlug(repoId)).toBe("owner/repo");
    registry.add("owner/repo", 1, [3n]);
    expect(registry.resolve("owner/repo")).toEqual({ repoId, threshold: 1, trustedAgentIds: [3n] });
  });
});

describe("FetchVerifierClient", () => {
  it("serializes bigint request fields and optional reveal values", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      agentId: "7",
      signature: `0x${"cd".repeat(65)}`,
      attestation: { claimId: `0x${"11".repeat(32)}`, recipient: RECIPIENT, deadline: "99", factHash: FACT_HASH },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new FetchVerifierClient(7n, "https://verifier.example", fetchImpl as never);
    await client.verify({
      repoId: repoIdFromSlug("owner/repo"),
      externalId: 42n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      deadline: 99n,
      factHash: FACT_HASH,
      agentIdReveal: 101n,
      saltReveal: `0x${"22".repeat(32)}`,
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body as string)).toMatchObject({
      externalId: "42",
      deadline: "99",
      agentIdReveal: "101",
      saltReveal: `0x${"22".repeat(32)}`,
    });
  });

  it.each([
    [403, { reason: "policy rejected" }, "policy rejected"],
    [500, { error: "server blew up" }, "server blew up"],
  ])("parses verifier rejection JSON for status %s", async (status, body, expected) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    const client = new FetchVerifierClient(7n, "https://verifier.example", fetchImpl as never);
    await expect(client.verify({
      repoId: repoIdFromSlug("owner/repo"),
      externalId: 42n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      deadline: 99n,
      factHash: FACT_HASH,
    })).resolves.toEqual({ rejected: expected });
  });
});
```

- [ ] **Step 2: Add viem adapter tests**

Extend the same file with fake viem clients:

```ts
import { ViemVaultWriter } from "../src/adapters/viem-vault.js";
import { ViemFactProvider } from "../src/adapters/viem-fact-provider.js";

describe("ViemVaultWriter", () => {
  it("simulates, writes, waits, and maps agent IDs and signatures", async () => {
    const request = { to: "vault-call" };
    const publicClient = {
      simulateContract: vi.fn(async () => ({ request })),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    };
    const wallet = { writeContract: vi.fn(async () => `0x${"44".repeat(32)}`) };
    const writer = new ViemVaultWriter(publicClient as never, wallet as never, { address: RECIPIENT } as never, RECIPIENT);
    const tx = await writer.submitPayout({
      repoId: repoIdFromSlug("owner/repo"),
      externalId: 42n,
      kind: Kind.Fix,
      recipient: RECIPIENT,
      deadline: 99n,
      factHash: FACT_HASH,
      attestations: [
        { agentId: 2n, signature: `0x${"aa".repeat(65)}`, attestation: { claimId: `0x${"11".repeat(32)}`, recipient: RECIPIENT, deadline: 99n, factHash: FACT_HASH } },
      ],
    });
    expect(tx).toBe(`0x${"44".repeat(32)}`);
    expect(publicClient.simulateContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "payout",
      args: expect.arrayContaining([[2n], [`0x${"aa".repeat(65)}`]]),
    }));
    expect(wallet.writeContract).toHaveBeenCalledWith(request);
  });
});

describe("ViemFactProvider", () => {
  it("returns immediately when a fact is already ready", async () => {
    const publicClient = {
      watchContractEvent: vi.fn(() => vi.fn()),
      readContract: vi.fn(async () => [true, `0x${"55".repeat(4)}`]),
    };
    const provider = new ViemFactProvider(publicClient as never, {} as never, { address: RECIPIENT } as never, RECIPIENT);
    await expect(provider.awaitFact(`0x${"11".repeat(32)}`, 10)).resolves.toBe(`0x${"55".repeat(4)}`);
  });

  it("resolves pending facts from matching events and ignores unrelated events", async () => {
    let onLogs: ((logs: Array<{ args: Record<string, unknown> }>) => void) | undefined;
    const publicClient = {
      watchContractEvent: vi.fn((opts) => { onLogs = opts.onLogs; return vi.fn(); }),
      readContract: vi.fn(async () => [false, "0x"]),
    };
    const provider = new ViemFactProvider(publicClient as never, {} as never, { address: RECIPIENT } as never, RECIPIENT);
    const claimId = `0x${"11".repeat(32)}` as const;
    const promise = provider.awaitFact(claimId, 1000);
    provider.start();
    onLogs?.([
      { args: { claimId: `0x${"22".repeat(32)}`, factBlob: "0xaaaa" } },
      { args: { claimId, factBlob: "0xbbbb" } },
    ]);
    await expect(promise).resolves.toBe("0xbbbb");
  });
});
```

- [ ] **Step 3: Add x402 adapter module-mock tests**

Create `packages/coordinator/test/x402-adapters.test.ts`:

```ts
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wrapFetchWithPayment = vi.hoisted(() => vi.fn((f: typeof fetch) => f));
const paymentMiddleware = vi.hoisted(() =>
  vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
);

vi.mock("x402-fetch", () => ({ wrapFetchWithPayment }));
vi.mock("x402-hono", () => ({ paymentMiddleware }));

describe("x402 adapters", () => {
  beforeEach(() => {
    wrapFetchWithPayment.mockClear();
    paymentMiddleware.mockClear();
  });

  it("buildX402Fetch delegates to wrapFetchWithPayment", async () => {
    const { buildX402Fetch } = await import("../src/adapters/x402-fetch.js");
    const walletClient = { account: { address: "0x2222222222222222222222222222222222222222" } };
    const wrapped = buildX402Fetch(walletClient as never);
    expect(wrapped).toBe(globalThis.fetch);
    expect(wrapFetchWithPayment).toHaveBeenCalledWith(globalThis.fetch, walletClient);
  });

  it("X402PaymentGate maps routes and facilitator URL into paymentMiddleware", async () => {
    const { X402PaymentGate } = await import("../src/adapters/x402-gate.js");
    const app = new Hono();
    new X402PaymentGate({
      payTo: "0x2222222222222222222222222222222222222222",
      facilitatorUrl: "https://facilitator.example",
      routes: {
        "/claim": {
          price: "$0.01",
          network: "base-sepolia",
          description: "claim anti-spam fee",
        },
      },
    }).apply(app);
    expect(paymentMiddleware).toHaveBeenCalledWith(
      "0x2222222222222222222222222222222222222222",
      {
        "/claim": {
          price: "$0.01",
          network: "base-sepolia",
          config: { description: "claim anti-spam fee" },
        },
      },
      { url: "https://facilitator.example" },
    );
  });
});
```

- [ ] **Step 4: Add coordinator server/pipeline edge tests**

Extend existing server and pipeline tests for:

```ts
it("accepts numeric externalId and reveal fields", async () => {
  const { app } = makeCoord();
  const res = await app.request("/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      repoSlug: "owner/repo",
      externalId: 42,
      kind: "report",
      recipient: RECIPIENT,
      agentIdReveal: 101,
      saltReveal: `0x${"11".repeat(32)}`,
    }),
  });
  expect(res.status).toBe(200);
});
```

Append these exact pipeline tests to `packages/coordinator/test/pipeline.test.ts`:

```ts
it("sorts accepted verifier attestations before trimming to threshold", async () => {
  const state = makeState();
  const vault = new ScriptedVault({ type: "ok" });
  await runClaimPipeline(state, {
    factProvider: new FixedFactProvider(FACT_BLOB),
    verifiers: [
      new ScriptedVerifierClient(103n, "v3", { type: "accept" }),
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "accept" }),
    ],
    vault,
    threshold: 2,
    factTimeoutMs: 1_000,
    verifierTimeoutMs: 1_000,
  });
  expect(state.status).toBe("paid");
  expect(vault.lastArgs?.attestations.map((a) => a.agentId)).toEqual([101n, 102n]);
});

it("fails when all verifiers reject", async () => {
  const state = makeState();
  await runClaimPipeline(state, {
    factProvider: new FixedFactProvider(FACT_BLOB),
    verifiers: [
      new ScriptedVerifierClient(101n, "v1", { type: "reject", reason: "bad report" }),
      new ScriptedVerifierClient(102n, "v2", { type: "reject", reason: "duplicate" }),
    ],
    vault: new ScriptedVault({ type: "ok" }),
    threshold: 2,
    factTimeoutMs: 1_000,
    verifierTimeoutMs: 1_000,
  });
  expect(state.status).toBe("failed");
  expect(state.error).toContain("insufficient verifier signatures: 0/2");
  expect(state.error).toContain("bad report");
  expect(state.error).toContain("duplicate");
});

it("includes verifier timeout in insufficient-signature detail", async () => {
  const state = makeState();
  await runClaimPipeline(state, {
    factProvider: new FixedFactProvider(FACT_BLOB),
    verifiers: [
      new ScriptedVerifierClient(101n, "v1", { type: "accept" }),
      new ScriptedVerifierClient(102n, "v2", { type: "timeout" }),
    ],
    vault: new ScriptedVault({ type: "ok" }),
    threshold: 2,
    factTimeoutMs: 1_000,
    verifierTimeoutMs: 20,
  });
  expect(state.status).toBe("failed");
  expect(state.error).toContain("verifier timeout");
});
```

- [ ] **Step 5: Run coordinator tests and coverage**

Run:

```bash
pnpm --filter @x502/coordinator exec vitest run
pnpm --filter @x502/coordinator run test:coverage
```

Expected: adapter and pipeline coverage improves without live network calls.

- [ ] **Step 6: Commit coordinator coverage**

Run:

```bash
git add packages/coordinator/test packages/coordinator/vitest.config.ts packages/coordinator/package.json
git commit -m "test(coordinator): cover adapters and pipeline edges"
```

---

### Task 7: Add Web Helper and Client Coverage

**Files:**
- Create: `packages/web/lib/claim-ui.ts`
- Modify: `packages/web/app/page.tsx`
- Create: `packages/web/test/format.test.ts`
- Create: `packages/web/test/coordinator.test.ts`
- Create: `packages/web/test/claim-ui.test.ts`

- [ ] **Step 1: Extract testable page helpers**

Create `packages/web/lib/claim-ui.ts`:

```ts
import type { Hex } from "viem";
import { deriveCommitment, repoIdFromSlug } from "@x502/shared";
import type { PollResponse } from "./coordinator";

export interface PipelineState {
  claimId?: Hex;
  status: "idle" | "verifying" | "ready" | "paid" | "failed";
  error?: string;
  txHash?: Hex;
  factReady?: boolean;
  sigs?: number;
}

export function mapPoll(claimId: Hex, body: PollResponse): PipelineState {
  if (body.status === "paid") return { claimId, status: "paid", txHash: body.txHash };
  if (body.status === "failed") return { claimId, status: "failed", error: body.error };
  return { claimId, status: body.status, factReady: body.factReady, sigs: body.sigs };
}

export function previewCommitment(args: {
  repoSlug: string;
  externalId: string;
  agentIdReveal: string;
  saltReveal: string;
}): Hex | undefined {
  if (!args.repoSlug.includes("/")) return undefined;
  if (!args.externalId || !args.agentIdReveal || !args.saltReveal.startsWith("0x")) return undefined;
  try {
    return deriveCommitment(
      BigInt(args.agentIdReveal),
      repoIdFromSlug(args.repoSlug),
      BigInt(args.externalId),
      args.saltReveal as Hex,
    );
  } catch {
    return undefined;
  }
}
```

Modify `packages/web/app/page.tsx` to import `PipelineState`, `mapPoll`, and `previewCommitment`. Remove the local interface/function and replace the `useMemo` body:

```ts
const commitmentPreview = useMemo(
  () => previewCommitment({ repoSlug, externalId, agentIdReveal, saltReveal }),
  [repoSlug, externalId, agentIdReveal, saltReveal],
);
```

Rename JSX references from `previewCommitment` to `commitmentPreview`.

- [ ] **Step 2: Add formatting tests**

Create `packages/web/test/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { basescanTx, formatUsdc, shortHash } from "../lib/format";

describe("formatUsdc", () => {
  it.each([
    [0n, "$0.00"],
    [1n, "$0.00"],
    [10_000n, "$0.01"],
    [1_000_000n, "$1.00"],
    [1_234_567n, "$1.23"],
    [123_456_789_000_000n, "$123456789.00"],
  ])("formats %s as %s", (amount, expected) => {
    expect(formatUsdc(amount)).toBe(expected);
  });
});

describe("shortHash", () => {
  it("leaves short strings unchanged", () => {
    expect(shortHash("0x1234")).toBe("0x1234");
  });
  it("shortens long hashes", () => {
    expect(shortHash(`0x${"ab".repeat(32)}`)).toBe("0xababab…ababab");
  });
});

describe("basescanTx", () => {
  it("uses Base Sepolia by default and Base mainnet for chain 8453", () => {
    const tx = `0x${"11".repeat(32)}` as const;
    expect(basescanTx(tx)).toBe(`https://sepolia.basescan.org/tx/${tx}`);
    expect(basescanTx(tx, 8453)).toBe(`https://basescan.org/tx/${tx}`);
  });
});
```

- [ ] **Step 3: Add CoordinatorClient tests**

Create `packages/web/test/coordinator.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorClient } from "../lib/coordinator";

const CLAIM_ID = `0x${"11".repeat(32)}` as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CoordinatorClient", () => {
  it("posts a claim with JSON and returns the response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      claimId: CLAIM_ID,
      pollUrl: `/payout/${CLAIM_ID}`,
      status: "verifying",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CoordinatorClient("http://localhost:8787");
    await expect(client.postClaim({
      repoSlug: "owner/repo",
      externalId: "42",
      kind: "report",
      recipient: "0x2222222222222222222222222222222222222222",
    })).resolves.toMatchObject({ claimId: CLAIM_ID, status: "verifying" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8787/claim", expect.objectContaining({
      method: "POST",
      headers: { "content-type": "application/json" },
    }));
  });

  it("throws a specific x402 error on 402", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("pay", { status: 402 })));
    await expect(new CoordinatorClient("x").postClaim({
      repoSlug: "owner/repo",
      externalId: "42",
      kind: "report",
      recipient: "0x2222222222222222222222222222222222222222",
    })).rejects.toThrow(/402 Payment Required/);
  });

  it("polls a claim and returns status plus body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "failed",
      claimId: CLAIM_ID,
      error: "no sigs",
    }), { status: 410 })));
    await expect(new CoordinatorClient("http://localhost:8787").poll(CLAIM_ID)).resolves.toEqual({
      status: 410,
      body: { status: "failed", claimId: CLAIM_ID, error: "no sigs" },
    });
  });
});
```

- [ ] **Step 4: Add claim-ui tests**

Create `packages/web/test/claim-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveCommitment, repoIdFromSlug } from "@x502/shared";
import { mapPoll, previewCommitment } from "../lib/claim-ui";

const CLAIM_ID = `0x${"11".repeat(32)}` as const;
const TX = `0x${"22".repeat(32)}` as const;
const RECIPIENT = "0x3333333333333333333333333333333333333333" as const;
const SALT = `0x${"44".repeat(32)}` as const;

describe("mapPoll", () => {
  it("maps paid, failed, and pending responses", () => {
    expect(mapPoll(CLAIM_ID, { status: "paid", claimId: CLAIM_ID, recipient: RECIPIENT, txHash: TX })).toEqual({ claimId: CLAIM_ID, status: "paid", txHash: TX });
    expect(mapPoll(CLAIM_ID, { status: "failed", claimId: CLAIM_ID, error: "no sigs" })).toEqual({ claimId: CLAIM_ID, status: "failed", error: "no sigs" });
    expect(mapPoll(CLAIM_ID, { status: "verifying", claimId: CLAIM_ID, factReady: true, sigs: 1 })).toEqual({ claimId: CLAIM_ID, status: "verifying", factReady: true, sigs: 1 });
  });
});

describe("previewCommitment", () => {
  it("returns a commitment for valid inputs", () => {
    expect(previewCommitment({
      repoSlug: "owner/repo",
      externalId: "2",
      agentIdReveal: "101",
      saltReveal: SALT,
    })).toBe(deriveCommitment(101n, repoIdFromSlug("owner/repo"), 2n, SALT));
  });

  it.each([
    [{ repoSlug: "owner", externalId: "2", agentIdReveal: "101", saltReveal: SALT }],
    [{ repoSlug: "owner/repo", externalId: "", agentIdReveal: "101", saltReveal: SALT }],
    [{ repoSlug: "owner/repo", externalId: "x", agentIdReveal: "101", saltReveal: SALT }],
    [{ repoSlug: "owner/repo", externalId: "2", agentIdReveal: "x", saltReveal: SALT }],
    [{ repoSlug: "owner/repo", externalId: "2", agentIdReveal: "101", saltReveal: "abc" }],
  ])("returns undefined for invalid inputs", (args) => {
    expect(previewCommitment(args)).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run web tests and coverage**

Run:

```bash
pnpm --filter @x502/web exec vitest run
pnpm --filter @x502/web run test:coverage
```

Expected: web tests pass; `app/page.tsx` is excluded from strict coverage.

- [ ] **Step 6: Commit web coverage**

Run:

```bash
git add packages/web
git commit -m "test(web): cover client helpers"
```

---

### Task 8: Extract and Test Demo Commitment Helper

**Files:**
- Create: `demo/scripts/commitment.ts`
- Modify: `demo/scripts/derive-commitment.ts`
- Create: `demo/test/derive-commitment.test.ts`

- [ ] **Step 1: Extract pure helper**

Create `demo/scripts/commitment.ts`:

```ts
import { deriveCommitment, repoIdFromSlug } from "@x502/shared";

export interface CommitmentArgs {
  agentId: string;
  repo: string;
  externalId: string;
  salt: `0x${string}`;
}

export function deriveCommitmentOutput(args: CommitmentArgs): { repoId: `0x${string}`; commitment: `0x${string}` } {
  const repoId = repoIdFromSlug(args.repo);
  const commitment = deriveCommitment(BigInt(args.agentId), repoId, BigInt(args.externalId), args.salt);
  return { repoId, commitment };
}

export function formatCommitmentOutput(args: CommitmentArgs): string {
  const { repoId, commitment } = deriveCommitmentOutput(args);
  return [
    `repoId     : ${repoId}`,
    `commitment : ${commitment}`,
    "",
    "Paste this into your GitHub issue/PR body:",
    `<!-- x502-commitment:${commitment} -->`,
  ].join("\n");
}
```

Modify `demo/scripts/derive-commitment.ts` to call `formatCommitmentOutput` and keep the existing usage message.

- [ ] **Step 2: Add helper and CLI smoke tests**

Create `demo/test/derive-commitment.test.ts`:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { deriveCommitment, repoIdFromSlug } from "@x502/shared";
import { deriveCommitmentOutput, formatCommitmentOutput } from "../scripts/commitment";

const execFileAsync = promisify(execFile);
const SALT = `0x${"11".repeat(32)}` as const;

describe("derive commitment helper", () => {
  it("derives repoId and commitment", () => {
    const result = deriveCommitmentOutput({
      agentId: "101",
      repo: "owner/repo",
      externalId: "2",
      salt: SALT,
    });
    const repoId = repoIdFromSlug("owner/repo");
    expect(result).toEqual({
      repoId,
      commitment: deriveCommitment(101n, repoId, 2n, SALT),
    });
  });

  it("formats the GitHub body marker", () => {
    expect(formatCommitmentOutput({
      agentId: "101",
      repo: "owner/repo",
      externalId: "2",
      salt: SALT,
    })).toContain("<!-- x502-commitment:0x");
  });
});

describe("derive-commitment CLI", () => {
  it("prints output for valid args", async () => {
    const { stdout } = await execFileAsync("pnpm", [
      "tsx",
      "scripts/derive-commitment.ts",
      "--agent-id",
      "101",
      "--repo",
      "owner/repo",
      "--external-id",
      "2",
      "--salt",
      SALT,
    ], { cwd: new URL("..", import.meta.url) });
    expect(stdout).toContain("repoId     : 0x");
    expect(stdout).toContain("<!-- x502-commitment:0x");
  });

  it("exits non-zero with usage for missing args", async () => {
    await expect(execFileAsync("pnpm", ["tsx", "scripts/derive-commitment.ts"], {
      cwd: new URL("..", import.meta.url),
    })).rejects.toMatchObject({
      stderr: expect.stringContaining("usage: derive-commitment.ts"),
    });
  });
});
```

- [ ] **Step 3: Run demo tests and coverage**

Run:

```bash
pnpm --filter @x502/demo exec vitest run
pnpm --filter @x502/demo run test:coverage
```

Expected: demo tests pass and include `scripts/commitment.ts`.

- [ ] **Step 4: Commit demo coverage**

Run:

```bash
git add demo/scripts demo/test demo/package.json demo/vitest.config.ts
git commit -m "test(demo): cover commitment helper"
```

---

### Task 9: Extract and Test Chainlink Source Core

**Files:**
- Create: `chainlink/package.json`
- Create: `chainlink/source-core.js`
- Create: `chainlink/source-wrapper.js`
- Create: `chainlink/build-source.mjs`
- Modify: `chainlink/source.js`
- Create: `chainlink/test/source-core.test.mjs`

- [ ] **Step 1: Mark the chainlink folder as ESM for Node tests**

Create `chainlink/package.json`:

```json
{
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: Create pure source core**

Create `chainlink/source-core.js` with no `ethers` import:

```js
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ZERO_B32 = `0x${"0".repeat(64)}`;

function bytes32FromMask(mask) {
  return `0x${mask.toString(16).padStart(64, "0")}`;
}

function labelNames(labels = []) {
  return labels.map((l) => (typeof l === "string" ? l : l?.name)).filter(Boolean);
}

export function parseRepoSlug(repoSlug) {
  const [owner, repo] = String(repoSlug == null ? "" : repoSlug).split("/");
  if (!owner || !repo) throw Error("bad repoSlug");
  return { owner, repo };
}

export function authorBindingFromBody(body = "") {
  const m = body.match(/<!--\s*x502:(0x[a-fA-F0-9]{40})\s*-->/);
  return m ? m[1].toLowerCase() : ZERO_ADDR;
}

export function mergedBlockFromSha(sha) {
  if (!sha) return 0n;
  return BigInt(`0x${sha.slice(0, 16)}`);
}

export function decideFact({ kind, item, files = [] }) {
  const body = item && item.body ? item.body : "";
  const ghAuthorBinding = authorBindingFromBody(body);
  let status = 0;
  let mergedBlock = 0n;
  let labelMask = ZERO_B32;

  if (kind === 0) {
    const labels = labelNames(item && item.labels).map((s) => s.toLowerCase());
    const accepted = labels.includes("accepted") || labels.includes("bug") || labels.includes("enhancement");
    const rejected = labels.includes("wontfix") || labels.includes("duplicate") || labels.includes("invalid");
    status = accepted && !rejected ? 1 : 0;
    let mask = 0n;
    if (labels.includes("bug")) mask |= 1n;
    if (labels.includes("enhancement")) mask |= 2n;
    if (labels.includes("accepted")) mask |= 4n;
    labelMask = bytes32FromMask(mask);
  } else if (kind === 1) {
    const labels = labelNames(item && item.labels);
    status = labels.length >= 2 ? 1 : 0;
    let mask = 0n;
    if (labels.map((s) => s.toLowerCase()).includes("triage-done")) mask |= 8n;
    labelMask = bytes32FromMask(mask);
  } else if (kind === 2) {
    if (item && item.merged === true && /(?:fixes|closes|resolves)\s+#\d+/i.test(body)) {
      status = 1;
      mergedBlock = mergedBlockFromSha(item.merge_commit_sha);
    }
  } else if (kind === 3) {
    if (item && item.merged === true) {
      const testRe = /(^|\/)(test|tests|spec|__tests__)\//i;
      const docRe = /(^|\/)(docs|readme)/i;
      const hasTest = files.some((f) => testRe.test(f.filename || ""));
      const hasDoc = files.some((f) => docRe.test(f.filename || ""));
      if (hasTest || hasDoc) {
        status = 1;
        mergedBlock = mergedBlockFromSha(item.merge_commit_sha);
        let mask = 0n;
        if (hasTest) mask |= 1n;
        if (hasDoc) mask |= 2n;
        labelMask = bytes32FromMask(mask);
      }
    }
  } else {
    throw Error(`unknown kind ${kind}`);
  }

  return { status, mergedBlock, labelMask, ghAuthorBinding };
}
```

- [ ] **Step 3: Create the DON wrapper body**

Create `chainlink/source-wrapper.js`. This file is not executed directly; `build-source.mjs` inlines it after the pure core:

```js
const repoSlug = args[0];
const externalId = args[1];
const kind = parseInt(args[2], 10);
const { owner, repo } = parseRepoSlug(repoSlug);

const isPr = kind === 2 || kind === 3;
const endpoint = isPr ? "pulls" : "issues";

const headers = {
  Authorization: `Bearer ${secrets.GITHUB_PAT}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "x502-fact-receiver",
};

const r = await Functions.makeHttpRequest({
  url: `https://api.github.com/repos/${owner}/${repo}/${endpoint}/${externalId}`,
  headers,
  timeout: 9000,
});
if (r.error) throw Error(`gh ${endpoint}/${externalId} fetch failed: ${r.error}`);
const d = r.data;

let files = [];
if (kind === 3 && d.merged === true) {
  const fr = await Functions.makeHttpRequest({
    url: `https://api.github.com/repos/${owner}/${repo}/pulls/${externalId}/files`,
    headers,
    timeout: 9000,
  });
  if (!fr.error) files = fr.data || [];
}

const fact = decideFact({ kind, item: d, files });
const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint8", "uint64", "bytes32", "address"],
  [fact.status, fact.mergedBlock, fact.labelMask, fact.ghAuthorBinding],
);
return ethers.getBytes(encoded);
```

- [ ] **Step 4: Add the source generator**

Create `chainlink/build-source.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";

const core = readFileSync(new URL("./source-core.js", import.meta.url), "utf8").replace(
  /^export /gm,
  "",
);
const wrapper = readFileSync(new URL("./source-wrapper.js", import.meta.url), "utf8");

const source = [
  "// Generated by chainlink/build-source.mjs. Edit source-core.js or source-wrapper.js.",
  "// x502 GitHub fact source — runs inside the Chainlink Functions DON (Deno).",
  'import { ethers } from "https://esm.sh/ethers@6.13.4";',
  "",
  core.trim(),
  "",
  wrapper.trim(),
  "",
].join("\n");

writeFileSync(new URL("./source.js", import.meta.url), source);
```

Modify root `package.json` scripts:

```json
{
  "chainlink:build-source": "node chainlink/build-source.mjs",
  "test:chainlink": "vitest run --config chainlink/vitest.config.ts",
  "test:coverage:chainlink": "vitest run --coverage --config chainlink/vitest.config.ts"
}
```

Run:

```bash
pnpm chainlink:build-source
```

Expected: `chainlink/source.js` is self-contained and contains no `from "./source-core.js"` import.

- [ ] **Step 5: Add source-core tests**

Create `chainlink/test/source-core.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { authorBindingFromBody, decideFact, mergedBlockFromSha, parseRepoSlug } from "../source-core.js";

describe("parseRepoSlug", () => {
  it("parses owner/repo and rejects bad slugs", () => {
    expect(parseRepoSlug("owner/repo")).toEqual({ owner: "owner", repo: "repo" });
    expect(() => parseRepoSlug("owner")).toThrow(/bad repoSlug/);
  });
});

describe("authorBindingFromBody", () => {
  // Current behavior pinned from USER_FLOW.md "Current vs. intent":
  // the source parses the x502 wallet marker, but the vault never enforces it.
  it("currentBehavior_ghAuthorBindingParsedButNotEnforced", () => {
    expect(authorBindingFromBody("<!-- x502:0x1234567890abcdef1234567890ABCDEF12345678 -->")).toBe(
      "0x1234567890abcdef1234567890abcdef12345678",
    );
  });
});

describe("decideFact", () => {
  it("accepts report labels and rejects conflicting rejected labels", () => {
    expect(decideFact({ kind: 0, item: { labels: ["bug", { name: "accepted" }] } })).toMatchObject({
      status: 1,
      labelMask: `0x${"0".repeat(63)}5`,
    });
    expect(decideFact({ kind: 0, item: { labels: ["bug", "duplicate"] } }).status).toBe(0);
  });

  it("accepts triage with at least two labels and marks triage-done", () => {
    expect(decideFact({ kind: 1, item: { labels: ["triage-done", "needs-info"] } })).toMatchObject({
      status: 1,
      labelMask: `0x${"0".repeat(63)}8`,
    });
  });

  it("accepts merged fixes with closing keywords and encodes first sha bytes", () => {
    const sha = "abcdef1234567890000000000000000000000000";
    expect(mergedBlockFromSha(sha)).toBe(0xabcdef1234567890n);
    expect(decideFact({ kind: 2, item: { merged: true, body: "Fixes #2", merge_commit_sha: sha } })).toMatchObject({
      status: 1,
      mergedBlock: 0xabcdef1234567890n,
    });
  });

  it("accepts docs or tests PR file changes", () => {
    const item = { merged: true, merge_commit_sha: "1111111111111111000000000000000000000000" };
    expect(decideFact({ kind: 3, item, files: [{ filename: "tests/split.test.ts" }] }).labelMask).toBe(`0x${"0".repeat(63)}1`);
    expect(decideFact({ kind: 3, item, files: [{ filename: "docs/README.md" }] }).labelMask).toBe(`0x${"0".repeat(63)}2`);
    expect(decideFact({ kind: 3, item, files: [{ filename: "src/app.ts" }] }).status).toBe(0);
  });

  it("throws for unknown kind", () => {
    expect(() => decideFact({ kind: 99, item: {} })).toThrow(/unknown kind 99/);
  });
});
```

- [ ] **Step 6: Run chainlink tests, source generation, and coverage**

Run:

```bash
pnpm chainlink:build-source
pnpm test:chainlink
pnpm test:coverage:chainlink
```

Expected: tests pass. The merged SHA test fails against the old `slice(2, 18)` logic if the helper copied that bug; keep the `slice(0, 16)` behavior.

- [ ] **Step 7: Commit chainlink coverage**

Run:

```bash
git add chainlink/package.json chainlink/build-source.mjs chainlink/source-wrapper.js chainlink/source.js chainlink/source-core.js chainlink/test/source-core.test.mjs chainlink/vitest.config.ts package.json
git commit -m "test(chainlink): cover source decision core"
```

---

### Task 10: Set Thresholds and Run Full Verification

**Files:**
- Modify: `packages/shared/vitest.config.ts`
- Modify: `packages/verifier-agent/vitest.config.ts`
- Modify: `packages/coordinator/vitest.config.ts`
- Modify: `packages/web/vitest.config.ts`
- Modify: `demo/vitest.config.ts`
- Modify: `chainlink/vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Collect coverage summaries**

Run:

```bash
pnpm test:coverage
```

Expected: coverage commands complete. Record package totals in the commit message body or a short follow-up note.

- [ ] **Step 2: Add first stable thresholds**

Add thresholds only after the measured denominators are known. Use `100` for files already fully characterized and slightly lower branch thresholds where V8 branch instrumentation reports unreachable module branches. Example config shape:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "json-summary"],
  exclude: ["src/main.ts", "dist/**"],
  thresholds: {
    lines: 95,
    functions: 95,
    statements: 95,
    branches: 90,
  },
}
```

Do not lower thresholds to include excluded files. If a file is excluded, it must already be named in the design spec's Scope section.

- [ ] **Step 3: Wire all tested packages into root scripts**

Modify root `package.json` scripts:

```json
{
  "test:ts": "pnpm --filter @x502/shared exec vitest run && pnpm --filter @x502/verifier-agent exec vitest run && pnpm --filter @x502/coordinator exec vitest run && pnpm --filter @x502/demo exec vitest run && pnpm --filter @x502/web exec vitest run && pnpm test:chainlink",
  "test:coverage": "pnpm test:coverage:contracts && pnpm test:coverage:ts && pnpm test:coverage:chainlink",
  "test:coverage:ts": "pnpm --filter @x502/shared run test:coverage && pnpm --filter @x502/verifier-agent run test:coverage && pnpm --filter @x502/coordinator run test:coverage && pnpm --filter @x502/demo run test:coverage && pnpm --filter @x502/web run test:coverage"
}
```

- [ ] **Step 4: Run the complete verification suite**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm test:coverage
```

Expected:

- `pnpm test` includes contracts, shared, verifier-agent, coordinator, demo, web, and chainlink tests.
- `pnpm lint` passes for Solidity and Biome-covered packages.
- `pnpm typecheck` passes for all workspaces.
- `pnpm test:coverage` passes thresholds.

- [ ] **Step 5: Commit threshold and verification wiring**

Run:

```bash
git add package.json packages/*/vitest.config.ts demo/vitest.config.ts chainlink/vitest.config.ts
git commit -m "test: enforce runtime coverage thresholds"
```

- [ ] **Step 6: Produce final coverage summary for review**

Run:

```bash
git status --short
git log --oneline -10
```

Expected: worktree has no unrelated changes. Summarize final coverage and any remaining documented exclusions.
