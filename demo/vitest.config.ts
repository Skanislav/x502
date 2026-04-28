import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [...coverageConfigDefaults.exclude, "fix/**"],
      thresholds: {
        statements: 48,
        branches: 83,
        functions: 75,
        lines: 48,
      },
    },
  },
});
