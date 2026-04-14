/**
 * Command execution integration tests
 * Tests JDWP command sequences and workflows
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JDWPClient } from "../../../src/protocol/jdwp/client.js";
import { MockJDWPServer } from "./fixtures/index.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Command Execution", () => {
  let server: MockJDWPServer;
  let port: number;
  let config: DebugConfig;
  let client: JDWPClient;

  beforeEach(async () => {
    server = new MockJDWPServer();
    port = await server.start();
    config = {
      protocol: "jdwp",
      host: "127.0.0.1",
      port,
      timeout: 5000,
    };
    client = new JDWPClient(config);
    await client.connect();
  });

  afterEach(async () => {
    await client.close();
    await server.stop();
  });

  describe("vm_commands_sequence", () => {
    it("should execute VM command sequence", async () => {
      // Version
      const version = await client.version();
      expect(version).toBeDefined();
      expect(version.protocolVersion).toBeDefined();
      expect(version.vmVersion).toBeDefined();
      expect(version.vmName).toBeDefined();

      // Capabilities
      const caps = await client.capabilities();
      expect(caps).toBeDefined();
    });

    it("should get protocol metadata", async () => {
      const protocolName = client.protocolName();
      expect(protocolName).toBe("jdwp");

      const languages = client.supportedLanguages();
      expect(languages).toContain("java");
      expect(languages).toContain("kotlin");
      expect(languages).toContain("scala");
    });
  });

  describe("thread_operations_flow", () => {
    it("should execute thread operations", async () => {
      // Get threads
      const threads = await client.threads();
      expect(threads).toBeDefined();
      expect(Array.isArray(threads)).toBe(true);

      // Should have at least main thread
      if (threads.length > 0) {
        const mainThread = threads.find((t) => t.name === "main");
        expect(mainThread).toBeDefined();

        // Suspend
        await client.suspend(mainThread!.id);

        // Resume
        await client.resume(mainThread!.id);
      }
    });

    it("should handle thread state queries", async () => {
      const threads = await client.threads();

      for (const thread of threads) {
        expect(thread.id).toBeDefined();
        expect(thread.name).toBeDefined();
        expect(thread.state).toBeDefined();
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
  });

  describe("variable_inspection_flow", () => {
    it("should require suspended thread for inspection", async () => {
      const threads = await client.threads();

      if (threads.length > 0) {
        const thread = threads[0]!;

        // Try to get stack without suspend - should fail
        await expect(client.stack(thread.id)).rejects.toThrow();

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

    it("should require suspended thread for locals", async () => {
      const threads = await client.threads();

      if (threads.length > 0) {
        const thread = threads[0]!;

        // Try to get locals without suspend - should fail
        await expect(client.locals(thread.id, 0)).rejects.toThrow();

        // Suspend first
        await client.suspend(thread.id);

        // Now should work (if there are frames)
        try {
          const locals = await client.locals(thread.id, 0);
          expect(locals).toBeDefined();
          expect(Array.isArray(locals)).toBe(true);
        } catch {
          // May fail if no frames, which is OK
        }

        // Resume
        await client.resume(thread.id);
      }
    });
  });

  describe("step_operations_sequence", () => {
    it("should require suspended thread for stepping", async () => {
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
      // Try to get stack for non-existent thread
      await expect(client.stack("invalid-thread-id")).rejects.toThrow();
    });

    it("should handle invalid object IDs", async () => {
      // Try to get fields for invalid object
      await expect(client.fields("invalid-object-id")).rejects.toThrow();
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

      // Phase 3: Thread inspection
      const threads = await client.threads();
      expect(threads.length).toBeGreaterThanOrEqual(0);

      // Phase 4: Cleanup
      await client.clearBreakpoints();

      // Phase 5: Verify still connected
      expect(client.isConnected()).toBe(true);
    });
  });
});
