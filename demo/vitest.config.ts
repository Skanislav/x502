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
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 100,
        lines: 90,
      },
    },
  },
});
