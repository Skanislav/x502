/// `pnpm demo` entrypoint. Today this is a thin wrapper around run-stack —
/// kept separate so we can later add `--scenario report|fix|...` flags.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

spawn("pnpm", ["exec", "tsx", "demo/scripts/run-stack.ts"], {
  cwd: REPO_ROOT,
  stdio: "inherit",
}).on("exit", (code) => process.exit(code ?? 0));
