/**
 * Unit tests for Delve config API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as configApi from "../config.js";
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

describe("config API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("getConfig", () => {
    it("should call RPCServer.GetConfig", async () => {
      const config: configApi.DlvDebuggerConfig = {
        showLocationRegex: false,
        substitutePathRules: [],
        debugInfoDirectories: [],
        maxStringLen: 64,
        maxArrayValues: 64,
        maxVariableRecurse: 1,
        maxStructFields: -1,
      };
      mockRpc.call.mockResolvedValue(config);

      const result = await configApi.getConfig(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.GetConfig", []);
      expect(result).toEqual(config);
    });
  });

  describe("setConfig", () => {
    it("should call RPCServer.SetConfig with partial config", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await configApi.setConfig(mockRpc.rpc, { maxStringLen: 128 });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.SetConfig", [
        { maxStringLen: 128 },
      ]);
    });

    it("should call RPCServer.SetConfig with multiple options", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await configApi.setConfig(mockRpc.rpc, {
        maxStringLen: 256,
        maxArrayValues: 128,
        maxVariableRecurse: 2,
      });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.SetConfig", [
        { maxStringLen: 256, maxArrayValues: 128, maxVariableRecurse: 2 },
      ]);
    });
  });

  describe("addSubstitutePath", () => {
    it("should call RPCServer.AddSubstitutePath", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await configApi.addSubstitutePath(mockRpc.rpc, "/remote/path", "/local/path");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.AddSubstitutePath", [
        { from: "/remote/path", to: "/local/path" },
      ]);
    });

    it("should handle Windows paths", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await configApi.addSubstitutePath(mockRpc.rpc, "C:\\remote", "D:\\local");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.AddSubstitutePath", [
        { from: "C:\\remote", to: "D:\\local" },
      ]);
    });
  });

  describe("removeSubstitutePath", () => {
    it("should call RPCServer.RemoveSubstitutePath", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await configApi.removeSubstitutePath(mockRpc.rpc, "/remote/path");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.RemoveSubstitutePath", [
        { from: "/remote/path" },
      ]);
    });

    it("should handle Windows paths", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await configApi.removeSubstitutePath(mockRpc.rpc, "C:\\remote");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.RemoveSubstitutePath", [
        { from: "C:\\remote" },
      ]);
    });
  });
});
