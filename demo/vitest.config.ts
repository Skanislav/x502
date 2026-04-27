import { defineConfig } from "vitest/config";

// Only the planted test file under `test/` runs by default. The reference fix
// material in `fix/` uses the same `*.test.ts` suffix for editor support but
// is intentionally excluded from the demo's default test run.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
