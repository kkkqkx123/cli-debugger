/**
 * Delve breakpoint management API
 */

import type { DlvRpcClient } from "../rpc.js";
import type {
  DlvBreakpoint,
  DlvCreateBreakpointParams,
  DlvBreakPointInfo,
} from "../types.js";

/**
 * List all breakpoints
 */
export async function listBreakpoints(rpc: DlvRpcClient): Promise<DlvBreakpoint[]> {
  return rpc.call<DlvBreakpoint[]>("RPCServer.ListBreakpoints", []);
}

/**
 * Create a new breakpoint
 */
export async function createBreakpoint(
  rpc: DlvRpcClient,
  params: DlvCreateBreakpointParams,
): Promise<DlvBreakpoint> {
  return rpc.call<DlvBreakpoint>("RPCServer.CreateBreakpoint", [params]);
}

/**
 * Create breakpoint at file:line
 */
export async function createBreakpointAtLocation(
  rpc: DlvRpcClient,
  file: string,
  line: number,
  condition?: string,
): Promise<DlvBreakpoint> {
  const params: DlvCreateBreakpointParams = {
    file,
    line,
    Cond: condition ?? "",
  };
  return createBreakpoint(rpc, params);
}

/**
 * Create breakpoint at function
 */
export async function createBreakpointAtFunction(
  rpc: DlvRpcClient,
  functionName: string,
  condition?: string,
): Promise<DlvBreakpoint> {
  const params: DlvCreateBreakpointParams = {
    functionName,
    Cond: condition ?? "",
  };
  return createBreakpoint(rpc, params);
}

/**
 * Create breakpoint at address
 */
export async function createBreakpointAtAddress(
  rpc: DlvRpcClient,
  address: number,
  condition?: string,
): Promise<DlvBreakpoint> {
  const params: DlvCreateBreakpointParams = {
    addr: address,
    Cond: condition ?? "",
  };
  return createBreakpoint(rpc, params);
}

/**
 * Create tracepoint (non-stopping breakpoint)
 */
export async function createTracepoint(
  rpc: DlvRpcClient,
  file: string,
  line: number,
): Promise<DlvBreakpoint> {
  const params: DlvCreateBreakpointParams = {
    file,
    line,
    tracepoint: true,
  };
  return createBreakpoint(rpc, params);
}

/**
 * Clear (delete) a breakpoint
 */
export async function clearBreakpoint(
  rpc: DlvRpcClient,
  breakpointId: number,
): Promise<void> {
  await rpc.call("RPCServer.ClearBreakpoint", [{ id: breakpointId }]);
}

/**
 * Clear breakpoint by name
 */
export async function clearBreakpointByName(
  rpc: DlvRpcClient,
  name: string,
): Promise<void> {
  await rpc.call("RPCServer.ClearBreakpoint", [{ name }]);
}

/**
 * Amend (update) a breakpoint
 */
export async function amendBreakpoint(
  rpc: DlvRpcClient,
  breakpoint: DlvBreakpoint,
): Promise<DlvBreakpoint> {
  return rpc.call<DlvBreakpoint>("RPCServer.AmendBreakpoint", [breakpoint]);
}

/**
 * Toggle breakpoint enabled state
 */
export async function toggleBreakpoint(
  rpc: DlvRpcClient,
  breakpointId: number,
  disabled: boolean,
): Promise<DlvBreakpoint> {
  const breakpoints = await listBreakpoints(rpc);
  const bp = breakpoints.find((b) => b.id === breakpointId);
  if (!bp) {
    throw new Error(`Breakpoint ${breakpointId} not found`);
  }
  return amendBreakpoint(rpc, { ...bp, disabled });
}

/**
 * Set breakpoint condition
 */
export async function setBreakpointCondition(
  rpc: DlvRpcClient,
  breakpointId: number,
  condition: string,
): Promise<DlvBreakpoint> {
  const breakpoints = await listBreakpoints(rpc);
  const bp = breakpoints.find((b) => b.id === breakpointId);
  if (!bp) {
    throw new Error(`Breakpoint ${breakpointId} not found`);
  }
  return amendBreakpoint(rpc, { ...bp, Cond: condition });
}

/**
 * Set breakpoint hit count condition
 */
export async function setBreakpointHitCondition(
  rpc: DlvRpcClient,
  breakpointId: number,
  hitCondition: string,
): Promise<DlvBreakpoint> {
  // Delve uses Cond field for hit conditions with special syntax
  return setBreakpointCondition(rpc, breakpointId, hitCondition);
}

/**
 * Get breakpoint info (with goroutine and stacktrace)
 */
export async function getBreakpointInfo(
  rpc: DlvRpcClient,
  breakpointId: number,
): Promise<DlvBreakPointInfo> {
  return rpc.call<DlvBreakPointInfo>("RPCServer.GetBreakpoint", [
    { id: breakpointId },
  ]);
}

/**
 * Clear all breakpoints
 */
export async function clearAllBreakpoints(rpc: DlvRpcClient): Promise<void> {
  const breakpoints = await listBreakpoints(rpc);
  for (const bp of breakpoints) {
    // Skip internal breakpoints (negative IDs)
    if (bp.id >= 0) {
      await clearBreakpoint(rpc, bp.id);
    }
  }
}

/**
 * Create watchpoint
 */
export async function createWatchpoint(
  rpc: DlvRpcClient,
  expr: string,
  scope: { goroutineID: number; frame: number },
  watchType: "r" | "w" | "rw" = "w",
): Promise<DlvBreakpoint> {
  return rpc.call<DlvBreakpoint>("RPCServer.CreateWatchpoint", [
    { expr, scope, watchType },
  ]);
}
