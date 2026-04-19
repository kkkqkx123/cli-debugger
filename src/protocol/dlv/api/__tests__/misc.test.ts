/**
 * Unit tests for Delve misc API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as miscApi from "../misc.js";
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

describe("misc API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("getTarget", () => {
    it("should call RPCServer.GetTarget", async () => {
      const target = { pid: 1234, cmd: ["./app", "-flag"] };
      mockRpc.call.mockResolvedValue(target);

      const result = await miscApi.getTarget(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.GetTarget", []);
      expect(result).toEqual(target);
    });

    it("should return target with pid and cmd", async () => {
      const target = { pid: 5678, cmd: ["go", "run", "main.go"] };
      mockRpc.call.mockResolvedValue(target);

      const result = await miscApi.getTarget(mockRpc.rpc);

      expect(result.pid).toBe(5678);
      expect(result.cmd).toEqual(["go", "run", "main.go"]);
    });
  });

  describe("dumpCore", () => {
    it("should call RPCServer.Dump", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.dumpCore(mockRpc.rpc, "/tmp/core.dump");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Dump", [
        { dest: "/tmp/core.dump" },
      ]);
    });

    it("should handle Windows path", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.dumpCore(mockRpc.rpc, "C:\\dumps\\core.dump");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Dump", [
        { dest: "C:\\dumps\\core.dump" },
      ]);
    });
  });

  describe("rebuild", () => {
    it("should call RPCServer.Rebuild", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.rebuild(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Rebuild", []);
    });
  });

  describe("editSource", () => {
    it("should call RPCServer.Edit with file only", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.editSource(mockRpc.rpc, "main.go");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Edit", [
        { file: "main.go", line: undefined },
      ]);
    });

    it("should call RPCServer.Edit with file and line", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.editSource(mockRpc.rpc, "main.go", 42);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Edit", [
        { file: "main.go", line: 42 },
      ]);
    });
  });

  describe("sourceScript", () => {
    it("should call RPCServer.Source", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.sourceScript(mockRpc.rpc, "/path/to/script.dlv");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Source", [
        { path: "/path/to/script.dlv" },
      ]);
    });

    it("should handle Windows path", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.sourceScript(mockRpc.rpc, "C:\\scripts\\debug.dlv");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Source", [
        { path: "C:\\scripts\\debug.dlv" },
      ]);
    });
  });

  describe("transcript", () => {
    it("should call RPCServer.Transcript with path", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.transcript(mockRpc.rpc, "/tmp/transcript.txt");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Transcript", [
        { path: "/tmp/transcript.txt" },
      ]);
    });

    it("should call RPCServer.Transcript without path", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await miscApi.transcript(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Transcript", [
        { path: undefined },
      ]);
    });
  });
});
