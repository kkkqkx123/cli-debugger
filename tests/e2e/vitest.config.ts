import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ["./setup.ts"],
    environment: "node",
    // E2E tests are slower and need more time
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
