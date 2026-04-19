/**
 * Unit tests for Delve debugger API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as debuggerApi from "../debugger.js";
import type { DlvRpcClient } from "../../rpc.js";

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

const createMockState = () => ({
  running: false,
  recording: false,
  recordingManuallyStarted: false,
  currentThread: null,
  currentGoroutine: null,
  SelectedGoroutine: null,
  exited: false,
  exitStatus: 0,
  when: "now",
});

describe("debugger API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("getVersion", () => {
    it("should call RPCServer.Version", async () => {
      const version = { DelveVersion: "1.20.0", APIVersion: "2" };
      mockRpc.call.mockResolvedValue(version);

      const result = await debuggerApi.getVersion(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Version", []);
      expect(result).toEqual(version);
    });
  });

  describe("getState", () => {
    it("should call RPCServer.State with false", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue(state);

      const result = await debuggerApi.getState(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.State", [false]);
      expect(result).toEqual(state);
    });
  });

  describe("getStateWithNext", () => {
    it("should call RPCServer.State with true", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue(state);

      const result = await debuggerApi.getStateWithNext(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.State", [true]);
      expect(result).toEqual(state);
    });
  });

  describe("command", () => {
    it("should call RPCServer.Command with params", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.command(mockRpc.rpc, { name: "continue" });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "continue" },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("continueExecution", () => {
    it("should send continue command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.continueExecution(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "continue", goroutineID: undefined },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send continue command for specific goroutine", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.continueExecution(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "continue", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("next", () => {
    it("should send next command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.next(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "next", goroutineID: undefined },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send next command for specific goroutine", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.next(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "next", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("step", () => {
    it("should send step command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.step(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "step", goroutineID: undefined },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send step command for specific goroutine", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.step(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "step", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("stepOut", () => {
    it("should send stepout command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.stepOut(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "stepout", goroutineID: undefined },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send stepout command for specific goroutine", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.stepOut(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "stepout", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("halt", () => {
    it("should send halt command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.halt(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "halt" },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("switchGoroutine", () => {
    it("should send switchGoroutine command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.switchGoroutine(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "switchGoroutine", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("switchThread", () => {
    it("should send switchThread command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.switchThread(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "switchThread", threadID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("rewind", () => {
    it("should send rewind command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.rewind(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "rewind", goroutineID: undefined },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send rewind command for specific goroutine", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.rewind(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "rewind", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("callFunction", () => {
    it("should send call command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.callFunction(mockRpc.rpc, "foo()");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "call", expr: "foo()", goroutineID: undefined, unsafeCall: false },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send call command with goroutine and unsafe flag", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.callFunction(mockRpc.rpc, "foo()", 1, true);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "call", expr: "foo()", goroutineID: 1, unsafeCall: true },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("listThreads", () => {
    it("should call RPCServer.ListThreads", async () => {
      const threads = [
        {
          id: 1,
          pc: 0,
          file: "main.go",
          line: 10,
          function: null,
          goroutineID: 1,
          breakPoint: null,
          breakPointInfo: null,
        },
      ];
      mockRpc.call.mockResolvedValue(threads);

      const result = await debuggerApi.listThreads(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListThreads", []);
      expect(result).toEqual(threads);
    });
  });

  describe("getThread", () => {
    it("should call RPCServer.GetThread", async () => {
      const thread = {
        id: 1,
        pc: 0,
        file: "main.go",
        line: 10,
        function: null,
        goroutineID: 1,
        breakPoint: null,
        breakPointInfo: null,
      };
      mockRpc.call.mockResolvedValue(thread);

      const result = await debuggerApi.getThread(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.GetThread", [{ id: 1 }]);
      expect(result).toEqual(thread);
    });
  });

  describe("restart", () => {
    it("should call RPCServer.Restart with defaults", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue(state);

      const result = await debuggerApi.restart(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Restart", [
        { position: undefined, resetArgs: false, newArgs: undefined },
      ]);
      expect(result).toEqual(state);
    });

    it("should call RPCServer.Restart with position", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue(state);

      const result = await debuggerApi.restart(mockRpc.rpc, "main.go:10");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Restart", [
        { position: "main.go:10", resetArgs: false, newArgs: undefined },
      ]);
      expect(result).toEqual(state);
    });

    it("should call RPCServer.Restart with resetArgs and newArgs", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue(state);

      const result = await debuggerApi.restart(mockRpc.rpc, undefined, true, ["arg1"]);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Restart", [
        { position: undefined, resetArgs: true, newArgs: ["arg1"] },
      ]);
      expect(result).toEqual(state);
    });
  });

  describe("detach", () => {
    it("should call RPCServer.Detach with kill=true by default", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await debuggerApi.detach(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Detach", [{ kill: true }]);
    });

    it("should call RPCServer.Detach with kill=false", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await debuggerApi.detach(mockRpc.rpc, false);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Detach", [{ kill: false }]);
    });
  });

  describe("nextInstruction", () => {
    it("should send nextInstruction command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.nextInstruction(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "nextInstruction", goroutineID: undefined },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send nextInstruction command for specific goroutine", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.nextInstruction(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "nextInstruction", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });

  describe("stepInstruction", () => {
    it("should send stepInstruction command", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.stepInstruction(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "stepInstruction", goroutineID: undefined },
      ]);
      expect(result.State).toEqual(state);
    });

    it("should send stepInstruction command for specific goroutine", async () => {
      const state = createMockState();
      mockRpc.call.mockResolvedValue({ State: state });

      const result = await debuggerApi.stepInstruction(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Command", [
        { name: "stepInstruction", goroutineID: 1 },
      ]);
      expect(result.State).toEqual(state);
    });
  });
});
