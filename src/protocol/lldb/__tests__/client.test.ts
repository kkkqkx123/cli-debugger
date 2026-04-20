/**
 * Tests for LLDB Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLDBClient } from "../client.js";
import type { DebugConfig } from "../../../types/config.js";

// Create mock functions
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockIsRunning = vi.fn().mockReturnValue(true);
const mockCall = vi.fn();

// Mock LLDBBridge
vi.mock("../bridge.js", () => ({
  LLDBBridge: class MockLLDBBridge {
    start = mockStart;
    stop = mockStop;
    isRunning = mockIsRunning;
    call = mockCall;
    constructor() {}
  },
}));

describe("LLDBClient", () => {
  let client: LLDBClient;
  const config = {
    protocol: "lldb",
    target: "/path/to/binary",
    timeout: 30000,
  } as unknown as DebugConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockCall.mockImplementation((method: string) => {
      switch (method) {
        case "connect":
          return Promise.resolve({ success: true, targetId: "test" });
        case "launch":
          return Promise.resolve({ success: true, pid: 1234 });
        case "version":
          return Promise.resolve({
            lldbVersion: "LLDB 14.0.0",
            pythonVersion: "3.10.0",
          });
        case "threads":
          return Promise.resolve([
            {
              id: 1,
              name: "main",
              state: "stopped",
              stopReason: "breakpoint",
              numFrames: 5,
            },
          ]);
        case "stack":
          return Promise.resolve([
            {
              id: 0,
              location: "main.cpp:10",
              file: "/src/main.cpp",
              line: 10,
              column: 0,
              method: "main",
              module: "a.out",
              address: 0x400000,
              isInlined: false,
            },
          ]);
        case "locals":
          return Promise.resolve([
            {
              name: "x",
              type: "int",
              value: "42",
              kind: "local",
              isPointer: false,
              isArray: false,
              isStruct: false,
              numChildren: 0,
              isNil: false,
            },
          ]);
        case "setBreakpoint":
          return Promise.resolve({
            id: "lldb_bp_1",
            internalId: 1,
            location: "main.cpp:10",
            enabled: true,
            hitCount: 0,
            ignoreCount: 0,
            condition: null,
          });
        case "breakpoints":
          return Promise.resolve([]);
        case "suspend":
        case "resume":
        case "stepInto":
        case "stepOver":
        case "stepOut":
        case "clearBreakpoints":
        case "removeBreakpoint":
          return Promise.resolve({ success: true });
        default:
          return Promise.resolve({});
      }
    });

    client = new LLDBClient(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw error for non-lldb protocol", () => {
      expect(
        () =>
          new LLDBClient({
            protocol: "jdwp",
            host: "localhost",
            port: 5005,
            timeout: 30000,
          }),
      ).toThrow("Expected protocol 'lldb'");
    });

    it("should throw error if target is missing", () => {
      expect(
        () =>
          new LLDBClient({
            protocol: "lldb",
            host: "localhost",
            port: 5005,
            timeout: 30000,
          } as unknown as DebugConfig),
      ).toThrow("LLDB requires 'target' configuration");
    });
  });

  describe("connect", () => {
    it("should connect to target", async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should not connect twice", async () => {
      await client.connect();
      await client.connect();
      // Should only call bridge.start once
      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  describe("close", () => {
    it("should close connection", async () => {
      await client.connect();
      await client.close();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("protocolName", () => {
    it("should return 'lldb'", () => {
      expect(client.protocolName()).toBe("lldb");
    });
  });

  describe("supportedLanguages", () => {
    it("should return supported languages", () => {
      expect(client.supportedLanguages()).toEqual([
        "c",
        "cpp",
        "objc",
        "swift",
        "rust",
      ]);
    });
  });

  describe("version", () => {
    it("should return version info", async () => {
      await client.connect();
      const version = await client.version();

      expect(version).toEqual({
        protocolVersion: "1.0",
        runtimeVersion: "LLDB 14.0.0",
        runtimeName: "lldb",
        description: expect.stringContaining("LLDB 14.0.0"),
      });
    });
  });

  describe("capabilities", () => {
    it("should return capabilities", async () => {
      const caps = await client.capabilities();

      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsStack).toBe(true);
      expect(caps.supportsBreakpoints).toBe(true);
    });
  });

  describe("threads", () => {
    it("should return threads", async () => {
      await client.connect();
      const threads = await client.threads();

      expect(threads).toHaveLength(1);
      expect(threads[0]).toEqual({
        id: "1",
        name: "main",
        state: "stopped",
        status: "breakpoint",
        isSuspended: true,
        isDaemon: false,
        priority: 0,
        createdAt: expect.any(Date),
      });
    });
  });

  describe("stack", () => {
    it("should return stack frames", async () => {
      await client.connect();
      const frames = await client.stack("1");

      expect(frames).toHaveLength(1);
      expect(frames[0]).toEqual({
        id: "0",
        location: "main.cpp:10",
        method: "main",
        line: 10,
        isNative: true,
      });
    });
  });

  describe("locals", () => {
    it("should return local variables", async () => {
      await client.connect();
      const vars = await client.locals("1", 0);

      expect(vars).toHaveLength(1);
      expect(vars[0]).toEqual({
        name: "x",
        type: "int",
        value: "42",
        isPrimitive: true,
        isNull: false,
      });
    });
  });

  describe("setBreakpoint", () => {
    it("should set breakpoint", async () => {
      await client.connect();
      const bpId = await client.setBreakpoint("main.cpp:10");

      expect(bpId).toBe("lldb_bp_1");
    });
  });

  describe("execution control", () => {
    it("should suspend", async () => {
      await client.connect();
      await expect(client.suspend()).resolves.not.toThrow();
    });

    it("should resume", async () => {
      await client.connect();
      await expect(client.resume()).resolves.not.toThrow();
    });

    it("should stepInto", async () => {
      await client.connect();
      await expect(client.stepInto("1")).resolves.not.toThrow();
    });

    it("should stepOver", async () => {
      await client.connect();
      await expect(client.stepOver("1")).resolves.not.toThrow();
    });

    it("should stepOut", async () => {
      await client.connect();
      await expect(client.stepOut("1")).resolves.not.toThrow();
    });
  });

  // ==================== New Feature Tests ====================

  describe("setBreakpointAtAddress", () => {
    it("should set breakpoint at address", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        id: "lldb_bp_2",
        internalId: 2,
        location: "0x400000",
        enabled: true,
        hitCount: 0,
      });

      const bpId = await client.setBreakpointAtAddress(0x400000);

      expect(bpId).toBe("lldb_bp_2");
      expect(mockCall).toHaveBeenCalledWith("setBreakpoint", {
        address: 0x400000,
        condition: undefined,
      });
    });

    it("should set breakpoint at address with condition", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        id: "lldb_bp_3",
        internalId: 3,
        location: "0x400000",
        enabled: true,
        hitCount: 0,
      });

      const bpId = await client.setBreakpointAtAddress(0x400000, "x > 10");

      expect(bpId).toBe("lldb_bp_3");
      expect(mockCall).toHaveBeenCalledWith("setBreakpoint", {
        address: 0x400000,
        condition: "x > 10",
      });
    });
  });

  describe("setBreakpointByRegex", () => {
    it("should set breakpoint by source regex", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        id: "lldb_bp_4",
        internalId: 4,
        location: "TODO",
        enabled: true,
        hitCount: 0,
      });

      const bpId = await client.setBreakpointByRegex("TODO", "main.cpp");

      expect(bpId).toBe("lldb_bp_4");
      expect(mockCall).toHaveBeenCalledWith("setBreakpoint", {
        sourceRegex: "TODO",
        sourceFile: "main.cpp",
        condition: undefined,
      });
    });
  });

  describe("enableBreakpoint", () => {
    it("should enable breakpoint", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({ success: true, id: "lldb_bp_1", enabled: true });

      await client.enableBreakpoint("lldb_bp_1");

      expect(mockCall).toHaveBeenCalledWith("enableBreakpoint", {
        id: "lldb_bp_1",
      });
    });
  });

  describe("disableBreakpoint", () => {
    it("should disable breakpoint", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({ success: true, id: "lldb_bp_1", enabled: false });

      await client.disableBreakpoint("lldb_bp_1");

      expect(mockCall).toHaveBeenCalledWith("disableBreakpoint", {
        id: "lldb_bp_1",
      });
    });
  });

  describe("registers", () => {
    it("should return register sets", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce([
        {
          name: "General Purpose Registers",
          registers: [
            { name: "rax", value: "0x0000000000000001", type: "uint64_t", size: 8 },
            { name: "rbx", value: "0x0000000000000002", type: "uint64_t", size: 8 },
          ],
        },
      ]);

      const regSets = await client.registers("1", 0);

      expect(regSets).toHaveLength(1);
      expect(regSets[0]!.name).toBe("General Purpose Registers");
      expect(regSets[0]!.registers).toHaveLength(2);
    });
  });

  describe("getSelectedThread", () => {
    it("should return selected thread", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        id: 1,
        name: "main",
        state: "stopped",
        stopReason: "breakpoint",
        numFrames: 5,
      });

      const thread = await client.getSelectedThread();

      expect(thread.id).toBe("1");
      expect(thread.name).toBe("main");
    });
  });

  describe("setSelectedThread", () => {
    it("should set selected thread", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({ success: true, threadId: 2 });

      await client.setSelectedThread("2");

      expect(mockCall).toHaveBeenCalledWith("setSelectedThread", { threadId: 2 });
    });
  });

  describe("getSelectedFrame", () => {
    it("should return selected frame", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        id: 0,
        location: "main.cpp:10",
        file: "/src/main.cpp",
        line: 10,
        column: 0,
        method: "main",
        module: "a.out",
        address: 0x400000,
        isInlined: false,
      });

      const frame = await client.getSelectedFrame("1");

      expect(frame.id).toBe("0");
      expect(frame.method).toBe("main");
    });
  });

  describe("setSelectedFrame", () => {
    it("should set selected frame", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({ success: true, threadId: 1, frameIndex: 2 });

      await client.setSelectedFrame("1", 2);

      expect(mockCall).toHaveBeenCalledWith("setSelectedFrame", {
        threadId: 1,
        frameIndex: 2,
      });
    });
  });

  describe("getExitInfo", () => {
    it("should return exit info for running process", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        status: null,
        description: null,
        state: "stopped",
      });

      const exitInfo = await client.getExitInfo();

      expect(exitInfo.status).toBeNull();
      expect(exitInfo.state).toBe("stopped");
    });

    it("should return exit info for exited process", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        status: 0,
        description: "exit(0)",
        state: "exited",
      });

      const exitInfo = await client.getExitInfo();

      expect(exitInfo.status).toBe(0);
      expect(exitInfo.description).toBe("exit(0)");
    });
  });

  describe("getStopDescription", () => {
    it("should return stop description", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        threadId: 1,
        description: "breakpoint 1.1",
        stopReason: "breakpoint",
      });

      const desc = await client.getStopDescription("1");

      expect(desc).toBe("breakpoint 1.1");
    });
  });

  describe("getVariableByPath", () => {
    it("should return variable by path", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        name: "field",
        type: "int",
        value: "42",
        kind: "field",
        isPointer: false,
        isArray: false,
        isStruct: false,
        numChildren: 0,
        isNil: false,
      });

      const var_ = await client.getVariableByPath("1", 0, "obj->field");

      expect(var_.name).toBe("field");
      expect(var_.value).toBe("42");
    });
  });

  describe("getTargetInfo", () => {
    it("should return target info", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        executable: "/path/to/binary",
        triple: "x86_64-apple-macosx",
        numModules: 10,
        numBreakpoints: 2,
        byteOrder: "little",
      });

      const targetInfo = await client.getTargetInfo();

      expect(targetInfo.executable).toBe("/path/to/binary");
      expect(targetInfo.triple).toBe("x86_64-apple-macosx");
      expect(targetInfo.numModules).toBe(10);
    });
  });

  describe("eval with options", () => {
    it("should evaluate expression with timeout", async () => {
      await client.connect();

      mockCall.mockResolvedValueOnce({
        name: "<result>",
        type: "int",
        value: "42",
        kind: "result",
        isPointer: false,
        isArray: false,
        isStruct: false,
        numChildren: 0,
        isNil: false,
      });

      const result = await client.eval("x + 1", "1", 0, { timeout: 5000 });

      expect(result.value).toBe("42");
      expect(mockCall).toHaveBeenCalledWith("eval", {
        expression: "x + 1",
        threadId: 1,
        frameIndex: 0,
        timeout: 5000,
        unwindOnError: undefined,
        ignoreBreakpoints: undefined,
      });
    });
  });
});
