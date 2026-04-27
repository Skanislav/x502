import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/abis.ts",
        "scripts/**",
        "dist/**",
      ],
    },
  },
});
