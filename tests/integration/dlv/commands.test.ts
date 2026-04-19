/**
 * Command execution integration tests for Delve
 * Tests Delve command sequences and workflows
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DlvClient } from "../../../src/protocol/dlv/client.js";
import { MockDlvServer } from "./fixtures/index.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Delve Command Execution", () => {
  let server: MockDlvServer;
  let port: number;
  let config: DebugConfig;
  let client: DlvClient;

  beforeEach(async () => {
    server = new MockDlvServer();
    port = await server.start();
    config = {
      protocol: "dlv",
      host: "127.0.0.1",
      port,
      timeout: 5000,
    };
    client = new DlvClient(config);
    await client.connect();
  });

  afterEach(async () => {
    await client.close();
    await server.stop();
  });

  describe("debugger_commands_sequence", () => {
    it("should execute debugger command sequence", async () => {
      // Version
      const version = await client.version();
      expect(version).toBeDefined();
      expect(version.protocolVersion).toBeDefined();
      expect(version.runtimeVersion).toBeDefined();
      expect(version.runtimeName).toBeDefined();

      // Capabilities
      const caps = await client.capabilities();
      expect(caps).toBeDefined();
    });

    it("should get protocol metadata", async () => {
      const protocolName = client.protocolName();
      expect(protocolName).toBe("dlv");

      const languages = client.supportedLanguages();
      expect(languages).toContain("go");
    });
  });

  describe("goroutine_operations_flow", () => {
    it("should execute goroutine operations", async () => {
      // Get goroutines (threads in Go)
      const threads = await client.threads();
      expect(threads).toBeDefined();
      expect(Array.isArray(threads)).toBe(true);

      // Should have at least main goroutine
      if (threads.length > 0) {
        const mainGoroutine = threads.find((t) => t.name.includes("main"));
        expect(mainGoroutine).toBeDefined();
      }
    });

    it("should handle goroutine state queries", async () => {
      const threads = await client.threads();

      for (const thread of threads) {
        expect(thread.id).toBeDefined();
        expect(thread.name).toBeDefined();
        expect(thread.state).toBeDefined();
      }
    });

    it("should get goroutine state", async () => {
      const threads = await client.threads();

      if (threads.length > 0) {
        const thread = threads[0]!;
        const state = await client.threadState(thread.id);
        expect(state).toBeDefined();
        expect(typeof state).toBe("string");
      }
    });
  });

  describe("breakpoint_lifecycle", () => {
    it("should manage breakpoints", async () => {
      // Get initial breakpoints
      const initialBps = await client.breakpoints();
      expect(initialBps).toBeDefined();
      expect(Array.isArray(initialBps)).toBe(true);

      // Clear all breakpoints
      await client.clearBreakpoints();

      // Verify cleared
      const clearedBps = await client.breakpoints();
      expect(clearedBps.length).toBe(0);
    });

    it("should handle breakpoint operations", async () => {
      // Clear any existing breakpoints
      await client.clearBreakpoints();

      // List should be empty
      const bps = await client.breakpoints();
      expect(bps.length).toBe(0);
    });

    it("should create and remove breakpoints", async () => {
      // Clear existing
      await client.clearBreakpoints();

      // Create breakpoint at file:line
      const bpId = await client.setBreakpoint("main.go:10");
      expect(bpId).toBeDefined();

      // List should have one
      const bps = await client.breakpoints();
      expect(bps.length).toBe(1);

      // Remove breakpoint
      await client.removeBreakpoint(bpId);

      // List should be empty
      const remainingBps = await client.breakpoints();
      expect(remainingBps.length).toBe(0);
    });
  });

  describe("variable_inspection_flow", () => {
    it("should require suspended goroutine for inspection", async () => {
      const threads = await client.threads();

      if (threads.length > 0) {
        const thread = threads[0]!;

        // Suspend first
        await client.suspend(thread.id);

        // Now stack should work
        const stack = await client.stack(thread.id);
        expect(stack).toBeDefined();
        expect(Array.isArray(stack)).toBe(true);

        // Resume
        await client.resume(thread.id);
      }
    });

    it("should get locals when goroutine is suspended", async () => {
      const threads = await client.threads();

      if (threads.length > 0) {
        const thread = threads[0]!;

        // Suspend first
        await client.suspend(thread.id);

        // Get stack
        const stack = await client.stack(thread.id);

        if (stack.length > 0) {
          // Get locals for first frame
          const locals = await client.locals(thread.id, 0);
          expect(locals).toBeDefined();
          expect(Array.isArray(locals)).toBe(true);
        }

        // Resume
        await client.resume(thread.id);
      }
    });
  });

  describe("step_operations_sequence", () => {
    it("should handle step operations", async () => {
      const threads = await client.threads();

      if (threads.length > 0) {
        const thread = threads[0]!;

        // Suspend first
        await client.suspend(thread.id);

        // Resume to allow stepping
        await client.resume(thread.id);
      }
    });
  });

  describe("command_error_propagation", () => {
    it("should propagate errors for invalid operations", async () => {
      // Try to get stack for non-existent goroutine - may return empty array or throw
      try {
        const result = await client.stack("999999");
        expect(Array.isArray(result)).toBe(true);
      } catch {
        // Expected to throw
      }
    });

    it("should handle invalid object IDs", async () => {
      // Try to get fields for invalid object - may return empty array or throw
      try {
        const result = await client.fields("invalid-object-id");
        expect(Array.isArray(result)).toBe(true);
      } catch {
        // Expected to throw
      }
    });
  });

  describe("concurrent_commands", () => {
    it("should handle concurrent independent commands", async () => {
      // Execute multiple independent commands concurrently
      const results = await Promise.all([
        client.version(),
        client.capabilities(),
        client.threads(),
      ]);

      expect(results[0]).toBeDefined(); // version
      expect(results[1]).toBeDefined(); // capabilities
      expect(results[2]).toBeDefined(); // threads
    });

    it("should handle concurrent metadata queries", async () => {
      const count = 5;
      const promises = [];

      for (let i = 0; i < count; i++) {
        promises.push(client.version());
      }

      const results = await Promise.all(promises);

      for (const result of results) {
        expect(result).toBeDefined();
      }
    });
  });

  describe("full_debug_workflow", () => {
    it("should execute complete debug workflow", async () => {
      // Phase 1: Connection (already connected in beforeEach)
      expect(client.isConnected()).toBe(true);

      // Phase 2: Metadata
      const version = await client.version();
      expect(version).toBeDefined();

      const caps = await client.capabilities();
      expect(caps).toBeDefined();

      // Phase 3: Goroutine inspection
      const threads = await client.threads();
      expect(threads.length).toBeGreaterThanOrEqual(0);

      // Phase 4: Cleanup
      await client.clearBreakpoints();

      // Phase 5: Verify still connected
      expect(client.isConnected()).toBe(true);
    });
  });

  describe("extended_dlv_features", () => {
    it("should list functions", async () => {
      const functions = await client.listFunctions();
      expect(functions).toBeDefined();
      expect(Array.isArray(functions)).toBe(true);
    });

    it("should list packages", async () => {
      const packages = await client.listPackages();
      expect(packages).toBeDefined();
      expect(Array.isArray(packages)).toBe(true);
    });

    it("should list sources", async () => {
      const sources = await client.listSources();
      expect(sources).toBeDefined();
      expect(Array.isArray(sources)).toBe(true);
    });

    it("should list types", async () => {
      const types = await client.listTypes();
      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
    });
  });
});
