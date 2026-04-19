/**
 * Basic debug E2E tests
 * Tests basic debugging scenarios with real JVM
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { JDWPClient } from "../../../../src/protocol/jdwp/client.js";
import {
  checkJavaAvailable,
  launchSimpleProgram,
  terminateJava,
} from "../../fixtures/launch.js";
import type { LaunchedJVM } from "../../fixtures/launch.js";
import type { DebugConfig } from "../../../../src/types/config.js";

describe("Basic Debug E2E", () => {
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

  describe("simple_java_program", () => {
    it("should debug simple Java program", async () => {
      // Launch JVM
      jvm = await launchSimpleProgram({ suspend: true });

      // Connect debugger
      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Get version
      const version = await client.version();
      expect(version).toBeDefined();
      expect(version.runtimeName).toBeDefined();
      expect(version.runtimeVersion).toBeDefined();

      // Get capabilities
      const caps = await client.capabilities();
      expect(caps).toBeDefined();

      // Get threads
      const threads = await client.threads();
      expect(threads.length).toBeGreaterThan(0);

      // Find main thread
      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();

      // Resume and let program run
      await client.resume();

      // Wait for program to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("should get thread information", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      const threads = await client.threads();

      // Should have at least main thread
      expect(threads.length).toBeGreaterThan(0);

      // Main thread should exist
      const mainThread = threads.find((t) => t.name === "main");
      expect(mainThread).toBeDefined();
      expect(mainThread!.id).toBeDefined();

      await client.resume();
    });
  });

  describe("connection_management", () => {
    it("should connect and disconnect cleanly", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);

      // Connect
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Disconnect
      await client.close();
      expect(client.isConnected()).toBe(false);

      // Resume the program to let it continue running
      // Note: After disconnect, we need to reconnect to resume
      try {
        client = new JDWPClient(config);
        await client.connect();
        await client.resume();
      } catch {
        // If reconnection fails, the program may have already exited
        // This is acceptable
      }
    });
  });

  describe("metadata_queries", () => {
    it("should query VM metadata", async () => {
      jvm = await launchSimpleProgram({ suspend: true });

      const config: DebugConfig = {
        protocol: "jdwp",
        host: "127.0.0.1",
        port: jvm.debugPort,
        timeout: 10000,
      };

      client = new JDWPClient(config);
      await client.connect();

      // Version
      const version = await client.version();
      expect(version.description).toBeDefined();
      expect(version.protocolVersion).toBeDefined();

      // Capabilities
      const caps = await client.capabilities();
      expect(caps).toBeDefined();

      // Protocol info
      expect(client.protocolName()).toBe("jdwp");
      expect(client.supportedLanguages()).toContain("java");

      await client.resume();
    });
  });
});
