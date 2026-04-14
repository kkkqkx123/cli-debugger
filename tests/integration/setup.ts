/**
 * Integration test setup
 * Configures test environment before running integration tests
 */

import { beforeAll, afterAll } from "vitest";

// Set test timeout
process.env.NODE_ENV = "test";

// Global setup
beforeAll(async () => {
  // Any global setup needed for integration tests
}, 10000);

// Global teardown
afterAll(async () => {
  // Any global cleanup needed
});
