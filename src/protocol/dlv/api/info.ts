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
): Promise<DlvFunctionInfo[]> {
  return rpc.call<DlvFunctionInfo[]>("RPCServer.ListFunctions", [
    { filter },
  ]);
}

// ==================== Package List ====================

export async function listPackages(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  return rpc.call<string[]>("RPCServer.ListPackages", [{ filter }]);
}

// ==================== Source File List ====================

export async function listSources(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  return rpc.call<string[]>("RPCServer.ListSources", [{ filter }]);
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
  return rpc.call<DlvTypeInfo[]>("RPCServer.ListTypes", [{ filter }]);
}

// ==================== Dynamic Libraries ====================

export interface DlvLibrary {
  path: string;
  address: number;
  loaded: boolean;
}

export async function listLibraries(rpc: DlvRpcClient): Promise<DlvLibrary[]> {
  return rpc.call<DlvLibrary[]>("RPCServer.ListDynamicLibraries", []);
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
