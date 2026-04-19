/**
 * Delve checkpoint management API
 * Checkpoints allow saving and restoring debugger state
 */

import type { DlvRpcClient } from "../rpc.js";
import type { DlvCheckpoint } from "../types.js";

/**
 * Create a new checkpoint at current position
 * @param rpc - RPC client
 * @param note - Optional note for the checkpoint
 * @returns Created checkpoint information
 */
export async function createCheckpoint(
  rpc: DlvRpcClient,
  note?: string,
): Promise<DlvCheckpoint> {
  return rpc.call<DlvCheckpoint>("RPCServer.Checkpoint", [{ note }]);
}

/**
 * List all checkpoints
 * @param rpc - RPC client
 * @returns Array of checkpoint information
 */
export async function listCheckpoints(rpc: DlvRpcClient): Promise<DlvCheckpoint[]> {
  return rpc.call<DlvCheckpoint[]>("RPCServer.ListCheckpoints", []);
}

/**
 * Clear (delete) a checkpoint
 * @param rpc - RPC client
 * @param id - Checkpoint ID to clear
 */
export async function clearCheckpoint(rpc: DlvRpcClient, id: number): Promise<void> {
  await rpc.call("RPCServer.ClearCheckpoint", [{ id }]);
}
