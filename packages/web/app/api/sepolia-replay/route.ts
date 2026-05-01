import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";

/// Returns the recorded Base Sepolia replay fixture so the demo UI can show a
/// "real-network proof" tab without making any live network calls during a
/// stage demo. The fixture is committed at
/// `demo/scripts/sepolia-replay.fixture.json` and is intended to be updated
/// when a fresh end-to-end run is captured (see `demo/README.md`).
export async function GET() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(
      here,
      "..",
      "..",
      "..",
      "..",
      "..",
      "..",
      "demo",
      "scripts",
      "sepolia-replay.fixture.json",
    ),
    resolve(process.cwd(), "..", "..", "demo", "scripts", "sepolia-replay.fixture.json"),
    resolve(process.cwd(), "demo", "scripts", "sepolia-replay.fixture.json"),
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
  return NextResponse.json({ error: "fixture not found" }, { status: 404 });
}
