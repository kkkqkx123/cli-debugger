/**
 * Unit tests for Delve variable API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as variableApi from "../variable.js";
import type { DlvRpcClient } from "../../rpc.js";
import type { DlvVariable } from "../../types.js";
import { VariableKind } from "../../types.js";

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

const createMockVariable = (
  overrides: Partial<DlvVariable> = {}
): DlvVariable => ({
  name: "x",
  addr: 0,
  type: "int",
  realType: "int",
  value: "42",
  kind: VariableKind.Int,
  children: [],
  len: 0,
  cap: 0,
  flags: 0,
  onlyAddr: false,
  base: 0,
  stride: 0,
  unreadable: "",
  LocationExpr: "",
  DeclLine: 0,
  ...overrides,
});

describe("variable API", () => {
  let mockRpc: ReturnType<typeof createMockRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = createMockRpc();
  });

  describe("listLocalVars", () => {
    it("should call RPCServer.ListLocalVars", async () => {
      const vars = [createMockVariable()];
      mockRpc.call.mockResolvedValue(vars);

      const result = await variableApi.listLocalVars(mockRpc.rpc, {
        goroutineID: 1,
        frame: 0,
        deferredCall: 0,
      });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListLocalVars", [
        {
          scope: { goroutineID: 1, frame: 0, deferredCall: 0 },
          cfg: {
            followPointers: true,
            maxVariableRecurse: 1,
            maxStringLen: 64,
            maxArrayValues: 64,
            maxStructFields: -1,
          },
        },
      ]);
      expect(result).toEqual(vars);
    });
  });

  describe("listFunctionArgs", () => {
    it("should call RPCServer.ListFunctionArgs", async () => {
      const vars = [createMockVariable({ name: "arg" })];
      mockRpc.call.mockResolvedValue(vars);

      const result = await variableApi.listFunctionArgs(mockRpc.rpc, {
        goroutineID: 1,
        frame: 0,
        deferredCall: 0,
      });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListFunctionArgs", [
        {
          scope: { goroutineID: 1, frame: 0, deferredCall: 0 },
          cfg: {
            followPointers: true,
            maxVariableRecurse: 1,
            maxStringLen: 64,
            maxArrayValues: 64,
            maxStructFields: -1,
          },
        },
      ]);
      expect(result).toEqual(vars);
    });
  });

  describe("listPackageVars", () => {
    it("should call RPCServer.ListPackageVars", async () => {
      const vars = [createMockVariable()];
      mockRpc.call.mockResolvedValue(vars);

      const result = await variableApi.listPackageVars(mockRpc.rpc, "main");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListPackageVars", [
        {
          filter: "main",
          cfg: {
            followPointers: true,
            maxVariableRecurse: 1,
            maxStringLen: 64,
            maxArrayValues: 64,
            maxStructFields: -1,
          },
        },
      ]);
      expect(result).toEqual(vars);
    });
  });

  describe("listPackageConstants", () => {
    it("should call RPCServer.ListPackageVars with includeConstants", async () => {
      const vars = [createMockVariable()];
      mockRpc.call.mockResolvedValue(vars);

      const result = await variableApi.listPackageConstants(mockRpc.rpc, "main");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ListPackageVars", [
        {
          filter: "main",
          cfg: {
            followPointers: true,
            maxVariableRecurse: 1,
            maxStringLen: 64,
            maxArrayValues: 64,
            maxStructFields: -1,
          },
          includeConstants: true,
        },
      ]);
      expect(result).toEqual(vars);
    });
  });

  describe("evalExpr", () => {
    it("should call RPCServer.Eval", async () => {
      const v = createMockVariable();
      mockRpc.call.mockResolvedValue(v);

      const result = await variableApi.evalExpr(mockRpc.rpc, "x");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Eval", [
        {
          expr: "x",
          cfg: {
            followPointers: true,
            maxVariableRecurse: 1,
            maxStringLen: 64,
            maxArrayValues: 64,
            maxStructFields: -1,
          },
        },
      ]);
      expect(result).toEqual(v);
    });

    it("should call RPCServer.Eval with scope", async () => {
      const v = createMockVariable();
      mockRpc.call.mockResolvedValue(v);

      const result = await variableApi.evalExpr(mockRpc.rpc, "x", {
        goroutineID: 1,
        frame: 0,
        deferredCall: 0,
      });

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Eval", [
        {
          expr: "x",
          scope: { goroutineID: 1, frame: 0, deferredCall: 0 },
          cfg: {
            followPointers: true,
            maxVariableRecurse: 1,
            maxStringLen: 64,
            maxArrayValues: 64,
            maxStructFields: -1,
          },
        },
      ]);
      expect(result).toEqual(v);
    });
  });

  describe("evalExprTyped", () => {
    it("should evaluate and parse result", async () => {
      const v = createMockVariable({ kind: VariableKind.Int, value: "42" });
      mockRpc.call.mockResolvedValue(v);

      const result = await variableApi.evalExprTyped<number>(mockRpc.rpc, "x");

      expect(result).toBe(42);
    });
  });

  describe("setVar", () => {
    it("should call RPCServer.Set", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await variableApi.setVar(
        mockRpc.rpc,
        { goroutineID: 1, frame: 0, deferredCall: 0 },
        "x",
        "10"
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Set", [
        { scope: { goroutineID: 1, frame: 0, deferredCall: 0 }, name: "x", value: "10" },
      ]);
    });
  });

  describe("getType", () => {
    it("should return variable type", async () => {
      const v = createMockVariable({ type: "int" });
      mockRpc.call.mockResolvedValue(v);

      const result = await variableApi.getType(mockRpc.rpc, "x");

      expect(result).toBe("int");
    });
  });

  describe("disassemble", () => {
    it("should call RPCServer.Disassemble", async () => {
      const result = { Locs: [] };
      mockRpc.call.mockResolvedValue(result);

      const disasm = await variableApi.disassemble(
        mockRpc.rpc,
        { goroutineID: 1, frame: 0, deferredCall: 0 },
        0,
        100
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Disassemble", [
        { scope: { goroutineID: 1, frame: 0, deferredCall: 0 }, startPC: 0, endPC: 100 },
      ]);
      expect(disasm).toEqual(result);
    });
  });

  describe("examineMemory", () => {
    it("should call RPCServer.ExamineMemory", async () => {
      const result = { Address: 0, Memory: [0x90, 0x90], IsLittleEndian: true };
      mockRpc.call.mockResolvedValue(result);

      const mem = await variableApi.examineMemory(mockRpc.rpc, 0, 2);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.ExamineMemory", [
        { address: 0, length: 2 },
      ]);
      expect(mem).toEqual(result);
    });
  });

  describe("registers", () => {
    it("should call RPCServer.Registers", async () => {
      const regs = [{ Name: "RIP", Value: "0x1000", DwarfNumber: 0, PC: 0x1000 }];
      mockRpc.call.mockResolvedValue(regs);

      const result = await variableApi.registers(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Registers", [
        { scope: undefined, includeFp: false },
      ]);
      expect(result).toEqual(regs);
    });

    it("should call RPCServer.Registers with scope and includeFp", async () => {
      const regs = [];
      mockRpc.call.mockResolvedValue(regs);

      await variableApi.registers(
        mockRpc.rpc,
        { goroutineID: 1, frame: 0, deferredCall: 0 },
        true
      );

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Registers", [
        { scope: { goroutineID: 1, frame: 0, deferredCall: 0 }, includeFp: true },
      ]);
    });
  });

  describe("parseVariableValue", () => {
    it("should return unreadable message for unreadable variable", () => {
      const v = createMockVariable({ unreadable: "error" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBe("<unreadable: error>");
    });

    it("should parse bool", () => {
      const v = createMockVariable({ kind: VariableKind.Bool, value: "true" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBe(true);
    });

    it("should parse int", () => {
      const v = createMockVariable({ kind: VariableKind.Int, value: "42" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBe(42);
    });

    it("should parse float", () => {
      const v = createMockVariable({ kind: VariableKind.Float, value: "3.14" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBe(3.14);
    });

    it("should parse string", () => {
      const v = createMockVariable({ kind: VariableKind.String, value: "hello" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBe("hello");
    });

    it("should parse nil pointer", () => {
      const v = createMockVariable({ kind: VariableKind.Pointer, value: "nil" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBeNull();
    });

    it("should parse pointer with children", () => {
      const child = createMockVariable({ name: "val", kind: VariableKind.Int, value: "10" });
      const v = createMockVariable({
        kind: VariableKind.Pointer,
        value: "0x1000",
        addr: 0x1000,
        type: "*int",
        children: [child],
      });
      const result = variableApi.parseVariableValue(v) as { address: number; type: string; value: DlvVariable[] };
      expect(result.address).toBe(0x1000);
      expect(result.type).toBe("*int");
      expect(result.value).toHaveLength(1);
    });

    it("should parse array", () => {
      const v = createMockVariable({
        kind: VariableKind.Array,
        children: [
          createMockVariable({ kind: VariableKind.Int, value: "1" }),
          createMockVariable({ kind: VariableKind.Int, value: "2" }),
        ],
      });
      const result = variableApi.parseVariableValue(v);
      expect(result).toEqual([1, 2]);
    });

    it("should parse slice", () => {
      const v = createMockVariable({
        kind: VariableKind.Slice,
        children: [
          createMockVariable({ kind: VariableKind.Int, value: "1" }),
          createMockVariable({ kind: VariableKind.Int, value: "2" }),
        ],
      });
      const result = variableApi.parseVariableValue(v);
      expect(result).toEqual([1, 2]);
    });

    it("should parse struct", () => {
      const v = createMockVariable({
        kind: VariableKind.Struct,
        children: [
          createMockVariable({ name: "X", kind: VariableKind.Int, value: "1" }),
          createMockVariable({ name: "Y", kind: VariableKind.Int, value: "2" }),
        ],
      });
      const result = variableApi.parseVariableValue(v) as Record<string, number>;
      expect(result.X).toBe(1);
      expect(result.Y).toBe(2);
    });

    it("should parse nil interface", () => {
      const v = createMockVariable({ kind: VariableKind.Interface, value: "nil" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBeNull();
    });

    it("should parse interface with value", () => {
      const child = createMockVariable({ kind: VariableKind.Int, value: "42" });
      const v = createMockVariable({
        kind: VariableKind.Interface,
        type: "interface{}",
        value: "42",
        children: [child],
      });
      const result = variableApi.parseVariableValue(v) as { type: string; value: number };
      expect(result.type).toBe("interface{}");
      expect(result.value).toBe(42);
    });

    it("should parse map", () => {
      const v = createMockVariable({
        kind: VariableKind.Map,
        children: [
          createMockVariable({
            name: "",
            children: [
              createMockVariable({ name: "key", kind: VariableKind.String, value: "a" }),
              createMockVariable({ name: "value", kind: VariableKind.Int, value: "1" }),
            ],
          }),
        ],
      });
      const result = variableApi.parseVariableValue(v) as Map<string, number>;
      expect(result.get("a")).toBe(1);
    });

    it("should parse channel", () => {
      const v = createMockVariable({
        kind: VariableKind.Chan,
        type: "chan int",
        len: 2,
        cap: 10,
      });
      const result = variableApi.parseVariableValue(v) as { type: string; len: number; cap: number };
      expect(result.type).toBe("chan int");
      expect(result.len).toBe(2);
      expect(result.cap).toBe(10);
    });

    it("should parse function", () => {
      const v = createMockVariable({
        kind: VariableKind.Func,
        type: "func()",
        value: "main.main",
      });
      const result = variableApi.parseVariableValue(v) as { type: string; value: string };
      expect(result.type).toBe("func()");
      expect(result.value).toBe("main.main");
    });

    it("should parse unsafe pointer", () => {
      const v = createMockVariable({
        kind: VariableKind.UnsafePointer,
        addr: 0x1000,
      });
      const result = variableApi.parseVariableValue(v) as { address: number };
      expect(result.address).toBe(0x1000);
    });

    it("should return value for unknown kind", () => {
      const v = createMockVariable({ kind: 99 as VariableKind, value: "unknown" });
      const result = variableApi.parseVariableValue(v);
      expect(result).toBe("unknown");
    });
  });

  describe("isNil", () => {
    it("should return true for nil value", () => {
      const v = createMockVariable({ value: "nil" });
      expect(variableApi.isNil(v)).toBe(true);
    });

    it("should return false for non-nil value", () => {
      const v = createMockVariable({ value: "42" });
      expect(variableApi.isNil(v)).toBe(false);
    });
  });

  describe("isPrimitive", () => {
    it("should return true for primitive kind", () => {
      const v = createMockVariable({ kind: VariableKind.Int });
      expect(variableApi.isPrimitive(v)).toBe(true);
    });

    it("should return false for composite kind", () => {
      const v = createMockVariable({ kind: VariableKind.Struct });
      expect(variableApi.isPrimitive(v)).toBe(false);
    });
  });

  describe("formatVariable", () => {
    it("should format nil variable", () => {
      const v = createMockVariable({ value: "nil", type: "*int" });
      const result = variableApi.formatVariable(v);
      expect(result).toBe("*int: nil");
    });

    it("should format unreadable variable", () => {
      const v = createMockVariable({ unreadable: "error", type: "int" });
      const result = variableApi.formatVariable(v);
      expect(result).toBe("int: <unreadable: error>");
    });

    it("should format normal variable", () => {
      const v = createMockVariable({ value: "42", type: "int" });
      const result = variableApi.formatVariable(v);
      expect(result).toBe("int: 42");
    });
  });

  describe("createEvalScope", () => {
    it("should create eval scope with defaults", () => {
      const scope = variableApi.createEvalScope(1);
      expect(scope).toEqual({ goroutineID: 1, frame: 0, deferredCall: 0 });
    });

    it("should create eval scope with custom values", () => {
      const scope = variableApi.createEvalScope(1, 2, 3);
      expect(scope).toEqual({ goroutineID: 1, frame: 2, deferredCall: 3 });
    });
  });

  describe("addDisplay", () => {
    it("should call RPCServer.Display to add", async () => {
      const display = { id: 1, expr: "x" };
      mockRpc.call.mockResolvedValue(display);

      const result = await variableApi.addDisplay(mockRpc.rpc, "x");

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Display", [{ expr: "x" }]);
      expect(result).toEqual(display);
    });
  });

  describe("removeDisplay", () => {
    it("should call RPCServer.Display to remove", async () => {
      mockRpc.call.mockResolvedValue(undefined);

      await variableApi.removeDisplay(mockRpc.rpc, 1);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Display", [
        { id: 1, delete: true },
      ]);
    });
  });

  describe("listDisplays", () => {
    it("should call RPCServer.Display to list", async () => {
      const displays = [{ id: 1, expr: "x" }];
      mockRpc.call.mockResolvedValue(displays);

      const result = await variableApi.listDisplays(mockRpc.rpc);

      expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.Display", [{}]);
      expect(result).toEqual(displays);
    });
  });
});
