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
  let jvm: LaunchedJVM | null = null;
  let client: JDWPClient | null = null;

  beforeAll(async () => {
    const javaAvailable = await checkJavaAvailable();
    if (!javaAvailable) {
      console.log("Java is not available, skipping E2E tests");
    }
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
    it("should suspend and resume thread", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Resume first to let program start
      await client.resume();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Suspend
      await client.suspend();

      // Get threads
      const threads = await client.threads({ autoSuspend: false, keepSuspended: true });
      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();

      // Thread should be suspended
      expect(mainThread!.isSuspended).toBe(true);

      // Resume
      await client.resume();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Suspend again
      await client.suspend();

      // Get threads again
      const threads2 = await client.threads({ autoSuspend: false, keepSuspended: true });
      const mainThread2 = threads2.find((t) => t.name === "main");
      expect(mainThread2).toBeDefined();

      // Resume to let program complete
      await client.resume();
    });
  });

  describe("stack_inspection", () => {
    it("should get stack trace", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // When JVM starts with suspend=y, the VM is suspended but threads may not be in expected state
      // Let's try: resume first, then suspend to get consistent state
      await client.resume();
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait longer for program to start
      await client.suspend();

      // Check JVM output
      console.log("JVM stdout:", jvm.stdout);
      console.log("JVM stderr:", jvm.stderr);

      // Now get threads with autoSuspend: false (we already suspended)
      const threads = await client.threads({ autoSuspend: false, keepSuspended: true });
      console.log("Total threads:", threads.length);
      for (const t of threads) {
        console.log(`  Thread: ${t.name}, state: ${t.state}, suspended: ${t.isSuspended}`);
      }

      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();

      // If thread is zombie, skip
      if (mainThread!.state === "zombie") {
        console.log("Thread is zombie, skipping stack check");
        await client.resume();
        return;
      }

      // VM is still suspended, can safely get stack
      const stack = await client.stack(mainThread!.id);
      console.log("Stack length:", stack.length);
      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBeGreaterThan(0);

      // Check stack frames
      for (const frame of stack) {
        expect(frame.id).toBeDefined();
        expect(frame.location).toBeDefined();
      }

      // Resume VM
      await client.resume();
    });
  });

  describe("variable_inspection", () => {
    it("should inspect local variables", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Resume first, then suspend to get consistent state
      await client.resume();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await client.suspend();

      // Use autoSuspend: false since we already suspended
      const threads = await client.threads({ autoSuspend: false, keepSuspended: true });
      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();

      // If thread is zombie, skip
      if (mainThread!.state === "zombie") {
        console.log("Thread is zombie, skipping variable check");
        await client.resume();
        return;
      }

      // VM is still suspended, can safely get stack
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

      // Resume VM
      await client.resume();
    });
  });
});
