/**
 * Unit tests for Delve Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DlvClient } from "../client.js";
import { APIError } from "../../errors.js";
import type { DebugConfig } from "../../../types/config.js";

// Create mock functions
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockIsConnected = vi.fn().mockReturnValue(false);
const mockCall = vi.fn();
const mockNotify = vi.fn();

// Mock DlvRpcClient
vi.mock("../rpc.js", () => ({
  DlvRpcClient: class MockDlvRpcClient {
    connect = mockConnect;
    close = mockClose;
    isConnected = mockIsConnected;
    call = mockCall;
    notify = mockNotify;
    constructor() {}
  },
}));

// Mock all API modules
vi.mock("../api/debugger.js", () => ({
  getVersion: vi.fn().mockResolvedValue({ APIVersion: "2", DelveVersion: "1.20.0" }),
  getState: vi.fn().mockResolvedValue({
    running: false,
    exited: false,
    currentGoroutine: null,
    currentThread: null,
  }),
  halt: vi.fn().mockResolvedValue({ State: {} }),
  switchGoroutine: vi.fn().mockResolvedValue({ State: {} }),
  continueExecution: vi.fn().mockResolvedValue({ State: {} }),
  step: vi.fn().mockResolvedValue({ State: {} }),
  next: vi.fn().mockResolvedValue({ State: {} }),
  stepOut: vi.fn().mockResolvedValue({ State: {} }),
  stepInstruction: vi.fn().mockResolvedValue({ State: {} }),
  nextInstruction: vi.fn().mockResolvedValue({ State: {} }),
}));

vi.mock("../api/breakpoint.js", () => ({
  createBreakpointAtLocation: vi.fn().mockResolvedValue({
    id: 1,
    name: "",
    addr: 0,
    file: "test.go",
    line: 10,
    functionName: "",
    Cond: "",
    hitCount: 0,
    disabled: false,
    tracepoint: false,
    retrieveGoroutineInfo: false,
    stacktrace: 0,
    goroutine: false,
    variables: [],
    loadArgs: null,
    loadLocals: null,
    userData: null,
  }),
  createBreakpointAtFunction: vi.fn().mockResolvedValue({
    id: 2,
    name: "",
    addr: 0,
    file: "",
    line: 0,
    functionName: "main.main",
    Cond: "",
    hitCount: 0,
    disabled: false,
    tracepoint: false,
    retrieveGoroutineInfo: false,
    stacktrace: 0,
    goroutine: false,
    variables: [],
    loadArgs: null,
    loadLocals: null,
    userData: null,
  }),
  clearBreakpoint: vi.fn().mockResolvedValue(undefined),
  clearAllBreakpoints: vi.fn().mockResolvedValue(undefined),
  listBreakpoints: vi.fn().mockResolvedValue([]),
}));

vi.mock("../api/goroutine.js", () => ({
  getAllGoroutines: vi.fn().mockResolvedValue([
    {
      id: 1,
      currentLoc: { pc: 0, file: "main.go", line: 10, function: { name: "main.main", value: 0, type: 0, goType: 0 } },
      userCurrentLoc: { pc: 0, file: "main.go", line: 10, function: { name: "main.main", value: 0, type: 0, goType: 0 } },
      goStatementLoc: { pc: 0, file: "", line: 0, function: null },
      threadId: 1,
      systemStack: false,
    },
  ]),
  getGoroutine: vi.fn().mockResolvedValue({
    id: 1,
    currentLoc: { pc: 0, file: "main.go", line: 10, function: { name: "main.main", value: 0, type: 0, goType: 0 } },
    userCurrentLoc: { pc: 0, file: "main.go", line: 10, function: { name: "main.main", value: 0, type: 0, goType: 0 } },
    goStatementLoc: { pc: 0, file: "", line: 0, function: null },
    threadId: 1,
    systemStack: false,
  }),
}));

vi.mock("../api/stack.js", () => ({
  stacktraceGoroutine: vi.fn().mockResolvedValue([
    {
      file: "main.go",
      line: 10,
      function: { name: "main.main", value: 0, type: 0, goType: 0 },
      pc: 0,
      goroutineID: 1,
      systemStack: false,
    },
  ]),
  frameUp: vi.fn().mockResolvedValue(null),
  frameDown: vi.fn().mockResolvedValue(null),
  setFrame: vi.fn().mockResolvedValue({}),
  listDeferredCalls: vi.fn().mockResolvedValue([]),
}));

vi.mock("../api/variable.js", () => ({
  createEvalScope: vi.fn().mockReturnValue({ goroutineID: 1, frame: 0, deferredCall: 0 }),
  listLocalVars: vi.fn().mockResolvedValue([]),
  listFunctionArgs: vi.fn().mockResolvedValue([]),
  evalExpr: vi.fn().mockResolvedValue({ name: "", type: "", value: "", kind: 0, children: [] }),
  setVar: vi.fn().mockResolvedValue(undefined),
  parseVariableValue: vi.fn().mockReturnValue(null),
  isPrimitive: vi.fn().mockReturnValue(false),
  isNil: vi.fn().mockReturnValue(false),
}));

vi.mock("../api/info.js", () => ({
  listFunctions: vi.fn().mockResolvedValue([{ name: "main.main", type: 0, value: 0, goType: 0 }]),
  listPackages: vi.fn().mockResolvedValue(["main"]),
  listSources: vi.fn().mockResolvedValue(["main.go"]),
  listTypes: vi.fn().mockResolvedValue([{ name: "int", size: 8, kind: 0 }]),
  listLibraries: vi.fn().mockResolvedValue([]),
  listSource: vi.fn().mockResolvedValue({ file: "main.go", line: 1, content: [], locs: [] }),
}));

vi.mock("../api/checkpoint.js", () => ({
  createCheckpoint: vi.fn().mockResolvedValue({ ID: 1, When: "now", Position: { pc: 0, file: "main.go", line: 10, function: null } }),
  listCheckpoints: vi.fn().mockResolvedValue([]),
  clearCheckpoint: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../api/config.js", () => ({
  getConfig: vi.fn().mockResolvedValue({
    showLocationRegex: false,
    substitutePathRules: [],
    debugInfoDirectories: [],
    maxStringLen: 64,
    maxArrayValues: 64,
    maxVariableRecurse: 1,
    maxStructFields: -1,
  }),
  setConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../api/misc.js", () => ({
  dumpCore: vi.fn().mockResolvedValue(undefined),
  rebuild: vi.fn().mockResolvedValue(undefined),
  getTarget: vi.fn().mockResolvedValue({ pid: 1234, cmd: ["./app"] }),
}));

const createMockConfig = (): DebugConfig => ({
  protocol: "dlv",
  host: "127.0.0.1",
  port: 4040,
  timeout: 30000,
});

describe("DlvClient", () => {
  let client: DlvClient;
  let config: DebugConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockIsConnected.mockReturnValue(false);
    config = createMockConfig();
    client = new DlvClient(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with config", () => {
      expect(client).toBeInstanceOf(DlvClient);
    });
  });

  describe("Lifecycle", () => {
    describe("connect", () => {
      it("should connect successfully", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        expect(client.isConnected()).toBe(true);
      });

      it("should not reconnect if already connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await client.connect();
        expect(mockConnect).toHaveBeenCalledTimes(1);
      });
    });

    describe("close", () => {
      it("should close connection", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await client.close();
        expect(client.isConnected()).toBe(false);
      });

      it("should do nothing if not connected", async () => {
        await client.close();
        expect(client.isConnected()).toBe(false);
      });
    });

    describe("isConnected", () => {
      it("should return false initially", () => {
        expect(client.isConnected()).toBe(false);
      });

      it("should return true after connect", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        expect(client.isConnected()).toBe(true);
      });
    });
  });

  describe("Metadata", () => {
    describe("protocolName", () => {
      it("should return 'dlv'", () => {
        expect(client.protocolName()).toBe("dlv");
      });
    });

    describe("supportedLanguages", () => {
      it("should return ['go']", () => {
        expect(client.supportedLanguages()).toEqual(["go"]);
      });
    });

    describe("version", () => {
      it("should throw if not connected", async () => {
        await expect(client.version()).rejects.toThrow(APIError);
      });

      it("should return version info when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const version = await client.version();
        expect(version).toEqual({
          protocolVersion: "2",
          runtimeVersion: "1.20.0",
          runtimeName: "go",
          description: "Delve Go Debugger",
        });
      });
    });

    describe("capabilities", () => {
      it("should return capabilities", async () => {
        const caps = await client.capabilities();
        expect(caps.supportsVersion).toBe(true);
        expect(caps.supportsThreads).toBe(true);
        expect(caps.supportsBreakpoints).toBe(true);
        expect(caps.supportsWatchMode).toBe(false);
      });
    });
  });

  describe("Thread Management", () => {
    describe("threads", () => {
      it("should throw if not connected", async () => {
        await expect(client.threads()).rejects.toThrow(APIError);
      });

      it("should return threads when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const threads = await client.threads();
        expect(Array.isArray(threads)).toBe(true);
        expect(threads.length).toBeGreaterThan(0);
        expect(threads[0]).toHaveProperty("id");
        expect(threads[0]).toHaveProperty("name");
        expect(threads[0]).toHaveProperty("state");
      });
    });

    describe("stack", () => {
      it("should throw if not connected", async () => {
        await expect(client.stack("1")).rejects.toThrow(APIError);
      });

      it("should return stack frames when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const frames = await client.stack("1");
        expect(Array.isArray(frames)).toBe(true);
      });
    });

    describe("threadState", () => {
      it("should throw if not connected", async () => {
        await expect(client.threadState("1")).rejects.toThrow(APIError);
      });

      it("should return thread state when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const state = await client.threadState("1");
        expect(typeof state).toBe("string");
      });
    });
  });

  describe("Execution Control", () => {
    describe("suspend", () => {
      it("should throw if not connected", async () => {
        await expect(client.suspend()).rejects.toThrow(APIError);
      });

      it("should suspend when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.suspend()).resolves.toBeUndefined();
      });

      it("should suspend specific thread", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.suspend("1")).resolves.toBeUndefined();
      });
    });

    describe("resume", () => {
      it("should throw if not connected", async () => {
        await expect(client.resume()).rejects.toThrow(APIError);
      });

      it("should resume when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.resume()).resolves.toBeUndefined();
      });

      it("should resume specific thread", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.resume("1")).resolves.toBeUndefined();
      });
    });

    describe("stepInto", () => {
      it("should throw if not connected", async () => {
        await expect(client.stepInto("1")).rejects.toThrow(APIError);
      });

      it("should step into when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.stepInto("1")).resolves.toBeUndefined();
      });
    });

    describe("stepOver", () => {
      it("should throw if not connected", async () => {
        await expect(client.stepOver("1")).rejects.toThrow(APIError);
      });

      it("should step over when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.stepOver("1")).resolves.toBeUndefined();
      });
    });

    describe("stepOut", () => {
      it("should throw if not connected", async () => {
        await expect(client.stepOut("1")).rejects.toThrow(APIError);
      });

      it("should step out when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.stepOut("1")).resolves.toBeUndefined();
      });
    });
  });

  describe("Breakpoint Management", () => {
    describe("setBreakpoint", () => {
      it("should throw if not connected", async () => {
        await expect(client.setBreakpoint("main.go:10")).rejects.toThrow(APIError);
      });

      it("should set breakpoint at file:line", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const id = await client.setBreakpoint("main.go:10");
        expect(typeof id).toBe("string");
        expect(id).toMatch(/^dlv_bp_/);
      });

      it("should set breakpoint at function", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const id = await client.setBreakpoint("main.main");
        expect(typeof id).toBe("string");
        expect(id).toMatch(/^dlv_bp_/);
      });

      it("should throw for invalid line number", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.setBreakpoint("main.go:abc")).rejects.toThrow(APIError);
      });
    });

    describe("removeBreakpoint", () => {
      it("should throw if not connected", async () => {
        await expect(client.removeBreakpoint("dlv_bp_1")).rejects.toThrow(APIError);
      });

      it("should remove breakpoint when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const id = await client.setBreakpoint("main.go:10");
        await expect(client.removeBreakpoint(id)).resolves.toBeUndefined();
      });
    });

    describe("clearBreakpoints", () => {
      it("should throw if not connected", async () => {
        await expect(client.clearBreakpoints()).rejects.toThrow(APIError);
      });

      it("should clear all breakpoints when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.clearBreakpoints()).resolves.toBeUndefined();
      });
    });

    describe("breakpoints", () => {
      it("should throw if not connected", async () => {
        await expect(client.breakpoints()).rejects.toThrow(APIError);
      });

      it("should return breakpoints when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const bps = await client.breakpoints();
        expect(Array.isArray(bps)).toBe(true);
      });
    });
  });

  describe("Variable Inspection", () => {
    describe("locals", () => {
      it("should throw if not connected", async () => {
        await expect(client.locals("1", 0)).rejects.toThrow(APIError);
      });

      it("should return local variables when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const vars = await client.locals("1", 0);
        expect(Array.isArray(vars)).toBe(true);
      });
    });

    describe("fields", () => {
      it("should throw if not connected", async () => {
        await expect(client.fields("x")).rejects.toThrow(APIError);
      });

      it("should return fields when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const fields = await client.fields("x");
        expect(Array.isArray(fields)).toBe(true);
      });
    });

    describe("setField", () => {
      it("should throw if not connected", async () => {
        await expect(client.setField("x", "y", 1)).rejects.toThrow(APIError);
      });

      it("should throw if scope not provided", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.setField("x", "y", 1)).rejects.toThrow(APIError);
      });
    });
  });

  describe("Event Handling", () => {
    describe("waitForEvent", () => {
      it("should throw if not connected", async () => {
        await expect(client.waitForEvent(100)).rejects.toThrow(APIError);
      });

      it("should return null on timeout", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const event = await client.waitForEvent(10);
        expect(event).toBeNull();
      });
    });
  });

  describe("Extended Methods", () => {
    describe("args", () => {
      it("should throw if not connected", async () => {
        await expect(client.args("1", 0)).rejects.toThrow(APIError);
      });

      it("should return function args when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const args = await client.args("1", 0);
        expect(Array.isArray(args)).toBe(true);
      });
    });

    describe("frameUp", () => {
      it("should throw if not connected", async () => {
        await expect(client.frameUp()).rejects.toThrow(APIError);
      });

      it("should return null when no frame to move up", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const frame = await client.frameUp();
        expect(frame).toBeNull();
      });
    });

    describe("frameDown", () => {
      it("should throw if not connected", async () => {
        await expect(client.frameDown()).rejects.toThrow(APIError);
      });

      it("should return null when no frame to move down", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const frame = await client.frameDown();
        expect(frame).toBeNull();
      });
    });

    describe("setFrame", () => {
      it("should throw if not connected", async () => {
        await expect(client.setFrame(0)).rejects.toThrow(APIError);
      });

      it("should set frame when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.setFrame(0)).resolves.toBeUndefined();
      });
    });

    describe("deferredCalls", () => {
      it("should throw if not connected", async () => {
        await expect(client.deferredCalls("1", 0)).rejects.toThrow(APIError);
      });

      it("should return deferred calls when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const calls = await client.deferredCalls("1", 0);
        expect(Array.isArray(calls)).toBe(true);
      });
    });

    describe("stepInstruction", () => {
      it("should throw if not connected", async () => {
        await expect(client.stepInstruction("1")).rejects.toThrow(APIError);
      });

      it("should step instruction when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.stepInstruction("1")).resolves.toBeUndefined();
      });
    });

    describe("nextInstruction", () => {
      it("should throw if not connected", async () => {
        await expect(client.nextInstruction("1")).rejects.toThrow(APIError);
      });

      it("should next instruction when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.nextInstruction("1")).resolves.toBeUndefined();
      });
    });
  });

  describe("Info Methods", () => {
    describe("listFunctions", () => {
      it("should throw if not connected", async () => {
        await expect(client.listFunctions()).rejects.toThrow(APIError);
      });

      it("should return functions when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const funcs = await client.listFunctions();
        expect(Array.isArray(funcs)).toBe(true);
      });
    });

    describe("listPackages", () => {
      it("should throw if not connected", async () => {
        await expect(client.listPackages()).rejects.toThrow(APIError);
      });

      it("should return packages when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const pkgs = await client.listPackages();
        expect(Array.isArray(pkgs)).toBe(true);
      });
    });

    describe("listSources", () => {
      it("should throw if not connected", async () => {
        await expect(client.listSources()).rejects.toThrow(APIError);
      });

      it("should return sources when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const sources = await client.listSources();
        expect(Array.isArray(sources)).toBe(true);
      });
    });

    describe("listTypes", () => {
      it("should throw if not connected", async () => {
        await expect(client.listTypes()).rejects.toThrow(APIError);
      });

      it("should return types when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const types = await client.listTypes();
        expect(Array.isArray(types)).toBe(true);
      });
    });

    describe("listLibraries", () => {
      it("should throw if not connected", async () => {
        await expect(client.listLibraries()).rejects.toThrow(APIError);
      });

      it("should return libraries when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const libs = await client.listLibraries();
        expect(Array.isArray(libs)).toBe(true);
      });
    });

    describe("showSource", () => {
      it("should throw if not connected", async () => {
        await expect(client.showSource()).rejects.toThrow(APIError);
      });

      it("should return source when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const source = await client.showSource();
        expect(source).toHaveProperty("file");
        expect(source).toHaveProperty("line");
        expect(source).toHaveProperty("content");
      });
    });
  });

  describe("Checkpoint Methods", () => {
    describe("createCheckpoint", () => {
      it("should throw if not connected", async () => {
        await expect(client.createCheckpoint()).rejects.toThrow(APIError);
      });

      it("should create checkpoint when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const cp = await client.createCheckpoint();
        expect(cp).toHaveProperty("ID");
      });
    });

    describe("listCheckpoints", () => {
      it("should throw if not connected", async () => {
        await expect(client.listCheckpoints()).rejects.toThrow(APIError);
      });

      it("should return checkpoints when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const cps = await client.listCheckpoints();
        expect(Array.isArray(cps)).toBe(true);
      });
    });

    describe("clearCheckpoint", () => {
      it("should throw if not connected", async () => {
        await expect(client.clearCheckpoint(1)).rejects.toThrow(APIError);
      });

      it("should clear checkpoint when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.clearCheckpoint(1)).resolves.toBeUndefined();
      });
    });
  });

  describe("Config Methods", () => {
    describe("getConfig", () => {
      it("should throw if not connected", async () => {
        await expect(client.getConfig()).rejects.toThrow(APIError);
      });

      it("should return config when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const cfg = await client.getConfig();
        expect(cfg).toHaveProperty("maxStringLen");
      });
    });

    describe("setConfig", () => {
      it("should throw if not connected", async () => {
        await expect(client.setConfig({ maxStringLen: 128 })).rejects.toThrow(APIError);
      });

      it("should set config when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.setConfig({ maxStringLen: 128 })).resolves.toBeUndefined();
      });
    });
  });

  describe("Debug Operations", () => {
    describe("dumpCore", () => {
      it("should throw if not connected", async () => {
        await expect(client.dumpCore("/tmp/core")).rejects.toThrow(APIError);
      });

      it("should dump core when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.dumpCore("/tmp/core")).resolves.toBeUndefined();
      });
    });

    describe("rebuild", () => {
      it("should throw if not connected", async () => {
        await expect(client.rebuild()).rejects.toThrow(APIError);
      });

      it("should rebuild when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        await expect(client.rebuild()).resolves.toBeUndefined();
      });
    });

    describe("getTarget", () => {
      it("should throw if not connected", async () => {
        await expect(client.getTarget()).rejects.toThrow(APIError);
      });

      it("should return target when connected", async () => {
        await client.connect();
        mockIsConnected.mockReturnValue(true);
        const target = await client.getTarget();
        expect(target).toHaveProperty("pid");
        expect(target).toHaveProperty("cmd");
      });
    });
  });
});
