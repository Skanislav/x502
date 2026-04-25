// Extracts ABIs + bytecode from forge build output into packages/shared/src/abis.ts.
// Run after `forge build` whenever contract interfaces change.
//
//   pnpm --filter @x502/shared extract-abis
//
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const out = join(root, "contracts/out");
const target = join(__dirname, "../src/abis.ts");

const sources = {
  bountyVault: "BountyVault.sol/BountyVault.json",
  gitHubFactReceiver: "GitHubFactReceiver.sol/GitHubFactReceiver.json",
  mockUSDC: "MockUSDC.sol/MockUSDC.json",
  mockAgentRegistry: "MockAgentRegistry.sol/MockAgentRegistry.json",
  mockGitHubFactProvider: "MockGitHubFactProvider.sol/MockGitHubFactProvider.json",
  mockFunctionsRouter: "MockFunctionsRouter.sol/MockFunctionsRouter.json",
} as const;

const lines: string[] = [
  "// Auto-generated from contracts/out/. Do not edit by hand.",
  "// Run: pnpm --filter @x502/shared extract-abis",
  "",
];
for (const [name, path] of Object.entries(sources)) {
  const artifact = JSON.parse(readFileSync(join(out, path), "utf8"));
  lines.push(`export const ${name}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const;`);
  lines.push("");
  lines.push(
    `export const ${name}Bytecode = ${JSON.stringify(artifact.bytecode.object)} as \`0x\${string}\`;`,
  );
  lines.push("");
}

writeFileSync(target, lines.join("\n"));
console.log(`wrote ${target}`);
