/**
 * Tests for LLDB Types
 */

import { describe, it, expect } from "vitest";
import { LLDBConfigSchema, BridgeErrorCodes } from "../types.js";

describe("LLDB Types", () => {
  describe("LLDBConfigSchema", () => {
    it("should validate valid config", () => {
      const config = {
        protocol: "lldb",
        target: "/path/to/binary",
      };

      const result = LLDBConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should apply default values", () => {
      const config = {
        protocol: "lldb",
        target: "/path/to/binary",
      };

      const result = LLDBConfigSchema.parse(config);
      expect(result.waitFor).toBe(false);
      expect(result.stopAtEntry).toBe(false);
      expect(result.timeout).toBe(30000);
    });

    it("should validate optional fields", () => {
      const config = {
        protocol: "lldb",
        target: "/path/to/binary",
        coreFile: "/path/to/core",
        pythonPath: "/usr/bin/python3",
        attachPid: 12345,
        launchArgs: ["--arg1", "--arg2"],
        env: { FOO: "bar" },
        workingDir: "/work",
      };

      const result = LLDBConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid protocol", () => {
      const config = {
        protocol: "jdwp",
        target: "/path/to/binary",
      };

      const result = LLDBConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject missing target", () => {
      const config = {
        protocol: "lldb",
      };

      const result = LLDBConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe("BridgeErrorCodes", () => {
    it("should have all expected error codes", () => {
      expect(BridgeErrorCodes.PARSE_ERROR).toBe("PARSE_ERROR");
      expect(BridgeErrorCodes.UNKNOWN_METHOD).toBe("UNKNOWN_METHOD");
      expect(BridgeErrorCodes.INVALID_INPUT).toBe("INVALID_INPUT");
      expect(BridgeErrorCodes.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
      expect(BridgeErrorCodes.NO_TARGET).toBe("NO_TARGET");
      expect(BridgeErrorCodes.NO_PROCESS).toBe("NO_PROCESS");
      expect(BridgeErrorCodes.TARGET_NOT_FOUND).toBe("TARGET_NOT_FOUND");
      expect(BridgeErrorCodes.CREATE_TARGET_FAILED).toBe("CREATE_TARGET_FAILED");
      expect(BridgeErrorCodes.LOAD_CORE_FAILED).toBe("LOAD_CORE_FAILED");
      expect(BridgeErrorCodes.ATTACH_FAILED).toBe("ATTACH_FAILED");
      expect(BridgeErrorCodes.LAUNCH_FAILED).toBe("LAUNCH_FAILED");
      expect(BridgeErrorCodes.THREAD_NOT_FOUND).toBe("THREAD_NOT_FOUND");
      expect(BridgeErrorCodes.FRAME_NOT_FOUND).toBe("FRAME_NOT_FOUND");
      expect(BridgeErrorCodes.BREAKPOINT_NOT_FOUND).toBe("BREAKPOINT_NOT_FOUND");
      expect(BridgeErrorCodes.BREAKPOINT_FAILED).toBe("BREAKPOINT_FAILED");
      expect(BridgeErrorCodes.VARIABLE_NOT_FOUND).toBe("VARIABLE_NOT_FOUND");
      expect(BridgeErrorCodes.EVAL_FAILED).toBe("EVAL_FAILED");
    });
  });
});
