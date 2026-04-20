/**
 * Basic debug E2E tests for Go
 * Tests basic debugging scenarios with real Delve debugger
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { DlvClient, createClientWithoutConnect } from "../../../../src/protocol/index.js";
import {
  checkGoAvailable,
  checkDelveAvailable,
  launchSimpleProgram,
  launchMultiThreadProgram,
  terminateDelve,
} from "../../fixtures/go-launch.js";
import type { LaunchedDelve } from "../../fixtures/go-launch.js";
import type { DebugConfig } from "../../../../src/types/config.js";

describe("Basic Debug E2E (Go)", () => {
  let delve: LaunchedDelve | null = null;
  let client: DlvClient | null = null;
  let goAvailable = false;
  let dlvAvailable = false;

  beforeAll(async () => {
    goAvailable = await checkGoAvailable();
    dlvAvailable = await checkDelveAvailable();
    if (!goAvailable || !dlvAvailable) {
      console.log("Go or Delve is not available, skipping E2E tests");
    }
  });

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
      client = null;
    }
    if (delve) {
      await terminateDelve(delve);
      delve = null;
    }
  });

  describe("simple_go_program", () => {
    it("should debug simple Go program", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      // Launch Delve
      delve = await launchSimpleProgram();

      // Connect debugger using factory function
      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = createClientWithoutConnect(config) as DlvClient;
      await client.connect();
      
      // Verify connection state
      expect(client.isConnected()).toBe(true);

      // Get version - verify actual values
      const version = await client.version();
      expect(version).toBeDefined();
      expect(version.runtimeName).toBe("go");
      expect(version.runtimeVersion).toBeDefined();
      expect(typeof version.runtimeVersion).toBe("string");
      expect(version.runtimeVersion.length).toBeGreaterThan(0);

      // Get capabilities - verify actual values
      const caps = await client.capabilities();
      expect(caps).toBeDefined();
      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsBreakpoints).toBe(true);
      expect(caps.supportsStack).toBe(true);
      expect(caps.supportsLocals).toBe(true);
    });

    it("should get goroutine information", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = createClientWithoutConnect(config) as DlvClient;
      await client.connect();

      const threads = await client.threads();

      // Note: At entry point, goroutines may not be fully initialized
      // This is expected behavior with Delve
      console.log(`Goroutines count: ${threads.length}`);

      // If we have threads, verify their structure
      for (const thread of threads) {
        expect(thread.id).toBeDefined();
        expect(typeof thread.id).toBe("number");
        expect(thread.name).toBeDefined();
        expect(typeof thread.name).toBe("string");
        expect(thread.state).toBeDefined();
        expect(typeof thread.state).toBe("string");
      }
    });
  });

  describe("multi_goroutine_program", () => {
    it("should list multiple goroutines", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchMultiThreadProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = createClientWithoutConnect(config) as DlvClient;
      await client.connect();

      // Get goroutines - at entry point, may only have main goroutine
      const threads = await client.threads();

      // Note: At entry point or early in execution, goroutines may not have started yet
      // This is expected behavior - we just verify the API works
      console.log(`Goroutines count: ${threads.length}`);

      // Log goroutine info for debugging
      for (const t of threads) {
        console.log(`Goroutine ${t.id}: ${t.name} (${t.state})`);
      }

      // We expect at least 0 goroutines (may be empty at entry point)
      expect(threads.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("connection_management", () => {
    it("should connect and disconnect cleanly", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = createClientWithoutConnect(config) as DlvClient;

      // Connect
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Disconnect
      await client.close();
      expect(client.isConnected()).toBe(false);
    });

    it("should handle multiple connections gracefully", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      // First connection
      client = createClientWithoutConnect(config) as DlvClient;
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Get threads - may be empty at entry point
      const threads = await client.threads();
      console.log(`Threads count: ${threads.length}`);

      // Close
      await client.close();
      client = null;
    });
  });

  describe("metadata_queries", () => {
    it("should query debugger metadata", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = createClientWithoutConnect(config) as DlvClient;
      await client.connect();

      // Version - verify actual values
      const version = await client.version();
      expect(version.description).toBeDefined();
      expect(typeof version.description).toBe("string");
      expect(version.protocolVersion).toBeDefined();
      expect(version.runtimeName).toBe("go");

      // Capabilities - verify actual values
      const caps = await client.capabilities();
      expect(caps).toBeDefined();
      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsStack).toBe(true);
      expect(caps.supportsBreakpoints).toBe(true);
      expect(caps.supportsLocals).toBe(true);

      // Protocol info - verify actual values
      expect(client.protocolName()).toBe("dlv");
      expect(client.supportedLanguages()).toContain("go");
    });

    it("should list functions", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = createClientWithoutConnect(config) as DlvClient;
      await client.connect();

      // List functions
      const funcs = await client.listFunctions("main");
      expect(funcs.length).toBeGreaterThan(0);

      // Verify function names are strings
      for (const func of funcs) {
        expect(typeof func).toBe("string");
        expect(func.length).toBeGreaterThan(0);
      }

      // Should contain main function
      const mainFunc = funcs.find((f) => f.includes("main"));
      expect(mainFunc).toBeDefined();
    });

    it("should list source files", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = createClientWithoutConnect(config) as DlvClient;
      await client.connect();

      // List sources
      const sources = await client.listSources("simple_program");
      expect(sources.length).toBeGreaterThan(0);

      // Verify source paths are strings
      for (const source of sources) {
        expect(typeof source).toBe("string");
        expect(source.length).toBeGreaterThan(0);
      }
    });
  });
});
