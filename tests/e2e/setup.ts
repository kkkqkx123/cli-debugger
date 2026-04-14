/**
 * E2E test setup
 * Configures test environment before running end-to-end tests
 */

import { beforeAll, afterAll } from "vitest";

// Set test timeout
process.env.NODE_ENV = "test";

// Global setup
beforeAll(async () => {
  // Check if Java is available
  // E2E tests require a JVM to run
}, 30000);

// Global teardown
afterAll(async () => {
  // Any global cleanup needed
});
