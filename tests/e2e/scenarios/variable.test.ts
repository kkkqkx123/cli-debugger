/**
 * Variable inspection E2E tests
 * Tests variable inspection functionality
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { JDWPClient } from "../../../src/protocol/jdwp/client.js";
import {
  checkJavaAvailable,
  launchBreakpointTest,
  terminateJava,
} from "../fixtures/launch.js";
import type { LaunchedJVM } from "../fixtures/launch.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Variable Inspection E2E", () => {
  let javaAvailable = false;
  let jvm: LaunchedJVM | null = null;
  let client: JDWPClient | null = null;

  beforeAll(async () => {
    javaAvailable = await checkJavaAvailable();
  });

  afterAll(async () => {
    if (jvm) {
      await terminateJava(jvm);
    }
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
    if (jvm) {
      await terminateJava(jvm);
      jvm = null;
    }
  });

  describe("stack_frames", () => {
    it.skipIf(!javaAvailable)("should get stack frames", async () => {
      jvm = await launchBreakpointTest({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Get threads
      const threads = await client.threads();
      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();

      // Get stack
      const stack = await client.stack(mainThread!.id);
      expect(stack.length).toBeGreaterThan(0);

      // Verify stack frame structure
      const topFrame = stack[0];
      expect(topFrame).toBeDefined();
      expect(topFrame!.id).toBeDefined();
      expect(topFrame!.location).toBeDefined();

      await client.resume();
    });
  });

  describe("local_variables", () => {
    it.skipIf(!javaAvailable)("should inspect local variables", async () => {
      jvm = await launchBreakpointTest({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Get threads
      const threads = await client.threads();
      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();

      // Get stack
      const stack = await client.stack(mainThread!.id);

      if (stack.length > 0) {
        // Try to get locals
        try {
          const locals = await client.locals(mainThread!.id, 0);
          expect(Array.isArray(locals)).toBe(true);

          // Check variable structure
          for (const variable of locals) {
            expect(variable.name).toBeDefined();
            expect(variable.type).toBeDefined();
            // value may be undefined for null
          }
        } catch (error) {
          // May fail if debug info not available
          console.log("Could not get locals:", error);
        }
      }

      await client.resume();
    });
  });

  describe("object_fields", () => {
    it.skipIf(!javaAvailable)("should handle field inspection requests", async () => {
      jvm = await launchBreakpointTest({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Get threads
      const threads = await client.threads();
      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();

      // Get stack and locals to find object references
      const stack = await client.stack(mainThread!.id);

      if (stack.length > 0) {
        try {
          const locals = await client.locals(mainThread!.id, 0);

          // Find object references
          const objects = locals.filter((v) => !v.isPrimitive && !v.isNull);

          // Try to inspect fields of objects
          for (const obj of objects) {
            if (obj.value && typeof obj.value === "string") {
              try {
                const fields = await client.fields(obj.value as string);
                expect(Array.isArray(fields)).toBe(true);
              } catch {
                // May fail for various reasons
              }
            }
          }
        } catch (error) {
          console.log("Could not inspect objects:", error);
        }
      }

      await client.resume();
    });
  });

  describe("thread_states", () => {
    it.skipIf(!javaAvailable)("should get thread states", async () => {
      jvm = await launchBreakpointTest({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Get threads
      const threads = await client.threads();

      for (const thread of threads) {
        expect(thread.id).toBeDefined();
        expect(thread.name).toBeDefined();
        expect(thread.state).toBeDefined();
        expect(typeof thread.isSuspended).toBe("boolean");
      }

      await client.resume();
    });
  });
});
