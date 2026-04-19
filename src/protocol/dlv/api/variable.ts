/**
 * Delve variable inspection API
 */

import type { DlvRpcClient } from "../rpc.js";
import type {
  DlvVariable,
  DlvEvalParams,
  DlvEvalScope,
  DlvLoadConfig,
  DlvDisplay,
} from "../types.js";
import { getDefaultLoadConfig, isPrimitiveKind } from "../types.js";

/**
 * List local variables
 */
export async function listLocalVars(
  rpc: DlvRpcClient,
  scope: DlvEvalScope,
  cfg?: DlvLoadConfig,
): Promise<DlvVariable[]> {
  const result = await rpc.call<{ Variables: DlvVariable[] }>("RPCServer.ListLocalVars", [
    { scope, cfg: cfg ?? getDefaultLoadConfig() },
  ]);
  return result.Variables;
}

/**
 * List function arguments
 */
export async function listFunctionArgs(
  rpc: DlvRpcClient,
  scope: DlvEvalScope,
  cfg?: DlvLoadConfig,
): Promise<DlvVariable[]> {
  const result = await rpc.call<{ Args: DlvVariable[] }>("RPCServer.ListFunctionArgs", [
    { scope, cfg: cfg ?? getDefaultLoadConfig() },
  ]);
  return result.Args;
}

/**
 * List package variables
 */
export async function listPackageVars(
  rpc: DlvRpcClient,
  filter?: string,
  cfg?: DlvLoadConfig,
): Promise<DlvVariable[]> {
  const result = await rpc.call<{ Variables: DlvVariable[] }>("RPCServer.ListPackageVars", [
    { filter, cfg: cfg ?? getDefaultLoadConfig() },
  ]);
  return result.Variables;
}

/**
 * List package constants
 */
export async function listPackageConstants(
  rpc: DlvRpcClient,
  filter?: string,
  cfg?: DlvLoadConfig,
): Promise<DlvVariable[]> {
  const result = await rpc.call<{ Variables: DlvVariable[] }>("RPCServer.ListPackageVars", [
    { filter, cfg: cfg ?? getDefaultLoadConfig(), includeConstants: true },
  ]);
  return result.Variables;
}

/**
 * Evaluate expression
 */
export async function evalExpr(
  rpc: DlvRpcClient,
  expr: string,
  scope?: DlvEvalScope,
  cfg?: DlvConfig,
): Promise<DlvVariable> {
  const params: DlvEvalParams = {
    expr,
    cfg: cfg ?? getDefaultLoadConfig(),
  };
  if (scope) {
    params.scope = scope;
  }
  return rpc.call<DlvVariable>("RPCServer.Eval", [params]);
}

/**
 * Evaluate expression with specific return type
 */
export async function evalExprTyped<T>(
  rpc: DlvRpcClient,
  expr: string,
  scope?: DlvEvalScope,
): Promise<T> {
  const result = await evalExpr(rpc, expr, scope);
  return parseVariableValue(result) as T;
}

/**
 * Set variable value
 */
export async function setVar(
  rpc: DlvRpcClient,
  scope: DlvEvalScope,
  name: string,
  value: string,
): Promise<void> {
  await rpc.call("RPCServer.Set", [{ scope, name, value }]);
}

/**
 * Get variable type information
 */
export async function getType(
  rpc: DlvRpcClient,
  expr: string,
  scope?: DlvEvalScope,
): Promise<string> {
  const result = await evalExpr(rpc, expr, scope);
  return result.type;
}

/**
 * Disassemble code
 */
export async function disassemble(
  rpc: DlvRpcClient,
  scope: DlvEvalScope,
  startPC?: number,
  endPC?: number,
): Promise<DlvDisassembleResult> {
  return rpc.call<DlvDisassembleResult>("RPCServer.Disassemble", [
    { scope, startPC, endPC },
  ]);
}

/**
 * Examine memory
 */
export async function examineMemory(
  rpc: DlvRpcClient,
  address: number,
  length: number,
): Promise<DlvMemoryResult> {
  return rpc.call<DlvMemoryResult>("RPCServer.ExamineMemory", [
    { address, length },
  ]);
}

/**
 * Get CPU registers
 */
export async function registers(
  rpc: DlvRpcClient,
  scope?: DlvEvalScope,
  includeFp = false,
): Promise<DlvRegister[]> {
  return rpc.call<DlvRegister[]>("RPCServer.Registers", [
    { scope, includeFp },
  ]);
}

