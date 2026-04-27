import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["chainlink/test/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["chainlink/source-core.js"],
      exclude: ["chainlink/source.js"],
    },
  },
});
