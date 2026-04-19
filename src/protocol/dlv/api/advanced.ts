/**
 * Delve advanced features API
 */

import type { DlvRpcClient } from "../rpc.js";
import type { DlvCheckpoint } from "../types.js";

// ==================== Checkpoints ====================

export async function createCheckpoint(
  rpc: DlvRpcClient,
  note?: string,
): Promise<DlvCheckpoint> {
  return rpc.call<DlvCheckpoint>("RPCServer.Checkpoint", [{ note }]);
}

export async function listCheckpoints(
  rpc: DlvRpcClient,
): Promise<DlvCheckpoint[]> {
  return rpc.call<DlvCheckpoint[]>("RPCServer.ListCheckpoints", []);
}

export async function clearCheckpoint(
  rpc: DlvRpcClient,
  id: number,
): Promise<void> {
  await rpc.call("RPCServer.ClearCheckpoint", [{ id }]);
}

// ==================== Configuration ====================

export interface DlvDebuggerConfig {
  showLocationRegex: boolean;
  substitutePathRules: Array<{ from: string; to: string }>;
  debugInfoDirectories: string[];
  maxStringLen: number;
  maxArrayValues: number;
  maxVariableRecurse: number;
  maxStructFields: number;
}

export async function getConfig(
  rpc: DlvRpcClient,
): Promise<DlvDebuggerConfig> {
  return rpc.call<DlvDebuggerConfig>("RPCServer.GetConfig", []);
}

export async function setConfig(
  rpc: DlvRpcClient,
  config: Partial<DlvDebuggerConfig>,
): Promise<void> {
  await rpc.call("RPCServer.SetConfig", [config]);
}

export async function addSubstitutePath(
  rpc: DlvRpcClient,
  from: string,
  to: string,
): Promise<void> {
  await rpc.call("RPCServer.AddSubstitutePath", [{ from, to }]);
}

export async function removeSubstitutePath(
  rpc: DlvRpcClient,
  from: string,
): Promise<void> {
  await rpc.call("RPCServer.RemoveSubstitutePath", [{ from }]);
}

// ==================== Core Dump ====================

export async function dumpCore(
  rpc: DlvRpcClient,
  outputPath: string,
): Promise<void> {
  await rpc.call("RPCServer.Dump", [{ dest: outputPath }]);
}

// ==================== Rebuild ====================

export async function rebuild(rpc: DlvRpcClient): Promise<void> {
  await rpc.call("RPCServer.Rebuild", []);
}

// ==================== Target Process ====================

export interface DlvTarget {
  pid: number;
  cmd: string[];
}

export async function getTarget(rpc: DlvRpcClient): Promise<DlvTarget> {
  return rpc.call<DlvTarget>("RPCServer.GetTarget", []);
}
