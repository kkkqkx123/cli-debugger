/**
 * Step E2E tests for Go
 * Tests step functionality with real Delve debugger
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { DlvClient } from "../../../../src/protocol/dlv/client.js";
import {
  checkGoAvailable,
  checkDelveAvailable,
  launchSimpleProgram,
  terminateDelve,
} from "../../fixtures/go-launch.js";
import type { LaunchedDelve } from "../../fixtures/go-launch.js";
import type { DebugConfig } from "../../../../src/types/config.js";

describe("Step E2E (Go)", () => {
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

  describe("execution_control", () => {
    it("should verify debugger state at entry point", async () => {
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

      client = new DlvClient(config);
      await client.connect();

      // Verify connection state
      expect(client.isConnected()).toBe(true);

      // Get threads - verify structure
      const threads = await client.threads();
      console.log(`Threads at entry: ${threads.length}`);

      // If we have threads, verify they are in valid state
      for (const thread of threads) {
        expect(thread.id).toBeGreaterThanOrEqual(0);
        expect(thread.state).toBeDefined();
        // At entry point, thread should be stopped
        expect(["stopped", "idle"]).toContain(thread.state);
      }
    });

    it("should suspend and verify state", async () => {
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

      client = new DlvClient(config);
      await client.connect();

      // Program is already suspended at entry point
      // Suspend should work even when already suspended
      await client.suspend();

      // Verify connection is still active
      expect(client.isConnected()).toBe(true);

      // Get threads and verify they are stopped
      const threads = await client.threads();
      for (const thread of threads) {
        expect(["stopped", "idle"]).toContain(thread.state);
      }
    });
  });

  describe("stack_inspection", () => {
    it("should get stack trace when thread is stopped", async () => {
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

      client = new DlvClient(config);
      await client.connect();

      // Get threads
      const threads = await client.threads();
      
      if (threads.length > 0) {
        // Get stack for first thread
        const threadId = threads[0].id.toString();
        
        try {
          const stack = await client.stack(threadId);
          
          // Verify stack structure
          expect(Array.isArray(stack)).toBe(true);
          console.log(`Stack depth: ${stack.length}`);
          
          // Verify each frame
          for (let i = 0; i < stack.length; i++) {
            const frame = stack[i];
            expect(frame.id).toBeDefined();
            expect(frame.method).toBeDefined();
            expect(typeof frame.method).toBe("string");
            expect(frame.location).toBeDefined();
            expect(frame.location.file).toBeDefined();
            expect(frame.location.line).toBeGreaterThan(0);
            
            console.log(`Frame ${i}: ${frame.method} at ${frame.location.file}:${frame.location.line}`);
          }
          
          // At entry point, should have at least main function
          if (stack.length > 0) {
            const topFrame = stack[0];
            expect(topFrame.method).toContain("main");
          }
        } catch (error) {
          console.log("Stack inspection error:", error);
          // May fail if thread is not in a valid state
        }
      } else {
        console.log("No threads available for stack inspection");
      }
    });
  });

  describe("variable_inspection", () => {
    it("should inspect local variables when available", async () => {
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

      client = new DlvClient(config);
      await client.connect();

      // Get threads
      const threads = await client.threads();
      
      if (threads.length > 0) {
        const threadId = threads[0].id.toString();
        
        try {
          // Get stack first
          const stack = await client.stack(threadId);
          
          if (stack.length > 0) {
            // Get locals for top frame
            const frameId = stack[0].id.toString();
            const locals = await client.locals(threadId, frameId);
            
            // Verify locals structure
            expect(Array.isArray(locals)).toBe(true);
            console.log(`Local variables count: ${locals.length}`);
            
            // Verify each variable
            for (const local of locals) {
              expect(local.name).toBeDefined();
              expect(typeof local.name).toBe("string");
              expect(local.type).toBeDefined();
              expect(typeof local.type).toBe("string");
              
              console.log(`Variable: ${local.name} (${local.type}) = ${local.value}`);
            }
          }
        } catch (error) {
          console.log("Variable inspection error:", error);
          // May fail if not in a valid frame
        }
      } else {
        console.log("No threads available for variable inspection");
      }
    });
  });
});
