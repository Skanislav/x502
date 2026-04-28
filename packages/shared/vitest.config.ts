import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [...coverageConfigDefaults.exclude, "src/abis.ts", "scripts/**", "dist/**"],
      // Ratcheted to measured shared runtime coverage; generated ABI and scripts stay excluded.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
