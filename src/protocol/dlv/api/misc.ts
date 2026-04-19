/**
 * Delve miscellaneous API
 * Target process, debug operations, and editor utilities
 */

import type { DlvRpcClient } from "../rpc.js";

// ==================== Target Process ====================

/**
 * Target process information
 */
export interface DlvTarget {
  pid: number;
  cmd: string[];
}

/**
 * Get information about the target process
 */
export async function getTarget(rpc: DlvRpcClient): Promise<DlvTarget> {
  return rpc.call<DlvTarget>("RPCServer.GetTarget", []);
}

// ==================== Debug Operations ====================

/**
 * Create a core dump of the target process
 */
export async function dumpCore(rpc: DlvRpcClient, outputPath: string): Promise<void> {
  await rpc.call("RPCServer.Dump", [{ dest: outputPath }]);
}

/**
 * Rebuild the target binary
 */
export async function rebuild(rpc: DlvRpcClient): Promise<void> {
  await rpc.call("RPCServer.Rebuild", []);
}

// ==================== Editor & Scripting ====================

/**
 * Open source file in external editor
 */
export async function editSource(
  rpc: DlvRpcClient,
  file: string,
  line?: number,
): Promise<void> {
  await rpc.call("RPCServer.Edit", [{ file, line }]);
}

/**
 * Execute commands from a script file
 */
export async function sourceScript(rpc: DlvRpcClient, path: string): Promise<void> {
  await rpc.call("RPCServer.Source", [{ path }]);
}

/**
 * Start or stop transcript recording
 */
export async function transcript(rpc: DlvRpcClient, path?: string): Promise<void> {
  await rpc.call("RPCServer.Transcript", [{ path }]);
}
