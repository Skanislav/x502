import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["app/page.tsx", "app/layout.tsx", ".next/**", "dist/**"],
    },
  },
});
