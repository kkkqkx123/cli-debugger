/**
 * Unit tests for Delve info API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as infoApi from "../info.js";
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

describe("info API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("listFunctions", () => {
    it("should call RPCServer.ListFunctions", async () => {
      const funcs = [{ name: "main.main", type: 0, value: 0, goType: 0 }];
      mockRpc.call.mockResolvedValue(funcs);

      const result = await infoApi.listFunctions(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListFunctions", [
        { filter: undefined },
      ]);
      expect(result).toEqual(funcs);
    });

    it("should call RPCServer.ListFunctions with filter", async () => {
      const funcs = [{ name: "main.main", type: 0, value: 0, goType: 0 }];
      mockRpc.call.mockResolvedValue(funcs);

      const result = await infoApi.listFunctions(mockRpc.rpc, "main");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListFunctions", [
        { filter: "main" },
      ]);
      expect(result).toEqual(funcs);
    });
  });

  describe("listPackages", () => {
    it("should call RPCServer.ListPackages", async () => {
      const pkgs = ["main", "fmt"];
      mockRpc.call.mockResolvedValue(pkgs);

      const result = await infoApi.listPackages(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListPackages", [
        { filter: undefined },
      ]);
      expect(result).toEqual(pkgs);
    });

    it("should call RPCServer.ListPackages with filter", async () => {
      const pkgs = ["main"];
      mockRpc.call.mockResolvedValue(pkgs);

      const result = await infoApi.listPackages(mockRpc.rpc, "main");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListPackages", [
        { filter: "main" },
      ]);
      expect(result).toEqual(pkgs);
    });
  });

  describe("listSources", () => {
    it("should call RPCServer.ListSources", async () => {
      const sources = ["main.go", "lib.go"];
      mockRpc.call.mockResolvedValue(sources);

      const result = await infoApi.listSources(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListSources", [
        { filter: undefined },
      ]);
      expect(result).toEqual(sources);
    });

    it("should call RPCServer.ListSources with filter", async () => {
      const sources = ["main.go"];
      mockRpc.call.mockResolvedValue(sources);

      const result = await infoApi.listSources(mockRpc.rpc, "main");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListSources", [
        { filter: "main" },
      ]);
      expect(result).toEqual(sources);
    });
  });

  describe("listTypes", () => {
    it("should call RPCServer.ListTypes", async () => {
      const types = [{ name: "int", size: 8, kind: 0 }];
      mockRpc.call.mockResolvedValue(types);

      const result = await infoApi.listTypes(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListTypes", [
        { filter: undefined },
      ]);
      expect(result).toEqual(types);
    });

    it("should call RPCServer.ListTypes with filter", async () => {
      const types = [{ name: "main.MyType", size: 16, kind: 7 }];
      mockRpc.call.mockResolvedValue(types);

      const result = await infoApi.listTypes(mockRpc.rpc, "main");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListTypes", [
        { filter: "main" },
      ]);
      expect(result).toEqual(types);
    });
  });

  describe("listLibraries", () => {
    it("should call RPCServer.ListDynamicLibraries", async () => {
      const libs = [{ path: "/lib/libc.so", address: 0x1000, loaded: true }];
      mockRpc.call.mockResolvedValue(libs);

      const result = await infoApi.listLibraries(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith(
        "RPCServer.ListDynamicLibraries",
        []
      );
      expect(result).toEqual(libs);
    });
  });

  describe("listSource", () => {
    it("should call RPCServer.List", async () => {
      const source = {
        file: "main.go",
        line: 1,
        content: ["package main", "", "func main() {}"],
        locs: [],
      };
      mockRpc.call.mockResolvedValue(source);

      const result = await infoApi.listSource(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.List", [{ loc: "" }]);
      expect(result).toEqual(source);
    });

    it("should call RPCServer.List with locspec", async () => {
      const source = {
        file: "main.go",
        line: 10,
        content: ["func main() {}"],
        locs: [],
      };
      mockRpc.call.mockResolvedValue(source);

      const result = await infoApi.listSource(mockRpc.rpc, "main.go:10");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.List", [
        { loc: "main.go:10" },
      ]);
      expect(result).toEqual(source);
    });
  });
});
