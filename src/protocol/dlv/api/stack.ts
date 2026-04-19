/**
 * Delve stack operations API
 */

import type { DlvRpcClient } from "../rpc.js";
import type {
  DlvStackFrame,
  DlvStacktraceParams,
  DlvLocation,
} from "../types.js";

/**
 * Get stacktrace for current goroutine
 */
export async function stacktrace(
  rpc: DlvRpcClient,
  depth = 50,
): Promise<DlvStackFrame[]> {
  return rpc.call<DlvStackFrame[]>("RPCServer.Stacktrace", [
    { depth, full: false },
  ]);
}

/**
 * Get stacktrace for specific goroutine
 */
export async function stacktraceGoroutine(
  rpc: DlvRpcClient,
  goroutineId: number,
  depth = 50,
): Promise<DlvStackFrame[]> {
  return rpc.call<DlvStackFrame[]>("RPCServer.Stacktrace", [
    { goroutineID: goroutineId, depth, full: false },
  ]);
}

/**
 * Get full stacktrace with variable info
 */
export async function stacktraceFull(
  rpc: DlvRpcClient,
  goroutineId?: number,
  depth = 50,
): Promise<DlvStackFrame[]> {
  const params: DlvStacktraceParams = {
    depth,
    full: true,
  };
  if (goroutineId !== undefined) {
    params.goroutineID = goroutineId;
  }
  return rpc.call<DlvStackFrame[]>("RPCServer.Stacktrace", [params]);
}

/**
 * Get stacktrace with deferred calls
 */
export async function stacktraceWithDefers(
  rpc: DlvRpcClient,
  goroutineId?: number,
  depth = 50,
): Promise<DlvStackFrame[]> {
  const params: DlvStacktraceParams = {
    depth,
    defers: true,
  };
  if (goroutineId !== undefined) {
    params.goroutineID = goroutineId;
  }
  return rpc.call<DlvStackFrame[]>("RPCServer.Stacktrace", [params]);
}

/**
 * Get stack frame count
 */
export async function getStackFrameCount(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<number> {
  // Get stacktrace with depth 0 to just count
  const frames = await stacktraceGoroutine(
    rpc,
    goroutineId ?? 0,
    1000,
  );
  return frames.length;
}

/**
 * Get frame at specific index
 */
export async function getFrame(
  rpc: DlvRpcClient,
  goroutineId: number,
  frameIndex: number,
): Promise<DlvStackFrame | null> {
  const frames = await stacktraceGoroutine(rpc, goroutineId, frameIndex + 1);
  return frames[frameIndex] ?? null;
}

/**
 * Get ancestor stacktrace (for debugging goroutine creation)
 */
export async function ancestorStacktrace(
  rpc: DlvRpcClient,
  goroutineId: number,
  ancestor: number,
  depth = 50,
): Promise<DlvStackFrame[]> {
  return rpc.call<DlvStackFrame[]>("RPCServer.Ancestors", [
    { goroutineID: goroutineId, ancestor, depth },
  ]);
}

/**
 * Get current location
 */
export async function currentLocation(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvLocation | null> {
  if (goroutineId !== undefined) {
    const frames = await stacktraceGoroutine(rpc, goroutineId, 1);
    const frame = frames[0];
    if (frame) {
      return {
        pc: frame.pc,
        file: frame.file,
        line: frame.line,
        function: frame.function,
      };
    }
    return null;
  }

  // Get from debugger state
  const state = await rpc.call<{
    currentGoroutine: { currentLoc: DlvLocation } | null;
  }>("RPCServer.State", [false]);

  return state.currentGoroutine?.currentLoc ?? null;
}

/**
 * Format stack frame for display
 */
export function formatStackFrame(frame: DlvStackFrame, index: number): string {
  const funcName = frame.function?.name ?? "???";
  return `${index}: ${funcName} at ${frame.file}:${frame.line}`;
}

/**
 * Format stacktrace for display
 */
export function formatStacktrace(frames: DlvStackFrame[]): string {
  return frames
    .map((frame, index) => formatStackFrame(frame, index))
    .join("\n");
}
