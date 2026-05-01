import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";

/// Returns the contents of `demo/.runtime/addresses.json` to the browser so
/// the demo stepper can pre-fill recipient + coordinator URL. Returns 404
/// if the file isn't present (i.e. the demo stack hasn't been booted).
export async function GET() {
  // app/api/demo-config/route.ts → packages/web/app/api/demo-config
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Repo root from packages/web/app/api/demo-config
    resolve(here, "..", "..", "..", "..", "..", "..", "demo", ".runtime", "addresses.json"),
    // Fallback when bundled differently
    resolve(process.cwd(), "..", "..", "demo", ".runtime", "addresses.json"),
    resolve(process.cwd(), "demo", ".runtime", "addresses.json"),
  ];
  for (const path of candidates) {
    try {
      const raw = await readFile(path, "utf8");
      return new NextResponse(raw, {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    } catch {
      /* try next candidate */
    }
  }
  return NextResponse.json({ error: "demo runtime not found" }, { status: 404 });
}
