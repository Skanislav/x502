import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [...coverageConfigDefaults.exclude, "src/main.ts", "dist/**"],
      thresholds: {
        statements: 98,
        branches: 94,
        functions: 100,
        lines: 98,
      },
    },
  },
});
