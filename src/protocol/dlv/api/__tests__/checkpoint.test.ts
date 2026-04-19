/**
 * Unit tests for Delve checkpoint API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as checkpointApi from "../checkpoint.js";
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

describe("checkpoint API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("createCheckpoint", () => {
    it("should call RPCServer.Checkpoint", async () => {
      const checkpoint = {
        ID: 1,
        When: "2024-01-01T00:00:00Z",
        Position: { pc: 0, file: "main.go", line: 10, function: null },
      };
      mockRpc.call.mockResolvedValue(checkpoint);

      const result = await checkpointApi.createCheckpoint(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Checkpoint", [
        { note: undefined },
      ]);
      expect(result).toEqual(checkpoint);
    });

    it("should call RPCServer.Checkpoint with note", async () => {
      const checkpoint = {
        ID: 1,
        When: "2024-01-01T00:00:00Z",
        Position: { pc: 0, file: "main.go", line: 10, function: null },
      };
      mockRpc.call.mockResolvedValue(checkpoint);

      const result = await checkpointApi.createCheckpoint(mockRpc.rpc, "before loop");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Checkpoint", [
        { note: "before loop" },
      ]);
      expect(result).toEqual(checkpoint);
    });
  });

  describe("listCheckpoints", () => {
    it("should call RPCServer.ListCheckpoints", async () => {
      const checkpoints = [
        {
          ID: 1,
          When: "2024-01-01T00:00:00Z",
          Position: { pc: 0, file: "main.go", line: 10, function: null },
        },
        {
          ID: 2,
          When: "2024-01-01T00:01:00Z",
          Position: { pc: 0, file: "main.go", line: 20, function: null },
        },
      ];
      mockRpc.call.mockResolvedValue(checkpoints);

      const result = await checkpointApi.listCheckpoints(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListCheckpoints", []);
      expect(result).toEqual(checkpoints);
    });

    it("should return empty array if no checkpoints", async () => {
      mockRpc.call.mockResolvedValue([]);

      const result = await checkpointApi.listCheckpoints(mockRpc.rpc);

      expect(result).toEqual([]);
    });
  });

  describe("clearCheckpoint", () => {
    it("should call RPCServer.ClearCheckpoint", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await checkpointApi.clearCheckpoint(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ClearCheckpoint", [
        { id: 1 },
      ]);
    });

    it("should clear checkpoint by different id", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await checkpointApi.clearCheckpoint(mockRpc.rpc, 42);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ClearCheckpoint", [
        { id: 42 },
      ]);
    });
  });
});
