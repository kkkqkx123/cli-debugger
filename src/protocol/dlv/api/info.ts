/**
 * Delve information query API
 */

import type { DlvRpcClient } from "../rpc.js";

// ==================== Function List ====================

export interface DlvFunctionInfo {
  name: string;
  type: number;
  value: number;
  goType: number;
}

export async function listFunctions(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  // Delve returns an array of function names directly, not objects
  const result = await rpc.call<{ Funcs: string[] } | string[]>("RPCServer.ListFunctions", [
    { filter },
  ]);
  // Handle both direct array and wrapped return
  if (Array.isArray(result)) {
    return result;
  }
  return result.Funcs || [];
}

// ==================== Package List ====================

export async function listPackages(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  const result = await rpc.call<{ Packages: string[] }>("RPCServer.ListPackages", [{ filter }]);
  return result.Packages;
}

// ==================== Source File List ====================

export async function listSources(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  const result = await rpc.call<{ Sources: string[] }>("RPCServer.ListSources", [{ filter }]);
  return result.Sources;
}

// ==================== Type List ====================

export interface DlvTypeInfo {
  name: string;
  size: number;
  kind: number;
}

export async function listTypes(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<DlvTypeInfo[]> {
  const result = await rpc.call<{ Types: DlvTypeInfo[] }>("RPCServer.ListTypes", [{ filter }]);
  return result.Types;
}

// ==================== Dynamic Libraries ====================

export interface DlvLibrary {
  path: string;
  address: number;
  loaded: boolean;
}

export async function listLibraries(rpc: DlvRpcClient): Promise<DlvLibrary[]> {
  const result = await rpc.call<{ Libraries: DlvLibrary[] }>("RPCServer.ListDynamicLibraries", []);
  return result.Libraries;
}

// ==================== Source Code ====================

export interface DlvSourceLocation {
  file: string;
  line: number;
  content: string[];
  locs: Array<{
    pc: number;
    file: string;
    line: number;
    function: { name: string } | null;
  }>;
}

export async function listSource(
  rpc: DlvRpcClient,
  locspec?: string,
): Promise<DlvSourceLocation> {
  return rpc.call<DlvSourceLocation>("RPCServer.List", [
    { loc: locspec ?? "" },
  ]);
}
