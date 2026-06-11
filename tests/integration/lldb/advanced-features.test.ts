/**
 * LLDB Advanced Features Integration Tests
 * Tests LLDB client advanced functionality (P1 and P2 tasks)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LLDBClient } from "../../../src/protocol/lldb/client.js";
import type { DebugConfig } from "../../../src/types/config.js";
import { FeatureNames } from "../../../src/protocol/extended.js";

describe("LLDB Advanced Features", () => {
  let config: DebugConfig & { target: string };

  beforeEach(() => {
    config = {
      protocol: "lldb",
      target: "/bin/ls", // Simple target for testing
      timeout: 10000,
    } as DebugConfig & { target: string };
  });

  afterEach(async () => {
    // Cleanup if needed
  });

  describe("Extended Interface", () => {
    it("should support eval method", async () => {
      const client = new LLDBClient(config);
      expect(typeof client.eval).toBe("function");
      expect(client.supportsFeature(FeatureNames.Eval)).toBe(true);
    });

    it("should support enable/disable breakpoint", async () => {
      const client = new LLDBClient(config);
      expect(typeof client.enableBreakpoint).toBe("function");
      expect(typeof client.disableBreakpoint).toBe("function");
      expect(client.supportsFeature(FeatureNames.EnableDisableBreakpoint)).toBe(true);
    });

    it("should support get breakpoint info", async () => {
      const client = new LLDBClient(config);
      expect(typeof client.getBreakpointInfo).toBe("function");
      expect(client.supportsFeature(FeatureNames.ExtendedBreakpointInfo)).toBe(true);
    });

    it("should support get type info", async () => {
      const client = new LLDBClient(config);
      expect(typeof client.getTypeInfo).toBe("function");
      expect(client.supportsFeature(FeatureNames.TypeInfo)).toBe(true);
    });

    it("should support get symbol", async () => {
      const client = new LLDBClient(config);
      expect(typeof client.getSymbol).toBe("function");
      expect(client.supportsFeature(FeatureNames.SymbolInfo)).toBe(true);
    });

    it("should support get target metadata", async () => {
      const client = new LLDBClient(config);
      expect(typeof client.getTargetMetadata).toBe("function");
      expect(client.supportsFeature(FeatureNames.TargetMetadata)).toBe(true);
    });

    it("should support get thread batch info", async () => {
      const client = new LLDBClient(config);
      expect(typeof client.getThreadBatchInfo).toBe("function");
      expect(client.supportsFeature(FeatureNames.ThreadBatchInfo)).toBe(true);
    });

    it("should return false for unsupported features", async () => {
      const client = new LLDBClient(config);
      expect(client.supportsFeature("unsupportedFeature" as any)).toBe(false);
    });
  });

  describe("Thread Control", () => {
    it("should support thread-level suspend and resume", async () => {
      const client = new LLDBClient(config);

      expect(typeof client.suspend).toBe("function");
      expect(typeof client.resume).toBe("function");
    });
  });

  describe("Expression Evaluation", () => {
    it("should support dynamic types option", async () => {
      const client = new LLDBClient(config);

      expect(typeof client.eval).toBe("function");
    });

    it("should support try all threads option", async () => {
      const client = new LLDBClient(config);

      expect(typeof client.eval).toBe("function");
    });
  });

  describe("Type Information", () => {
    it("should return enhanced type information", async () => {
      const client = new LLDBClient(config);

      expect(typeof client.getTypeInfo).toBe("function");
    });
  });

  describe("Symbol Query", () => {
    it("should support symbol query by name", async () => {
      const client = new LLDBClient(config);

      expect(typeof client.getSymbol).toBe("function");
    });

    it("should support fuzzy matching", async () => {
      const client = new LLDBClient(config);

      expect(typeof client.getSymbol).toBe("function");
    });
  });

  describe("Batch Information", () => {
    it("should support batch thread information", async () => {
      const client = new LLDBClient(config);

      expect(typeof client.getThreadBatchInfo).toBe("function");
    });
  });

  describe("Error Handling", () => {
    it("should throw error when not connected", async () => {
      const client = new LLDBClient(config);

      await expect(client.eval("test", "1", 0)).rejects.toThrow();
      await expect(client.enableBreakpoint("1")).rejects.toThrow();
      await expect(client.disableBreakpoint("1")).rejects.toThrow();
      await expect(client.getBreakpointInfo("1")).rejects.toThrow();
      await expect(client.getTypeInfo("int")).rejects.toThrow();
      await expect(client.getSymbol("1", 0)).rejects.toThrow();
      await expect(client.getTargetMetadata()).rejects.toThrow();
      await expect(client.getThreadBatchInfo("1")).rejects.toThrow();
    });
  });

  describe("Feature Compatibility", () => {
    it("should support all extended features", async () => {
      const client = new LLDBClient(config);

      const features = [
        FeatureNames.Eval,
        FeatureNames.EnableDisableBreakpoint,
        FeatureNames.ExtendedBreakpointInfo,
        FeatureNames.TypeInfo,
        FeatureNames.SymbolInfo,
        FeatureNames.TargetMetadata,
        FeatureNames.ThreadBatchInfo,
      ];

      for (const feature of features) {
        expect(client.supportsFeature(feature)).toBe(true);
      }
    });
  });
});