/**
 * E2E test setup
 * Configures test environment before running end-to-end tests
 */

import { beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";

// Set test timeout
process.env.NODE_ENV = "test";

/**
 * Check if a command is available
 */
async function checkCommandAvailable(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, ["version"], { stdio: "pipe" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Check if Python + debugpy is available
 */
async function checkDebugPyAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("python3", ["-m", "debugpy", "--version"], { stdio: "pipe" });
    proc.on("error", () => {
      const proc2 = spawn("python", ["-m", "debugpy", "--version"], { stdio: "pipe" });
      proc2.on("error", () => resolve(false));
      proc2.on("close", (code) => resolve(code === 0));
    });
    proc.on("close", (code) => resolve(code === 0));
  });
}

// Global setup
beforeAll(async () => {
  // Check if Java is available for JDWP tests
  const javaAvailable = await checkCommandAvailable("java");
  if (!javaAvailable) {
    console.log("Java is not available, Java E2E tests will be skipped");
  }

  // Check if Go is available for Delve tests
  const goAvailable = await checkCommandAvailable("go");
  if (!goAvailable) {
    console.log("Go is not available, Go E2E tests will be skipped");
  }

  // Check if Delve is available for Go debugging
  const dlvAvailable = await checkCommandAvailable("dlv");
  if (!dlvAvailable) {
    console.log("Delve is not available, Go E2E tests will be skipped");
  }

  // Check if Python + debugpy is available for Python tests
  const debugpyAvailable = await checkDebugPyAvailable();
  if (!debugpyAvailable) {
    console.log("Python/debugpy is not available, Python E2E tests will be skipped");
  }

  // Check if Node.js is available for JS tests
  const nodeAvailable = await checkCommandAvailable("node");
  if (!nodeAvailable) {
    console.log("Node.js is not available, JS E2E tests will be skipped");
  }
}, 30000);

// Global teardown
afterAll(async () => {
  // Any global cleanup needed
});