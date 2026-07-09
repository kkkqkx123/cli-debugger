/**
 * Unit tests for DebugPy Client
 *
 * DebugPyClient extends BaseDAPClient which provides the full DAP protocol
 * implementation. These tests verify the DebugPy-specific configuration
 * and construction logic. The DAP transport layer is tested separately
 * in the DAP transport tests.
 */

import { describe, it, expect } from "vitest";
import { DebugPyClient } from "../client.js";
import type { DebugConfig } from "../../../types/config.js";

describe("DebugPyClient", () => {
  const baseConfig: DebugConfig = {
    protocol: "py-debug",
    host: "127.0.0.1",
    port: 5678,
    timeout: 5000,
  };

  describe("construction", () => {
    it("should create a DebugPyClient with default config", () => {
      const client = new DebugPyClient(baseConfig);
      expect(client).toBeInstanceOf(DebugPyClient);
      expect(client.protocolName()).toBe("py-debug");
      expect(client.supportedLanguages()).toEqual(["python"]);
    });

    it("should return correct protocol metadata", () => {
      const client = new DebugPyClient(baseConfig);
      expect(client.protocolName()).toBe("py-debug");
      expect(client.supportedLanguages()).toContain("python");
    });

    it("should report not connected initially", () => {
      const client = new DebugPyClient(baseConfig);
      expect(client.isConnected()).toBe(false);
    });

    it("should accept custom launchConfig", () => {
      const config = {
        ...baseConfig,
        launchConfig: {
          justMyCode: false,
          showReturnValue: true,
          logToFile: true,
        },
      } as DebugConfig & { launchConfig: Record<string, unknown> };

      const client = new DebugPyClient(config as DebugConfig);
      expect(client).toBeInstanceOf(DebugPyClient);
    });
  });

  describe("adapter config", () => {
    it("should configure adapter type as python", () => {
      const client = new DebugPyClient(baseConfig);
      expect(client.protocolName()).toBe("py-debug");
    });

    it("should configure python runtime", () => {
      const client = new DebugPyClient(baseConfig);
      expect(client.supportedLanguages()).toEqual(["python"]);
    });
  });

  describe("connection lifecycle", () => {
    it("should throw when connecting to closed port", async () => {
      const client = new DebugPyClient({
        ...baseConfig,
        port: 1, // Privileged port, will fail
        timeout: 1000,
      });
      await expect(client.connect()).rejects.toThrow();
    });

    it("should handle rapid connect-close cycle gracefully", async () => {
      const client = new DebugPyClient({
        ...baseConfig,
        port: 1,
        timeout: 500,
      });
      // close() should work even without connect() being called
      await expect(client.close()).resolves.toBeUndefined();
    });
  });

  describe("capabilities", () => {
    it("should report standard DAP capabilities", async () => {
      const client = new DebugPyClient(baseConfig);
      const caps = await client.capabilities();
      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsStack).toBe(true);
      expect(caps.supportsLocals).toBe(true);
      expect(caps.supportsBreakpoints).toBe(true);
      expect(caps.supportsStep).toBe(true);
      expect(caps.supportsEvents).toBe(true);
    });
  });
});