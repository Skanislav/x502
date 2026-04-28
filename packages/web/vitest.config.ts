import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "app/page.tsx",
        "app/layout.tsx",
        ".next/**",
        "dist/**",
      ],
      thresholds: {
        statements: 57,
        branches: 92,
        functions: 81,
        lines: 57,
      },
    },
  },
});