// ==================== Helper Functions ====================

/**
 * Parse variable value to JavaScript type
 */
export function parseVariableValue(variable: DlvVariable): unknown {
  if (variable.unreadable) {
    return `<unreadable: ${variable.unreadable}>`;
  }

  const kind = variable.kind;

  switch (kind) {
    case 1: // Bool
      return variable.value === "true";
    case 2: // Int
      return parseInt(variable.value, 10);
    case 3: // Float
      return parseFloat(variable.value);
    case 4: // String
      return variable.value;
    case 11: // Complex
      return variable.value;
    case 8: // Pointer
      if (variable.value === "nil") {
        return null;
      }
      return {
        address: variable.addr,
        type: variable.type,
        value: variable.children.length > 0 ? variable.children : undefined,
      };
    case 5: // Array
    case 6: // Slice
      return variable.children.map(parseVariableValue);
    case 7: // Struct
      return variable.children.reduce(
        (obj, child) => {
          obj[child.name] = parseVariableValue(child);
          return obj;
        },
        {} as Record<string, unknown>,
      );
    case 9: // Interface
      if (variable.value === "nil") {
        return null;
      }
      return {
        type: variable.type,
        value: variable.children.length > 0
          ? parseVariableValue(variable.children[0]!)
          : variable.value,
      };
    case 10: // Map
      return variable.children.reduce(
        (map, pair) => {
          if (pair.children.length >= 2) {
            const key = parseVariableValue(pair.children[0]!);
            const value = parseVariableValue(pair.children[1]!);
            map.set(key, value);
          }
          return map;
        },
        new Map<unknown, unknown>(),
      );
    case 12: // Chan
      return {
        type: variable.type,
        len: variable.len,
        cap: variable.cap,
      };
    case 13: // Func
      return {
        type: variable.type,
        value: variable.value,
      };
    case 14: // UnsafePointer
      return {
        address: variable.addr,
      };
    default:
      return variable.value;
  }
}

/**
 * Check if variable is nil
 */
export function isNil(variable: DlvVariable): boolean {
  return variable.value === "nil";
}

/**
 * Check if variable is primitive
 */
export function isPrimitive(variable: DlvVariable): boolean {
  return isPrimitiveKind(variable.kind);
}

/**
 * Get variable display string
 */
export function formatVariable(variable: DlvVariable): string {
  const typePrefix = `${variable.type}: `;
  if (isNil(variable)) {
    return `${typePrefix}nil`;
  }
  if (variable.unreadable) {
    return `${typePrefix}<unreadable: ${variable.unreadable}>`;
  }
  return `${typePrefix}${variable.value}`;
}

/**
 * Create eval scope for goroutine and frame
 */
export function createEvalScope(
  goroutineId: number,
  frame = 0,
  deferredCall = 0,
): DlvEvalScope {
  return {
    goroutineID: goroutineId,
    frame,
    deferredCall,
  };
}

// ==================== Additional Types ====================

interface DlvConfig extends DlvLoadConfig {}

interface DlvDisassembleResult {
  Locs: DlvAssemblyLocation[];
}

interface DlvAssemblyLocation {
  PC: number;
  File: string;
  Line: number;
  Fn: { Name: string } | null;
  Instructions: DlvInstruction[];
}

interface DlvInstruction {
  Loc: DlvLocation;
  Destination: DlvLocation | null;
  Text: string;
  Bytes: number[];
}

interface DlvMemoryResult {
  Address: number;
  Memory: number[];
  IsLittleEndian: boolean;
}

export interface DlvRegister {
  Name: string;
  Value: string;
  DwarfNumber: number;
  PC: number;
}

interface DlvLocation {
  PC: number;
  File: string;
  Line: number;
}

// ==================== Display Expressions ====================

/**
 * Add display expression (auto-print on each stop)
 */
export async function addDisplay(
  rpc: DlvRpcClient,
  expr: string,
): Promise<DlvDisplay> {
  return rpc.call<DlvDisplay>("RPCServer.Display", [{ expr }]);
}

/**
 * Remove display expression
 */
export async function removeDisplay(
  rpc: DlvRpcClient,
  id: number,
): Promise<void> {
  await rpc.call("RPCServer.Display", [{ id, delete: true }]);
}

/**
 * List all display expressions
 */
export async function listDisplays(rpc: DlvRpcClient): Promise<DlvDisplay[]> {
  return rpc.call<DlvDisplay[]>("RPCServer.Display", [{}]);
}
