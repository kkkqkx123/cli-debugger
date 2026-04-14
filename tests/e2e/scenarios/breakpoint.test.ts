/**
 * Breakpoint E2E tests
 * Tests breakpoint functionality with real JVM
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

describe("Breakpoint E2E", () => {
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

  describe("breakpoint_management", () => {
    it.skipIf(!javaAvailable)("should clear all breakpoints", async () => {
      jvm = await launchBreakpointTest({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Clear all breakpoints
      await client.clearBreakpoints();

      // Verify cleared
      const bps = await client.breakpoints();
      expect(bps.length).toBe(0);

      await client.resume();
    });

    it.skipIf(!javaAvailable)("should list breakpoints", async () => {
      jvm = await launchBreakpointTest({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Get breakpoints (should be empty initially)
      const bps = await client.breakpoints();
      expect(Array.isArray(bps)).toBe(true);

      await client.clearBreakpoints();
      await client.resume();
    });
  });

  describe("breakpoint_workflow", () => {
    it.skipIf(!javaAvailable)("should handle breakpoint operations", async () => {
      jvm = await launchBreakpointTest({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Clear any existing breakpoints
      await client.clearBreakpoints();

      // Get threads
      const threads = await client.threads();
      expect(threads.length).toBeGreaterThan(0);

      // Resume to let program run
      await client.resume();

      // Wait for program to complete
      await new Promise((resolve) => setTimeout(resolve, 3000));
    });
  });
});
