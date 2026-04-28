import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "fix/**",
        // Subprocess smoke tests cover the thin CLI wrapper; scripts/commitment.ts
        // carries the assertable commitment behavior for coverage thresholds.
        "scripts/derive-commitment.ts",
      ],
      // Ratcheted to measured coverage for included runtime helpers.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
