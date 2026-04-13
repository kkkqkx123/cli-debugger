/**
 * Debug-related type definitions
 * These types are protocol-agnostic and represent common debugging concepts
 */

/** Thread information */
export interface ThreadInfo {
  id: string;
  name: string;
  state: string;
  status: string;
  isSuspended: boolean;
  isDaemon: boolean;
  priority: number;
  createdAt: Date;
}

/** Call stack frame */
export interface StackFrame {
  id: string;
  location: string;
  method: string;
  line: number;
  isNative: boolean;
}

/** Breakpoint information */
export interface BreakpointInfo {
  id: string;
  location: string;
  enabled: boolean;
  hitCount: number;
  condition?: string;
}

/** Variable information */
export interface Variable {
  name: string;
  type: string;
  value: unknown;
  isPrimitive: boolean;
  isNull: boolean;
}

/** Debug event */
export interface DebugEvent {
  type: string;
  threadId: string;
  location: string;
  timestamp: Date;
  data?: unknown;
}
