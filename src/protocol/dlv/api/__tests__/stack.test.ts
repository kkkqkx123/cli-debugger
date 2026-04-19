/**
 * Unit tests for Delve stack API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as stackApi from "../stack.js";
import type { DlvRpcClient } from "../../rpc.js";
import type { DlvStackFrame } from "../../types.js";

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

const createMockFrame = (index: number): DlvStackFrame => ({
  file: "main.go",
  line: 10 + index,
  function: { name: `main.func${index}`, value: 0, type: 0, goType: 0 },
  pc: 0,
  goroutineID: 1,
  systemStack: false,
});

describe("stack API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("stacktrace", () => {
    it("should call RPCServer.Stacktrace with default depth", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktrace(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { depth: 50, full: false },
      ]);
      expect(result).toEqual(frames);
    });

    it("should call RPCServer.Stacktrace with custom depth", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktrace(mockRpc.rpc, 100);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { depth: 100, full: false },
      ]);
      expect(result).toEqual(frames);
    });
  });

  describe("stacktraceGoroutine", () => {
    it("should call RPCServer.Stacktrace for specific goroutine", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktraceGoroutine(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { goroutineID: 1, depth: 50, full: false },
      ]);
      expect(result).toEqual(frames);
    });

    it("should call RPCServer.Stacktrace with custom depth", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktraceGoroutine(mockRpc.rpc, 1, 100);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { goroutineID: 1, depth: 100, full: false },
      ]);
      expect(result).toEqual(frames);
    });
  });

  describe("stacktraceFull", () => {
    it("should call RPCServer.Stacktrace with full=true", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktraceFull(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { depth: 50, full: true },
      ]);
      expect(result).toEqual(frames);
    });

    it("should call RPCServer.Stacktrace for specific goroutine", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktraceFull(mockRpc.rpc, 1, 100);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { goroutineID: 1, depth: 100, full: true },
      ]);
      expect(result).toEqual(frames);
    });
  });

  describe("stacktraceWithDefers", () => {
    it("should call RPCServer.Stacktrace with defers=true", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktraceWithDefers(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { depth: 50, defers: true },
      ]);
      expect(result).toEqual(frames);
    });

    it("should call RPCServer.Stacktrace for specific goroutine", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.stacktraceWithDefers(mockRpc.rpc, 1, 100);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { goroutineID: 1, depth: 100, defers: true },
      ]);
      expect(result).toEqual(frames);
    });
  });

  describe("getStackFrameCount", () => {
    it("should return frame count", async () => {
      const frames = [createMockFrame(0), createMockFrame(1)];
      mockRpc.call.mockResolvedValue(frames);

      const count = await stackApi.getStackFrameCount(mockRpc.rpc);

      expect(count).toBe(2);
    });

    it("should return frame count for specific goroutine", async () => {
      const frames = [createMockFrame(0), createMockFrame(1), createMockFrame(2)];
      mockRpc.call.mockResolvedValue(frames);

      const count = await stackApi.getStackFrameCount(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Stacktrace", [
        { goroutineID: 1, depth: 1000, full: false },
      ]);
      expect(count).toBe(3);
    });
  });

  describe("getFrame", () => {
    it("should return frame at index", async () => {
      const frames = [createMockFrame(0), createMockFrame(1)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.getFrame(mockRpc.rpc, 1, 1);

      expect(result).toEqual(frames[1]);
    });

    it("should return null if index out of bounds", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.getFrame(mockRpc.rpc, 1, 5);

      expect(result).toBeNull();
    });
  });

  describe("ancestorStacktrace", () => {
    it("should call RPCServer.Ancestors", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.ancestorStacktrace(mockRpc.rpc, 1, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Ancestors", [
        { goroutineID: 1, ancestor: 1, depth: 50 },
      ]);
      expect(result).toEqual(frames);
    });

    it("should call RPCServer.Ancestors with custom depth", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.ancestorStacktrace(mockRpc.rpc, 1, 1, 100);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Ancestors", [
        { goroutineID: 1, ancestor: 1, depth: 100 },
      ]);
      expect(result).toEqual(frames);
    });
  });

  describe("currentLocation", () => {
    it("should return location from stacktrace for specific goroutine", async () => {
      const frame = createMockFrame(0);
      mockRpc.call.mockResolvedValue([frame]);

      const result = await stackApi.currentLocation(mockRpc.rpc, 1);

      expect(result).toEqual({
        pc: frame.pc,
        file: frame.file,
        line: frame.line,
        function: frame.function,
      });
    });

    it("should return null if no frames", async () => {
      mockRpc.call.mockResolvedValue([]);

      const result = await stackApi.currentLocation(mockRpc.rpc, 1);

      expect(result).toBeNull();
    });

    it("should return location from debugger state", async () => {
      const loc = { pc: 0, file: "main.go", line: 10, function: null };
      mockRpc.call.mockResolvedValue({ currentGoroutine: { currentLoc: loc } });

      const result = await stackApi.currentLocation(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.State", [false]);
      expect(result).toEqual(loc);
    });

    it("should return null if no current goroutine", async () => {
      mockRpc.call.mockResolvedValue({ currentGoroutine: null });

      const result = await stackApi.currentLocation(mockRpc.rpc);

      expect(result).toBeNull();
    });
  });

  describe("formatStackFrame", () => {
    it("should format stack frame", () => {
      const frame = createMockFrame(0);
      const result = stackApi.formatStackFrame(frame, 0);

      expect(result).toBe("0: main.func0 at main.go:10");
    });

    it("should handle null function", () => {
      const frame: DlvStackFrame = {
        file: "main.go",
        line: 10,
        function: null,
        pc: 0,
        goroutineID: 1,
        systemStack: false,
      };
      const result = stackApi.formatStackFrame(frame, 0);

      expect(result).toBe("0: ??? at main.go:10");
    });
  });

  describe("formatStacktrace", () => {
    it("should format stacktrace", () => {
      const frames = [createMockFrame(0), createMockFrame(1)];
      const result = stackApi.formatStacktrace(frames);

      expect(result).toBe(
        "0: main.func0 at main.go:10\n1: main.func1 at main.go:11"
      );
    });
  });

  describe("frameUp", () => {
    it("should move up in stack", async () => {
      const frames = [createMockFrame(0), createMockFrame(1), createMockFrame(2)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.frameUp(mockRpc.rpc, 1, 0, 1);

      expect(result).toEqual({ frame: frames[1], index: 1 });
    });

    it("should return null if out of bounds", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.frameUp(mockRpc.rpc, 1, 0, 1);

      expect(result).toBeNull();
    });
  });

  describe("frameDown", () => {
    it("should move down in stack", async () => {
      const frames = [createMockFrame(0), createMockFrame(1)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.frameDown(mockRpc.rpc, 1, 1, 1);

      expect(result).toEqual({ frame: frames[0], index: 0 });
    });

    it("should return null if index < 0", async () => {
      const frames = [createMockFrame(0)];
      mockRpc.call.mockResolvedValue(frames);

      const result = await stackApi.frameDown(mockRpc.rpc, 1, 0, 1);

      expect(result).toBeNull();
    });
  });

  describe("setFrame", () => {
    it("should call RPCServer.Frame", async () => {
      const state = { running: false };
      mockRpc.call.mockResolvedValue(state);

      const result = await stackApi.setFrame(mockRpc.rpc, 1, 0);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Frame", [
        { goroutineID: 1, frame: 0 },
      ]);
      expect(result).toEqual(state);
    });
  });

  describe("listDeferredCalls", () => {
    it("should return deferred calls from frame", async () => {
      const frame: DlvStackFrame = {
        file: "main.go",
        line: 10,
        function: null,
        pc: 0,
        goroutineID: 1,
        systemStack: false,
        defers: [
          {
            index: 0,
            function: null,
            location: { pc: 0, file: "main.go", line: 20, function: null },
            unreadable: "",
          },
        ],
      };
      mockRpc.call.mockResolvedValue([frame]);

      const result = await stackApi.listDeferredCalls(mockRpc.rpc, 1, 0);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("index", 0);
    });

    it("should return empty array if no defers", async () => {
      const frame = createMockFrame(0);
      mockRpc.call.mockResolvedValue([frame]);

      const result = await stackApi.listDeferredCalls(mockRpc.rpc, 1, 0);

      expect(result).toEqual([]);
    });

    it("should return empty array if no frame", async () => {
      mockRpc.call.mockResolvedValue([]);

      const result = await stackApi.listDeferredCalls(mockRpc.rpc, 1, 0);

      expect(result).toEqual([]);
    });
  });
});
