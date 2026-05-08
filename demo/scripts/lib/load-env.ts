/// Tiny .env loader for the demo scripts. Reads `<repo>/.env` once at
/// startup and copies missing keys into `process.env`. Skips lines that are
/// blank, comments, or already exported. Values may be wrapped in single or
/// double quotes (the wrappers are stripped). Existing process.env values
/// always win.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

export function loadDotEnv(repoRoot: string): void {
  const path = resolve(repoRoot, ".env");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!KEY_RE.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    // Strip inline comments only when the value is not quoted. A `#` that is
    // preceded by whitespace and appears outside quotes ends the value.
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (!quoted) {
      const commentMatch = value.match(/\s+#/);
      if (commentMatch && commentMatch.index !== undefined) {
        value = value.slice(0, commentMatch.index).trim();
      }
    } else {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
