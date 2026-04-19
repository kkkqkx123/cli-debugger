/**
 * Delve stack operations API
 */

import type { DlvRpcClient } from "../rpc.js";
import type {
  DlvStackFrame,
  DlvStacktraceParams,
  DlvLocation,
  DlvDebuggerState,
  DlvDeferredCall,
} from "../types.js";

/**
 * Get stacktrace for current goroutine
 */
export async function stacktrace(
  rpc: DlvRpcClient,
  depth = 50,
): Promise<DlvStackFrame[]> {
  const result = await rpc.call<{ Frames: DlvStackFrame[] }>("RPCServer.Stacktrace", [
    { depth, full: false },
  ]);
  return result.Frames;
}

/**
 * Get stacktrace for specific goroutine
 */
export async function stacktraceGoroutine(
  rpc: DlvRpcClient,
  goroutineId: number,
  depth = 50,
): Promise<DlvStackFrame[]> {
  const result = await rpc.call<{ Frames: DlvStackFrame[] }>("RPCServer.Stacktrace", [
    { goroutineID: goroutineId, depth, full: false },
  ]);
  return result.Frames;
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
  const result = await rpc.call<{ Frames: DlvStackFrame[] }>("RPCServer.Stacktrace", [params]);
  return result.Frames;
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
  const result = await rpc.call<{ Frames: DlvStackFrame[] }>("RPCServer.Stacktrace", [params]);
  return result.Frames;
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
  const result = await rpc.call<{ Frames: DlvStackFrame[] }>("RPCServer.Ancestors", [
    { goroutineID: goroutineId, ancestor, depth },
  ]);
  return result.Frames;
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

// ==================== Frame Navigation ====================

/**
 * Move up in the call stack (towards caller)
 */
export async function frameUp(
  rpc: DlvRpcClient,
  goroutineId: number,
  currentFrame: number,
  steps = 1,
): Promise<{ frame: DlvStackFrame; index: number } | null> {
  const newIndex = currentFrame + steps;
  const frames = await stacktraceGoroutine(rpc, goroutineId, newIndex + 1);
  const frame = frames[newIndex];
  if (!frame) {
    return null;
  }
  return { frame, index: newIndex };
}

/**
 * Move down in the call stack (towards callee)
 */
export async function frameDown(
  rpc: DlvRpcClient,
  goroutineId: number,
  currentFrame: number,
  steps = 1,
): Promise<{ frame: DlvStackFrame; index: number } | null> {
  const newIndex = currentFrame - steps;
  if (newIndex < 0) {
    return null;
  }
  const frames = await stacktraceGoroutine(rpc, goroutineId, currentFrame + 1);
  const frame = frames[newIndex];
  if (!frame) {
    return null;
  }
  return { frame, index: newIndex };
}

/**
 * Set current frame for subsequent operations
 */
export async function setFrame(
  rpc: DlvRpcClient,
  goroutineId: number,
  frameIndex: number,
): Promise<DlvDebuggerState> {
  return rpc.call<DlvDebuggerState>("RPCServer.Frame", [
    { goroutineID: goroutineId, frame: frameIndex },
  ]);
}

// ==================== Deferred Calls ====================

/**
 * List deferred calls in current frame
 */
export async function listDeferredCalls(
  rpc: DlvRpcClient,
  goroutineId: number,
  frameIndex: number,
): Promise<DlvDeferredCall[]> {
  const frames = await stacktraceWithDefers(rpc, goroutineId, frameIndex + 1);
  const frame = frames[frameIndex];
  if (!frame || !frame.defers) {
    return [];
  }
  return frame.defers.map((d, i) => ({
    index: i,
    function: d.function,
    location: d.location,
    unreadable: d.unreadable ?? "",
  }));
}
