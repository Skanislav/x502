import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["chainlink/test/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["chainlink/source-core.js"],
      exclude: [...coverageConfigDefaults.exclude, "chainlink/source.js"],
      thresholds: {
        statements: 100,
        branches: 92,
        functions: 100,
        lines: 100,
      },
    },
  },
});
