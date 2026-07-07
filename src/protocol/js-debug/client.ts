/**
 * js-debug (JavaScript/TypeScript Debug Adapter) Client - Stub Implementation
 *
 * js-debug is the JavaScript/TypeScript debug adapter for VSCode's DAP.
 * This is a placeholder implementation. Full integration requires spawning
 * a Node.js process with --inspect or connecting to a js-debug adapter.
 */

import type { DebugProtocol } from "../base.js";
import type { DebugConfig } from "../../types/config.js";
import { DebugConfigSchema } from "../../types/config.js";
import type { VersionInfo, Capabilities } from "../../types/metadata.js";
import type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from "../../types/debug.js";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";

/**
 * JsDebug Client - Placeholder implementation
 */
export class JsDebugClient implements DebugProtocol {
  private config: DebugConfig;
  private connected = false;

  constructor(config: DebugConfig) {
    this.config = DebugConfigSchema.parse(config);
  }

  // ==================== Lifecycle ====================

  async connect(): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "js-debug backend is not fully implemented yet. " +
      "This is a placeholder for JavaScript/TypeScript DAP support. " +
      "Expected implementation: spawn Node.js --inspect process or connect to js-debug adapter.",
    );
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ==================== Metadata ====================

  protocolName(): string {
    return "js-debug";
  }

  supportedLanguages(): string[] {
    return ["javascript", "typescript"];
  }

  async version(): Promise<VersionInfo> {
    return {
      protocolVersion: "0.1.0",
      runtimeVersion: "N/A",
      runtimeName: "node",
      description: "js-debug (JavaScript/TypeScript DAP) - placeholder",
    };
  }

  async capabilities(): Promise<Capabilities> {
    return {
      supportsVersion: true,
      supportsThreads: false,
      supportsStack: false,
      supportsLocals: false,
      supportsBreakpoints: false,
      supportsSuspend: false,
      supportsResume: false,
      supportsStep: false,
      supportsCont: false,
      supportsNext: false,
      supportsFinish: false,
      supportsEvents: false,
      supportsWatchMode: false,
      supportsStreaming: false,
    };
  }

  // ==================== Thread Management ====================

  async threads(): Promise<ThreadInfo[]> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async stack(_threadId: string): Promise<StackFrame[]> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async threadState(_threadId: string): Promise<string> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  // ==================== Execution Control ====================

  async suspend(_threadId?: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async resume(_threadId?: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async stepInto(_threadId: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async stepOver(_threadId: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async stepOut(_threadId: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(
    _location: string,
    _condition?: string,
    _type?: "line" | "method-entry" | "method-exit" | "exception" | "field-access" | "field-modify" | "class-load" | "class-unload" | "thread-start" | "thread-death",
  ): Promise<string> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async removeBreakpoint(_id: string): Promise<void> {
    // No-op for placeholder
  }

  async clearBreakpoints(): Promise<void> {
    // No-op for placeholder
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    return [];
  }

  // ==================== Variable Inspection ====================

  async locals(_threadId: string, _frameIndex: number): Promise<Variable[]> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async fields(_objectId: string): Promise<Variable[]> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  async setField(_objectId: string, _fieldId: string, _value: unknown): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to js-debug backend",
    );
  }

  // ==================== Event Handling ====================

  async waitForEvent(_timeout?: number): Promise<DebugEvent | null> {
    return null;
  }
}