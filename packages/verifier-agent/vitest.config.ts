import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [...coverageConfigDefaults.exclude, "src/main.ts", "dist/**"],
      // Ratcheted to measured coverage for included runtime modules.
      thresholds: {
        statements: 98,
        branches: 87,
        functions: 95,
        lines: 98,
      },
    },
  },
});
