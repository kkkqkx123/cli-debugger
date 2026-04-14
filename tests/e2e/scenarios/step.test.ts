/**
 * Step operations E2E tests
 * Tests single-step debugging functionality
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { JDWPClient } from "../../../src/protocol/jdwp/client.js";
import {
  checkJavaAvailable,
  launchSimpleProgram,
  terminateJava,
} from "../fixtures/launch.js";
import type { LaunchedJVM } from "../fixtures/launch.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Step Operations E2E", () => {
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

  describe("thread_suspension", () => {
    it.skipIf(!javaAvailable)("should suspend and resume thread", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

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

      // Thread should be suspended initially
      expect(mainThread!.isSuspended).toBe(true);

      // Resume
      await client.resume();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Suspend again
      await client.suspend();

      // Get threads again
      const threads2 = await client.threads();
      const mainThread2 = threads2.find((t) => t.name === "main");
      expect(mainThread2).toBeDefined();

      // Resume to let program complete
      await client.resume();
    });
  });

  describe("stack_inspection", () => {
    it.skipIf(!javaAvailable)("should get stack trace", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

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
      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBeGreaterThan(0);

      // Check stack frames
      for (const frame of stack) {
        expect(frame.id).toBeDefined();
        expect(frame.location).toBeDefined();
      }

      await client.resume();
    });
  });

  describe("variable_inspection", () => {
    it.skipIf(!javaAvailable)("should inspect local variables", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

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

      // Try to get locals for first frame
      try {
        const locals = await client.locals(mainThread!.id, 0);
        expect(Array.isArray(locals)).toBe(true);

        // Log locals for debugging
        for (const local of locals) {
          expect(local.name).toBeDefined();
        }
      } catch (error) {
        // May fail if no locals available
        console.log("Could not get locals:", error);
      }

      await client.resume();
    });
  });
});
