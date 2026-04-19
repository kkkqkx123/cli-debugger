/**
 * Unit tests for Delve goroutine API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as goroutineApi from "../goroutine.js";
import type { DlvRpcClient } from "../../rpc.js";
import type { DlvGoroutine, DlvGroupBy } from "../../types.js";

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

const createMockGoroutine = (id: number): DlvGoroutine => ({
  id,
  currentLoc: {
    pc: 0,
    file: "main.go",
    line: 10,
    function: { name: "main.main", value: 0, type: 0, goType: 0 },
  },
  userCurrentLoc: {
    pc: 0,
    file: "main.go",
    line: 10,
    function: { name: "main.main", value: 0, type: 0, goType: 0 },
  },
  goStatementLoc: { pc: 0, file: "", line: 0, function: null },
  threadId: id,
  systemStack: false,
});

describe("goroutine API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("listGoroutines", () => {
    it("should call RPCServer.ListGoroutines with defaults", async () => {
      const result = { Goroutines: [createMockGoroutine(1)], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutines(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { start: 0, count: 0 },
      ]);
      expect(goroutines).toEqual(result);
    });

    it("should call RPCServer.ListGoroutines with start and count", async () => {
      const result = { Goroutines: [createMockGoroutine(1)], Nextg: 2, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutines(mockRpc.rpc, 0, 100);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { start: 0, count: 100 },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("listGoroutinesFiltered", () => {
    it("should call RPCServer.ListGoroutines with filter params", async () => {
      const result = { Goroutines: [createMockGoroutine(1)], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutinesFiltered(mockRpc.rpc, {
        start: 0,
        count: 10,
        filter: { kind: "running", arg: true },
      });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { start: 0, count: 10, filter: { kind: "running", arg: true } },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("getAllGoroutines", () => {
    it("should get all goroutines in single batch", async () => {
      const g1 = createMockGoroutine(1);
      const g2 = createMockGoroutine(2);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1, g2], Nextg: -1, GroupBy: null });

      const goroutines = await goroutineApi.getAllGoroutines(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledTimes(1);
      expect(goroutines).toEqual([g1, g2]);
    });

    it("should handle pagination", async () => {
      const g1 = createMockGoroutine(1);
      const g2 = createMockGoroutine(2);
      mockRpc.call
        .mockResolvedValueOnce({ Goroutines: [g1], Nextg: 1, GroupBy: null })
        .mockResolvedValueOnce({ Goroutines: [g2], Nextg: -1, GroupBy: null });

      const goroutines = await goroutineApi.getAllGoroutines(mockRpc.rpc);

      // Note: pagination stops when Goroutines.length < batchSize (100)
      // Since we only return 1 item in first batch, it stops
      expect(goroutines).toEqual([g1]);
    });
  });

  describe("getGoroutine", () => {
    it("should call RPCServer.GetGoroutine", async () => {
      const g = createMockGoroutine(1);
      mockRpc.call.mockResolvedValue(g);

      const result = await goroutineApi.getGoroutine(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.GetGoroutine", [{ id: 1 }]);
      expect(result).toEqual(g);
    });
  });

  describe("listGoroutinesGrouped", () => {
    it("should call RPCServer.ListGoroutines with groupBy", async () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutinesGrouped(mockRpc.rpc, "userloc");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { groupBy: "userloc" },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("listGoroutinesGroupedByLabel", () => {
    it("should call RPCServer.ListGoroutines with label groupBy", async () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutinesGroupedByLabel(
        mockRpc.rpc,
        "key"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { groupBy: "label", groupByArg: "key" },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("listGoroutinesWithLabel", () => {
    it("should call RPCServer.ListGoroutines with labels", async () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutinesWithLabel(
        mockRpc.rpc,
        "key",
        "value"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { labels: { key: "value" } },
      ]);
      expect(goroutines).toEqual(result);
    });

    it("should call RPCServer.ListGoroutines with key only", async () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutinesWithLabel(mockRpc.rpc, "key");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { labels: {} },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("listGoroutinesOnChannel", () => {
    it("should call RPCServer.ListGoroutines with channel filter", async () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listGoroutinesOnChannel(
        mockRpc.rpc,
        "ch"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { filter: { kind: "chan", arg: "ch" } },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("listRunningGoroutines", () => {
    it("should call RPCServer.ListGoroutines with running filter", async () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listRunningGoroutines(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { filter: { kind: "running", arg: true } },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("listUserGoroutines", () => {
    it("should call RPCServer.ListGoroutines with user filter", async () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };
      mockRpc.call.mockResolvedValue(result);

      const goroutines = await goroutineApi.listUserGoroutines(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { filter: { kind: "user", arg: true } },
      ]);
      expect(goroutines).toEqual(result);
    });
  });

  describe("getGoroutineCount", () => {
    it("should return count from single batch", async () => {
      const g1 = createMockGoroutine(1);
      const g2 = createMockGoroutine(2);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1, g2], Nextg: -1, GroupBy: null });

      const count = await goroutineApi.getGoroutineCount(mockRpc.rpc);

      expect(count).toBe(2);
    });

    it("should count all goroutines with pagination", async () => {
      const g1 = createMockGoroutine(1);
      // When Nextg >= 0 and Goroutines.length < batchSize, pagination stops
      mockRpc.call.mockResolvedValue({ Goroutines: [g1], Nextg: 1, GroupBy: null });

      const count = await goroutineApi.getGoroutineCount(mockRpc.rpc);

      // Since first batch has length < batchSize (100), it stops
      expect(count).toBe(1);
    });
  });

  describe("findGoroutineByLocation", () => {
    it("should find goroutine by file pattern", async () => {
      const g1 = createMockGoroutine(1);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1], Nextg: -1, GroupBy: null });

      const result = await goroutineApi.findGoroutineByLocation(mockRpc.rpc, "main");

      expect(result).toEqual(g1);
    });

    it("should find goroutine by function pattern", async () => {
      const g1 = createMockGoroutine(1);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1], Nextg: -1, GroupBy: null });

      const result = await goroutineApi.findGoroutineByLocation(mockRpc.rpc, "main.main");

      expect(result).toEqual(g1);
    });

    it("should return null if not found", async () => {
      const g1 = createMockGoroutine(1);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1], Nextg: -1, GroupBy: null });

      const result = await goroutineApi.findGoroutineByLocation(mockRpc.rpc, "notfound");

      expect(result).toBeNull();
    });
  });

  describe("getGoroutineLabels", () => {
    it("should call RPCServer.GoroutineLabels", async () => {
      const labels = { key: "value" };
      mockRpc.call.mockResolvedValue(labels);

      const result = await goroutineApi.getGoroutineLabels(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.GoroutineLabels", [
        { goroutineID: 1 },
      ]);
      expect(result).toEqual(labels);
    });
  });

  describe("groupByToMap", () => {
    it("should convert group result to map", () => {
      const result = {
        Goroutines: [],
        Nextg: -1,
        GroupBy: [
          { Group: "group1", Goroutines: [1, 2], Count: 2 },
          { Group: "group2", Goroutines: [3], Count: 1 },
        ] as unknown as DlvGroupBy,
      };

      const map = goroutineApi.groupByToMap(result);

      expect(map.get("group1")).toEqual([1, 2]);
      expect(map.get("group2")).toEqual([3]);
    });

    it("should return empty map if no GroupBy", () => {
      const result = { Goroutines: [], Nextg: -1, GroupBy: null };

      const map = goroutineApi.groupByToMap(result);

      expect(map.size).toBe(0);
    });
  });

  describe("execOnAllGoroutines", () => {
    it("should execute command on all goroutines", async () => {
      const g1 = createMockGoroutine(1);
      const g2 = createMockGoroutine(2);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1, g2], Nextg: -1, GroupBy: null });

      const commandFn = vi.fn().mockResolvedValue("result");
      const results = await goroutineApi.execOnAllGoroutines(mockRpc.rpc, commandFn);

      expect(commandFn).toHaveBeenCalledTimes(2);
      expect(results.get(1)).toBe("result");
      expect(results.get(2)).toBe("result");
    });

    it("should handle errors in command execution", async () => {
      const g1 = createMockGoroutine(1);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1], Nextg: -1, GroupBy: null });

      const commandFn = vi.fn().mockRejectedValue(new Error("test error"));
      const results = await goroutineApi.execOnAllGoroutines(mockRpc.rpc, commandFn);

      expect(results.get(1)).toEqual({ error: "Error: test error" });
    });

    it("should use filter params", async () => {
      const g1 = createMockGoroutine(1);
      mockRpc.call.mockResolvedValue({ Goroutines: [g1], Nextg: -1, GroupBy: null });

      const commandFn = vi.fn().mockResolvedValue("result");
      await goroutineApi.execOnAllGoroutines(mockRpc.rpc, commandFn, {
        filter: { kind: "running", arg: true },
      });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListGoroutines", [
        { filter: { kind: "running", arg: true } },
      ]);
    });
  });
});
