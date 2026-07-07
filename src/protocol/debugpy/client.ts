/**
 * DebugPy Client (Stub Implementation)
 *
 * DebugPy is the Python debug adapter for DAP (Debug Adapter Protocol).
 * This is a placeholder implementation. Full integration requires spawning
 * a debugpy process or connecting to an existing debugpy adapter.
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
 * DebugPy Client - Placeholder implementation
 */
export class DebugPyClient implements DebugProtocol {
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
      "DebugPy backend is not fully implemented yet. " +
      "This is a placeholder for Python (debugpy) DAP support. " +
      "Expected implementation: spawn debugpy process or connect to debugpy TCP adapter.",
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
    return "debugpy";
  }

  supportedLanguages(): string[] {
    return ["python"];
  }

  async version(): Promise<VersionInfo> {
    return {
      protocolVersion: "0.1.0",
      runtimeVersion: "N/A",
      runtimeName: "python",
      description: "DebugPy (Python DAP) - placeholder",
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
      "Not connected to debugpy backend",
    );
  }

  async stack(_threadId: string): Promise<StackFrame[]> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  async threadState(_threadId: string): Promise<string> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  // ==================== Execution Control ====================

  async suspend(_threadId?: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  async resume(_threadId?: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  async stepInto(_threadId: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  async stepOver(_threadId: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  async stepOut(_threadId: string): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
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
      "Not connected to debugpy backend",
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
      "Not connected to debugpy backend",
    );
  }

  async fields(_objectId: string): Promise<Variable[]> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  async setField(_objectId: string, _fieldId: string, _value: unknown): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "Not connected to debugpy backend",
    );
  }

  // ==================== Event Handling ====================

  async waitForEvent(_timeout?: number): Promise<DebugEvent | null> {
    return null;
  }
}