import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: [resolve(__dirname, "setup.ts")],
    environment: "node",
    // E2E tests are slower and need more time
    singleThread: true,
  },
});
