import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: ["tests/integration/setup.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/protocol/jdwp/**/*.ts"],
      exclude: ["src/protocol/jdwp/**/__tests__/**"],
    },
  },
});
