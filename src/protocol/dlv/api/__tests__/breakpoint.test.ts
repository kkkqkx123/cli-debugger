/**
 * Unit tests for Delve breakpoint API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as breakpointApi from "../breakpoint.js";
import type { DlvRpcClient } from "../../rpc.js";
import type { DlvBreakpoint } from "../../types.js";

const createMockRpc = (): { rpc: DlvRpcClient; call: ReturnType<typeof vi.fn> } => {
  const call = vi.fn();
  const rpc = {
    call,
    isConnected: vi.fn().mockReturnValue(true),
    notify: vi.fn(),
    close: vi.fn(),
    connect: vi.fn(),
  } as unknown as DlvRpcClient;
  return { rpc, call };
};

const createMockBreakpoint = (overrides: Partial<DlvBreakpoint> = {}): DlvBreakpoint => ({
  id: 1,
  name: "",
  addr: 0,
  file: "main.go",
  line: 10,
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
  ...overrides,
});

describe("breakpoint API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("listBreakpoints", () => {
    it("should call RPCServer.ListBreakpoints", async () => {
      const bps = [createMockBreakpoint()];
      mockRpc.call.mockResolvedValue(bps);

      const result = await breakpointApi.listBreakpoints(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListBreakpoints", []);
      expect(result).toEqual(bps);
    });
  });

  describe("createBreakpoint", () => {
    it("should call RPCServer.CreateBreakpoint with params", async () => {
      const bp = createMockBreakpoint();
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createBreakpoint(mockRpc.rpc, {
        file: "main.go",
        line: 10,
      });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateBreakpoint", [
        { file: "main.go", line: 10 },
      ]);
      expect(result).toEqual(bp);
    });
  });

  describe("createBreakpointAtLocation", () => {
    it("should create breakpoint at file:line", async () => {
      const bp = createMockBreakpoint();
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createBreakpointAtLocation(
        mockRpc.rpc,
        "main.go",
        10
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateBreakpoint", [
        { file: "main.go", line: 10, Cond: "" },
      ]);
      expect(result).toEqual(bp);
    });

    it("should create breakpoint with condition", async () => {
      const bp = createMockBreakpoint();
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createBreakpointAtLocation(
        mockRpc.rpc,
        "main.go",
        10,
        "x > 0"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateBreakpoint", [
        { file: "main.go", line: 10, Cond: "x > 0" },
      ]);
      expect(result).toEqual(bp);
    });
  });

  describe("createBreakpointAtFunction", () => {
    it("should create breakpoint at function", async () => {
      const bp = createMockBreakpoint({ functionName: "main.main" });
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createBreakpointAtFunction(
        mockRpc.rpc,
        "main.main"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateBreakpoint", [
        { functionName: "main.main", Cond: "" },
      ]);
      expect(result).toEqual(bp);
    });

    it("should create breakpoint at function with condition", async () => {
      const bp = createMockBreakpoint({ functionName: "main.main" });
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createBreakpointAtFunction(
        mockRpc.rpc,
        "main.main",
        "x == 1"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateBreakpoint", [
        { functionName: "main.main", Cond: "x == 1" },
      ]);
      expect(result).toEqual(bp);
    });
  });

  describe("createBreakpointAtAddress", () => {
    it("should create breakpoint at address", async () => {
      const bp = createMockBreakpoint({ addr: 0x1000 });
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createBreakpointAtAddress(
        mockRpc.rpc,
        0x1000
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateBreakpoint", [
        { addr: 0x1000, Cond: "" },
      ]);
      expect(result).toEqual(bp);
    });
  });

  describe("createTracepoint", () => {
    it("should create tracepoint", async () => {
      const bp = createMockBreakpoint({ tracepoint: true });
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createTracepoint(
        mockRpc.rpc,
        "main.go",
        10
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateBreakpoint", [
        { file: "main.go", line: 10, tracepoint: true },
      ]);
      expect(result).toEqual(bp);
    });
  });

  describe("clearBreakpoint", () => {
    it("should clear breakpoint by id", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await breakpointApi.clearBreakpoint(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ClearBreakpoint", [
        { id: 1 },
      ]);
    });
  });

  describe("clearBreakpointByName", () => {
    it("should clear breakpoint by name", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await breakpointApi.clearBreakpointByName(mockRpc.rpc, "bp1");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ClearBreakpoint", [
        { name: "bp1" },
      ]);
    });
  });

  describe("amendBreakpoint", () => {
    it("should amend breakpoint", async () => {
      const bp = createMockBreakpoint({ disabled: true });
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.amendBreakpoint(mockRpc.rpc, bp);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.AmendBreakpoint", [bp]);
      expect(result).toEqual(bp);
    });
  });

  describe("toggleBreakpoint", () => {
    it("should toggle breakpoint disabled state", async () => {
      const bp = createMockBreakpoint({ id: 1, disabled: false });
      const updatedBp = createMockBreakpoint({ id: 1, disabled: true });
      mockRpc.call
        .mockResolvedValueOnce([bp]) // listBreakpoints
        .mockResolvedValueOnce(updatedBp); // amendBreakpoint

      const result = await breakpointApi.toggleBreakpoint(mockRpc.rpc, 1, true);

      expect(result.disabled).toBe(true);
    });

    it("should throw if breakpoint not found", async () => {
      mockRpc.call.mockResolvedValueOnce([]);

      await expect(
        breakpointApi.toggleBreakpoint(mockRpc.rpc, 999, true)
      ).rejects.toThrow("Breakpoint 999 not found");
    });
  });

  describe("setBreakpointCondition", () => {
    it("should set breakpoint condition", async () => {
      const bp = createMockBreakpoint({ id: 1 });
      const updatedBp = createMockBreakpoint({ id: 1, Cond: "x > 0" });
      mockRpc.call
        .mockResolvedValueOnce([bp]) // listBreakpoints
        .mockResolvedValueOnce(updatedBp); // amendBreakpoint

      const result = await breakpointApi.setBreakpointCondition(
        mockRpc.rpc,
        1,
        "x > 0"
      );

      expect(result.Cond).toBe("x > 0");
    });

    it("should throw if breakpoint not found", async () => {
      mockRpc.call.mockResolvedValueOnce([]);

      await expect(
        breakpointApi.setBreakpointCondition(mockRpc.rpc, 999, "x > 0")
      ).rejects.toThrow("Breakpoint 999 not found");
    });
  });

  describe("setBreakpointHitCondition", () => {
    it("should set hit condition as condition", async () => {
      const bp = createMockBreakpoint({ id: 1 });
      const updatedBp = createMockBreakpoint({ id: 1, Cond: "hit > 5" });
      mockRpc.call
        .mockResolvedValueOnce([bp]) // listBreakpoints
        .mockResolvedValueOnce(updatedBp); // amendBreakpoint

      const result = await breakpointApi.setBreakpointHitCondition(
        mockRpc.rpc,
        1,
        "hit > 5"
      );

      expect(result.Cond).toBe("hit > 5");
    });
  });

  describe("getBreakpointInfo", () => {
    it("should get breakpoint info", async () => {
      const bpInfo = {
        Breakpoint: createMockBreakpoint(),
        Goroutine: null,
        Stacktrace: null,
        Variables: null,
        Arguments: null,
      };
      mockRpc.call.mockResolvedValue(bpInfo);

      const result = await breakpointApi.getBreakpointInfo(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.GetBreakpoint", [
        { id: 1 },
      ]);
      expect(result).toEqual(bpInfo);
    });
  });

  describe("clearAllBreakpoints", () => {
    it("should clear all non-internal breakpoints", async () => {
      const bps = [
        createMockBreakpoint({ id: 1 }),
        createMockBreakpoint({ id: 2 }),
        createMockBreakpoint({ id: -1 }), // internal breakpoint
      ];
      mockRpc.call
        .mockResolvedValueOnce(bps) // listBreakpoints
        .mockResolvedValue(undefined) // clearBreakpoint 1
        .mockResolvedValue(undefined); // clearBreakpoint 2

      await breakpointApi.clearAllBreakpoints(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledTimes(3);
    });
  });

  describe("createWatchpoint", () => {
    it("should create watchpoint", async () => {
      const bp = createMockBreakpoint();
      mockRpc.call.mockResolvedValue(bp);

      const result = await breakpointApi.createWatchpoint(
        mockRpc.rpc,
        "x",
        { goroutineID: 1, frame: 0 },
        "w"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.CreateWatchpoint", [
        { expr: "x", scope: { goroutineID: 1, frame: 0 }, watchType: "w" },
      ]);
      expect(result).toEqual(bp);
    });
  });

  describe("setBreakpointCommand", () => {
    it("should set command for breakpoint", async () => {
      const bp = createMockBreakpoint({ id: 1 });
      const updatedBp = createMockBreakpoint({ id: 1, on: "print x" });
      mockRpc.call
        .mockResolvedValueOnce([bp]) // listBreakpoints
        .mockResolvedValueOnce(updatedBp); // amendBreakpoint

      const result = await breakpointApi.setBreakpointCommand(
        mockRpc.rpc,
        1,
        "print x"
      );

      expect(result.on).toBe("print x");
    });

    it("should throw if breakpoint not found", async () => {
      mockRpc.call.mockResolvedValueOnce([]);

      await expect(
        breakpointApi.setBreakpointCommand(mockRpc.rpc, 999, "print x")
      ).rejects.toThrow("Breakpoint 999 not found");
    });
  });
});
