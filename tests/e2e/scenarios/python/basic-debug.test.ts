/**
 * Python/debugpy Basic Debug E2E Tests
 *
 * Real-world business scenarios:
 * - A: User connects to a running Python debug target
 * - G: User disconnects cleanly
 * - I: User creates client through protocol factory
 *
 * Prerequisites:
 * - Python 3.x installed
 * - debugpy installed (`pip install debugpy`)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { DebugPyClient, createClientWithoutConnect } from "../../../../src/protocol/index.js";
import {
  checkPythonAvailable,
  checkDebugPyAvailable,
  launchSimpleProgram,
  terminatePython,
} from "../../fixtures/python-launch.js";
import type { LaunchedPython } from "../../fixtures/python-launch.js";
import type { DebugConfig } from "../../../../src/types/config.js";

let pyAvail = false;
let dpAvail = false;

beforeAll(async () => {
  pyAvail = await checkPythonAvailable();
  dpAvail = await checkDebugPyAvailable();
  if (!pyAvail || !dpAvail) {
    console.log("Python/debugpy not available, skipping E2E tests");
  }
});

describe("Python Basic Debug E2E", () => {
  let pyProc: LaunchedPython | null = null;
  let client: DebugPyClient | null = null;
  let debugPort = 0;

  afterEach(async () => {
    if (client) {
      await client.close().catch(() => {});
      client = null;
    }
    if (pyProc) {
      await terminatePython(pyProc).catch(() => {});
      pyProc = null;
    }
  });

  describe("connects to running Python program (Scenario A)", () => {
    it("should connect and get threads", async () => {
      if (!pyAvail || !dpAvail) {
        return;
      }
      pyProc = await launchSimpleProgram();
      debugPort = pyProc.debugPort;

      const config: DebugConfig = {
        protocol: "debugpy",
        host: "127.0.0.1",
        port: debugPort,
        timeout: 10000,
      };

      client = new DebugPyClient(config);
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Verify protocol metadata
      expect(client.protocolName()).toBe("py-debug");
      expect(client.supportedLanguages()).toEqual(["python"]);

      const version = await client.version();
      expect(version).toBeDefined();
      expect(version.runtimeName).toBe("python");

      // Get threads (debugpy should have at least 1)
      const threads = await client.threads();
      expect(threads.length).toBeGreaterThan(0);

      // Let program continue
      await client.resume();
    });
  });

  describe("factory creation (Scenario I)", () => {
    it("should create debugpy client through protocol factory", async () => {
      if (!pyAvail || !dpAvail) {
        return;
      }
      pyProc = await launchSimpleProgram();
      debugPort = pyProc.debugPort;

      const client2 = createClientWithoutConnect({
        protocol: "debugpy",
        host: "127.0.0.1",
        port: debugPort,
        timeout: 10000,
      });
      expect(client2.protocolName()).toBe("py-debug");

      await client2.connect();
      expect(client2.isConnected()).toBe(true);
      await client2.close();
    });
  });

  describe("clean disconnect (Scenario G)", () => {
    it("should disconnect without errors", async () => {
      if (!pyAvail || !dpAvail) {
        return;
      }
      pyProc = await launchSimpleProgram();
      debugPort = pyProc.debugPort;

      client = new DebugPyClient({
        protocol: "debugpy",
        host: "127.0.0.1",
        port: debugPort,
        timeout: 10000,
      });
      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.close();
      expect(client.isConnected()).toBe(false);
    });
  });
});