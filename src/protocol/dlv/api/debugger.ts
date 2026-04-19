/**
 * Delve debugger state and control API
 */

import type { DlvRpcClient } from "../rpc.js";
import type {
  DlvDebuggerState,
  DlvCommandResult,
  DlvCommandParams,
  DlvVersion,
  DlvThread,
} from "../types.js";

/**
 * Get debugger version
 */
export async function getVersion(
  rpc: DlvRpcClient,
): Promise<DlvVersion> {
  return rpc.call<DlvVersion>("RPCServer.Version", []);
}

/**
 * Get current debugger state
 */
export async function getState(rpc: DlvRpcClient): Promise<DlvDebuggerState> {
  return rpc.call<DlvDebuggerState>("RPCServer.State", [false]);
}

/**
 * Get current debugger state with next pending
 */
export async function getStateWithNext(
  rpc: DlvRpcClient,
): Promise<DlvDebuggerState> {
  return rpc.call<DlvDebuggerState>("RPCServer.State", [true]);
}

/**
 * Send execution command
 */
export async function command(
  rpc: DlvRpcClient,
  params: DlvCommandParams,
): Promise<DlvCommandResult> {
  return rpc.call<DlvCommandResult>("RPCServer.Command", [params]);
}

/**
 * Continue execution
 */
export async function continueExecution(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "continue",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}

/**
 * Step to next line (step over)
 */
export async function next(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "next",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}

/**
 * Step into function
 */
export async function step(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "step",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}

/**
 * Step out of function
 */
export async function stepOut(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "stepout",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}

/**
 * Halt execution
 */
export async function halt(rpc: DlvRpcClient): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "halt",
  };
  return command(rpc, params);
}

/**
 * Switch to goroutine
 */
export async function switchGoroutine(
  rpc: DlvRpcClient,
  goroutineId: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "switchGoroutine",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}

/**
 * Switch to thread
 */
export async function switchThread(
  rpc: DlvRpcClient,
  threadId: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "switchThread",
    threadID: threadId,
  };
  return command(rpc, params);
}

/**
 * Rewind (reverse continue) - requires recording mode
 */
export async function rewind(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "rewind",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}

/**
 * Call function (experimental)
 */
export async function callFunction(
  rpc: DlvRpcClient,
  expr: string,
  goroutineId?: number,
  unsafe = false,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "call",
    expr,
    goroutineID: goroutineId,
    unsafeCall: unsafe,
  };
  return command(rpc, params);
}

/**
 * List threads
 */
export async function listThreads(rpc: DlvRpcClient): Promise<DlvThread[]> {
  return rpc.call<DlvThread[]>("RPCServer.ListThreads", []);
}

/**
 * Get thread by ID
 */
export async function getThread(
  rpc: DlvRpcClient,
  threadId: number,
): Promise<DlvThread> {
  return rpc.call<DlvThread>("RPCServer.GetThread", [{ id: threadId }]);
}

/**
 * Restart process
 */
export async function restart(
  rpc: DlvRpcClient,
  position?: string,
  resetArgs = false,
  newArgs?: string[],
): Promise<DlvDebuggerState> {
  return rpc.call<DlvDebuggerState>("RPCServer.Restart", [
    { position, resetArgs, newArgs },
  ]);
}

/**
 * Detach from process
 */
export async function detach(
  rpc: DlvRpcClient,
  kill = true,
): Promise<void> {
  await rpc.call("RPCServer.Detach", [{ kill }]);
}
