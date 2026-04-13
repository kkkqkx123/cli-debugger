/**
 * DebugProtocol interface definition
 */

import type { DebugConfig } from '../types/config.js';
import type {
  VersionInfo,
  Capabilities,
} from '../types/metadata.js';
import type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from '../types/debug.js';

/**
 * Unified debugging protocol interface
 * All language plugins must implement this interface
 */
export interface DebugProtocol {
  // Lifecycle management
  connect(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;

  // Metadata
  version(): Promise<VersionInfo>;
  capabilities(): Promise<Capabilities>;
  protocolName(): string;
  supportedLanguages(): string[];

  // Thread management
  threads(): Promise<ThreadInfo[]>;
  stack(threadId: string): Promise<StackFrame[]>;
  threadState(threadId: string): Promise<string>;

  // Execution control
  suspend(threadId?: string): Promise<void>;
  resume(threadId?: string): Promise<void>;
  stepInto(threadId: string): Promise<void>;
  stepOver(threadId: string): Promise<void>;
  stepOut(threadId: string): Promise<void>;

  // Breakpoint management
  setBreakpoint(location: string, condition?: string): Promise<string>;
  removeBreakpoint(id: string): Promise<void>;
  clearBreakpoints(): Promise<void>;
  breakpoints(): Promise<BreakpointInfo[]>;

  // Variable inspection
  locals(threadId: string, frameIndex: number): Promise<Variable[]>;
  fields(objectId: string): Promise<Variable[]>;

  // Event handling
  waitForEvent(timeout?: number): Promise<DebugEvent | null>;
}

/** Plugin factory function type */
export type ProtocolFactory = (config: DebugConfig) => DebugProtocol;
