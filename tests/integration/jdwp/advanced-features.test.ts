/**
 * JDWP Advanced Features Integration Tests
 * Tests JDWP client advanced functionality (P2 tasks)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JDWPClient } from "../../../src/protocol/jdwp/client.js";
import type { DebugConfig } from "../../../src/types/config.js";
import { FeatureNames } from "../../../src/protocol/extended.js";

describe("JDWP Advanced Features", () => {
  let config: DebugConfig;

  beforeEach(() => {
    config = {
      protocol: "jdwp",
      host: "localhost",
      port: 8000,
      timeout: 10000,
    };
  });

  afterEach(async () => {
    // Cleanup if needed
  });

  describe("Extended Interface", () => {
    it("should not support eval method", async () => {
      const client = new JDWPClient(config);
      expect(typeof client.eval).toBe("function");
      expect(client.supportsFeature(FeatureNames.Eval)).toBe(false);
    });

    it("should not support enable/disable breakpoint", async () => {
      const client = new JDWPClient(config);
      expect(typeof client.enableBreakpoint).toBe("function");
      expect(typeof client.disableBreakpoint).toBe("function");
      expect(client.supportsFeature(FeatureNames.EnableDisableBreakpoint)).toBe(false);
    });

    it("should support get breakpoint info", async () => {
      const client = new JDWPClient(config);
      expect(typeof client.getBreakpointInfo).toBe("function");
      expect(client.supportsFeature(FeatureNames.ExtendedBreakpointInfo)).toBe(true);
    });

    it("should not support get type info", async () => {
      const client = new JDWPClient(config);
      expect(typeof client.getTypeInfo).toBe("function");
      expect(client.supportsFeature(FeatureNames.TypeInfo)).toBe(false);
    });

    it("should not support get symbol", async () => {
      const client = new JDWPClient(config);
      expect(typeof client.getSymbol).toBe("function");
      expect(client.supportsFeature(FeatureNames.SymbolInfo)).toBe(false);
    });

    it("should support get target metadata", async () => {
      const client = new JDWPClient(config);
      expect(typeof client.getTargetMetadata).toBe("function");
      expect(client.supportsFeature(FeatureNames.TargetMetadata)).toBe(true);
    });

    it("should not support get thread batch info", async () => {
      const client = new JDWPClient(config);
      expect(typeof client.getThreadBatchInfo).toBe("function");
      expect(client.supportsFeature(FeatureNames.ThreadBatchInfo)).toBe(false);
    });

    it("should return false for unsupported features", async () => {
      const client = new JDWPClient(config);
      expect(client.supportsFeature("unsupportedFeature" as any)).toBe(false);
    });
  });

  describe("Expression Evaluation", () => {
    it("should throw unsupported operation error for eval", async () => {
      const client = new JDWPClient(config);

      expect(typeof client.eval).toBe("function");
      await expect(client.eval("test", "1", 0)).rejects.toThrow();
    });
  });

  describe("Breakpoint Control", () => {
    it("should not support enable breakpoint", async () => {
      const client = new JDWPClient(config);

      expect(typeof client.enableBreakpoint).toBe("function");
      await expect(client.enableBreakpoint("1")).rejects.toThrow();
    });

    it("should not support disable breakpoint", async () => {
      const client = new JDWPClient(config);

      expect(typeof client.disableBreakpoint).toBe("function");
      await expect(client.disableBreakpoint("1")).rejects.toThrow();
    });

    it("should support get breakpoint info", async () => {
      const client = new JDWPClient(config);

      expect(typeof client.getBreakpointInfo).toBe("function");
    });
  });

  describe("Target Metadata", () => {
    it("should support get target metadata", async () => {
      const client = new JDWPClient(config);

      expect(typeof client.getTargetMetadata).toBe("function");
    });
  });

  describe("Error Handling", () => {
    it("should throw error when not connected", async () => {
      const client = new JDWPClient(config);

      await expect(client.eval("test", "1", 0)).rejects.toThrow();
      await expect(client.enableBreakpoint("1")).rejects.toThrow();
      await expect(client.disableBreakpoint("1")).rejects.toThrow();
      await expect(client.getTargetMetadata()).rejects.toThrow();
    });

    it("should throw unsupported operation error for type info", async () => {
      const client = new JDWPClient(config);

      await expect(client.getTypeInfo("java.lang.String")).rejects.toThrow();
    });

    it("should throw unsupported operation error for symbol", async () => {
      const client = new JDWPClient(config);

      await expect(client.getSymbol("1", 0)).rejects.toThrow();
    });

    it("should throw unsupported operation error for batch info", async () => {
      const client = new JDWPClient(config);

      await expect(client.getThreadBatchInfo("1")).rejects.toThrow();
    });
  });

  describe("Feature Compatibility", () => {
    it("should support only compatible features", async () => {
      const client = new JDWPClient(config);

      expect(client.supportsFeature(FeatureNames.Eval)).toBe(false);
      expect(client.supportsFeature(FeatureNames.EnableDisableBreakpoint)).toBe(false);
      expect(client.supportsFeature(FeatureNames.ExtendedBreakpointInfo)).toBe(true);
      expect(client.supportsFeature(FeatureNames.TypeInfo)).toBe(false);
      expect(client.supportsFeature(FeatureNames.SymbolInfo)).toBe(false);
      expect(client.supportsFeature(FeatureNames.TargetMetadata)).toBe(true);
      expect(client.supportsFeature(FeatureNames.ThreadBatchInfo)).toBe(false);
    });
  });
});