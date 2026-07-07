/**
 * LLDB Client Implementation
 * Implements DebugProtocol interface for LLDB debugger
 */

import type { ExtendedDebugProtocol, EvalOptions, EvalResult, ExtendedBreakpointInfo, TypeInfo, SymbolInfo, TargetMetadata, ThreadBatchInfo, FeatureName } from "../extended.js";
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
import { LLDBBridge } from "./bridge.js";
import type {
  LLDBConfig,
  LLDBThreadInfo,
  LLDBStackFrame,
  LLDBVariable,
  LLDBBreakpoint,
  LLDBRegisterSet,
  LLDBExitInfo,
  LLDBEvalOptions,
  LLDBTargetInfo,
  LLDBTargetMetadata,
  LLDBModuleInfo,
  LLDBSymbolInfo,
  LLDBTypeInfo,
  LLDBThreadBatchInfo,
  LLDBProcessIOResult,
  LLDBBreakpointLocation,
} from "./types.js";

/**
 * LLDB Client
 * Implements ExtendedDebugProtocol for native debugging via LLDB
 */
export class LLDBClient implements ExtendedDebugProtocol {
  private config: LLDBConfig;
  private bridge: LLDBBridge;
  private connected = false;
  private breakpointMap = new Map<string, LLDBBreakpoint>();

  constructor(config: DebugConfig) {
    // Extract extra fields before validation
    const extraConfig = config as Record<string, unknown>;
    const target = extraConfig["target"] as string | undefined;

    if (!target) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "LLDB requires 'target' configuration",
        { protocol: config.protocol },
      );
    }

    // Validate base configuration
    const validatedConfig = DebugConfigSchema.parse(config);
    // Validate and cast to LLDB-specific config
    this.config = this.validateLLDBConfig(validatedConfig, extraConfig);
    this.bridge = new LLDBBridge({
      pythonPath: this.config.pythonPath,
      timeout: this.config.timeout,
    });
  }

  /**
   * Validate LLDB-specific config
   */
  private validateLLDBConfig(config: DebugConfig, extra: Record<string, unknown>): LLDBConfig {
    if (config.protocol !== "lldb") {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Expected protocol 'lldb', got '${config.protocol}'`,
        { protocol: config.protocol },
      );
    }

    const target = extra["target"] as string | undefined;
    if (!target) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "LLDB requires 'target' configuration",
        { protocol: config.protocol },
      );
    }

    // Build LLDBConfig with defaults
    return {
      protocol: "lldb",
      target: target,
      coreFile: extra["coreFile"] as string | undefined,
      pythonPath: extra["pythonPath"] as string | undefined,
      attachPid: extra["attachPid"] as number | undefined,
      waitFor: (extra["waitFor"] as boolean) ?? false,
      timeout: config.timeout,
      launchArgs: extra["launchArgs"] as string[] | undefined,
      env: extra["env"] as Record<string, string> | undefined,
      workingDir: extra["workingDir"] as string | undefined,
      stopAtEntry: (extra["stopAtEntry"] as boolean) ?? false,
    };
  }

  // ==================== Lifecycle ====================

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Start Python bridge
    await this.bridge.start();

    // Connect to target
    const result = await this.bridge.call<{ success: boolean; targetId: string }>(
      "connect",
      {
        target: this.config.target,
        coreFile: this.config.coreFile,
        attachPid: this.config.attachPid,
        waitFor: this.config.waitFor,
      },
    );

    if (!result.success) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionFailed,
        "Failed to connect to LLDB target",
      );
    }

    // Launch if not attaching to existing process
    if (!this.config.coreFile && !this.config.attachPid && !this.config.waitFor) {
      await this.bridge.call("launch", {
        args: this.config.launchArgs ?? [],
        env: this.config.env,
        stopAtEntry: this.config.stopAtEntry,
        workingDir: this.config.workingDir,
      });
    }

    this.connected = true;
  }

  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.breakpointMap.clear();
    await this.bridge.stop();
  }

  isConnected(): boolean {
    return this.connected && this.bridge.isRunning();
  }

  // ==================== Metadata ====================

  protocolName(): string {
    return "lldb";
  }

  supportedLanguages(): string[] {
    return ["c", "cpp", "objc", "swift", "rust"];
  }

  async version(): Promise<VersionInfo> {
    this.ensureConnected();

    const result = await this.bridge.call<{
      lldbVersion: string;
      pythonVersion: string;
    }>("version", {});

    return {
      protocolVersion: "1.0",
      runtimeVersion: result.lldbVersion,
      runtimeName: "lldb",
      description: `LLDB ${result.lldbVersion} (Python ${result.pythonVersion})`,
    };
  }

  async capabilities(): Promise<Capabilities> {
    return {
      supportsVersion: true,
      supportsThreads: true,
      supportsStack: true,
      supportsLocals: true,
      supportsBreakpoints: true,
      supportsSuspend: true,
      supportsResume: true,
      supportsStep: true,
      supportsCont: true,
      supportsNext: true,
      supportsFinish: true,
      supportsEvents: true,
      supportsWatchMode: false,
      supportsStreaming: false,
    };
  }

  // ==================== Thread Management ====================

  async threads(): Promise<ThreadInfo[]> {
    this.ensureConnected();

    const lldbThreads = await this.bridge.call<LLDBThreadInfo[]>("threads", {});

    return lldbThreads.map((t) => this.lldbThreadToThreadInfo(t));
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    this.ensureConnected();

    const frames = await this.bridge.call<LLDBStackFrame[]>("stack", {
      threadId: parseInt(threadId, 10),
      depth: 50,
    });

    return frames.map((f) => this.lldbFrameToStackFrame(f));
  }

  async threadState(threadId: string): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<{ state: string }>("threadState", {
      threadId: parseInt(threadId, 10),
    });

    return result.state;
  }

  // ==================== Execution Control ====================

  async suspend(threadId?: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("suspend", {
      threadId: threadId ? parseInt(threadId, 10) : undefined,
    });
  }

  async resume(threadId?: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("resume", {
      threadId: threadId ? parseInt(threadId, 10) : undefined,
    });
  }

  async stepInto(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("stepInto", { threadId: parseInt(threadId, 10) });
  }

  async stepOver(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("stepOver", { threadId: parseInt(threadId, 10) });
  }

  async stepOut(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("stepOut", { threadId: parseInt(threadId, 10) });
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(
    location: string,
    condition?: string,
    _type?:
      | "line"
      | "method-entry"
      | "method-exit"
      | "exception"
      | "field-access"
      | "field-modify"
      | "class-load"
      | "class-unload"
      | "thread-start"
      | "thread-death",
  ): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBBreakpoint>("setBreakpoint", {
      location,
      condition,
    });

    this.breakpointMap.set(result.id, result);
    return result.id;
  }

  /**
   * Set breakpoint at a specific address
   */
  async setBreakpointAtAddress(
    address: number,
    condition?: string,
  ): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBBreakpoint>("setBreakpoint", {
      address,
      condition,
    });

    this.breakpointMap.set(result.id, result);
    return result.id;
  }

  /**
   * Set breakpoint by source regex
   */
  async setBreakpointByRegex(
    regex: string,
    sourceFile: string,
    condition?: string,
  ): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBBreakpoint>("setBreakpoint", {
      sourceRegex: regex,
      sourceFile,
      condition,
    });

    this.breakpointMap.set(result.id, result);
    return result.id;
  }

  async removeBreakpoint(id: string): Promise<void> {
    this.ensureConnected();

    await this.bridge.call("removeBreakpoint", { id });
    this.breakpointMap.delete(id);
  }

  async clearBreakpoints(): Promise<void> {
    this.ensureConnected();

    await this.bridge.call("clearBreakpoints", {});
    this.breakpointMap.clear();
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    this.ensureConnected();

    const bps = await this.bridge.call<LLDBBreakpoint[]>("breakpoints", {});

    return bps.map((bp) => ({
      id: bp.id,
      location: bp.locations[0] ?? "<unknown>",
      enabled: bp.enabled,
      hitCount: bp.hitCount,
      condition: bp.condition ?? undefined,
    }));
  }

  /**
   * Enable a breakpoint
   */
  async enableBreakpoint(id: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("enableBreakpoint", { id });
  }

  /**
   * Disable a breakpoint
   */
  async disableBreakpoint(id: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("disableBreakpoint", { id });
  }

  // ==================== Variable Inspection ====================

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    this.ensureConnected();

    const vars = await this.bridge.call<LLDBVariable[]>("locals", {
      threadId: parseInt(threadId, 10),
      frameIndex,
    });

    return vars.map((v) => this.lldbVariableToVariable(v));
  }

  async fields(objectId: string): Promise<Variable[]> {
    this.ensureConnected();

    // objectId format: "threadId:frameIndex:varName"
    const parts = objectId.split(":");
    if (parts.length < 3) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "Invalid objectId format. Expected 'threadId:frameIndex:varName'",
      );
    }

    const threadId = parseInt(parts[0]!, 10);
    const frameIndex = parseInt(parts[1]!, 10);
    const varName = parts.slice(2).join(":");

    const fields = await this.bridge.call<LLDBVariable[]>("fields", {
      threadId,
      frameIndex,
      varName,
    });

    return fields.map((v) => this.lldbVariableToVariable(v));
  }

  async setField(
    objectId: string,
    fieldId: string,
    value: unknown,
  ): Promise<void> {
    this.ensureConnected();

    // Construct expression to set the field
    const parts = objectId.split(":");
    if (parts.length < 3) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "Invalid objectId format",
      );
    }

    const threadId = parseInt(parts[0]!, 10);
    const frameIndex = parseInt(parts[1]!, 10);
    const varName = parts.slice(2).join(":");
    const expression = `${varName}.${fieldId} = ${JSON.stringify(value)}`;

    await this.bridge.call("eval", {
      expression,
      threadId,
      frameIndex,
    });
  }

  // ==================== Event Handling ====================

  async waitForEvent(timeout?: number): Promise<DebugEvent | null> {
    this.ensureConnected();

    const event = await this.bridge.call<{
      type: string;
      state: string;
      description: string;
    } | null>(
      "waitForEvent",
      { timeout: (timeout ?? this.config.timeout) / 1000 }, // Convert to seconds
    );

    if (!event) {
      return null;
    }

    // Get current thread info
    const threads = await this.threads();
    const currentThread = threads.find((t) => t.state === "stopped");

    return {
      type: this.mapEventType(event.type),
      threadId: currentThread?.id ?? "",
      location: currentThread?.name ?? "",
      timestamp: new Date(),
      data: {
        state: event.state,
        description: event.description,
      },
    };
  }

  // ==================== Extended Methods ====================

  /**
   * Get register sets for a frame
   */
  async registers(
    threadId: string,
    frameIndex: number,
  ): Promise<LLDBRegisterSet[]> {
    this.ensureConnected();

    return await this.bridge.call<LLDBRegisterSet[]>("registers", {
      threadId: parseInt(threadId, 10),
      frameIndex,
    });
  }

  /**
   * Get the currently selected thread
   */
  async getSelectedThread(): Promise<ThreadInfo> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBThreadInfo>(
      "getSelectedThread",
      {},
    );

    return this.lldbThreadToThreadInfo(result);
  }

  /**
   * Set the selected thread
   */
  async setSelectedThread(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("setSelectedThread", {
      threadId: parseInt(threadId, 10),
    });
  }

  /**
   * Get the currently selected frame for a thread
   */
  async getSelectedFrame(threadId: string): Promise<StackFrame> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBStackFrame>("getSelectedFrame", {
      threadId: parseInt(threadId, 10),
    });

    return this.lldbFrameToStackFrame(result);
  }

  /**
   * Set the selected frame for a thread
   */
  async setSelectedFrame(
    threadId: string,
    frameIndex: number,
  ): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("setSelectedFrame", {
      threadId: parseInt(threadId, 10),
      frameIndex,
    });
  }

  /**
   * Get process exit information
   */
  async getExitInfo(): Promise<LLDBExitInfo> {
    this.ensureConnected();
    return await this.bridge.call<LLDBExitInfo>("getExitInfo", {});
  }

  /**
   * Get thread stop description
   */
  async getStopDescription(
    threadId: string,
    maxLength?: number,
  ): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<{ description: string }>(
      "getStopDescription",
      {
        threadId: parseInt(threadId, 10),
        maxLength: maxLength ?? 256,
      },
    );

    return result.description;
  }

  /**
   * Get variable by path (e.g., 'obj->field', 'array[0]')
   */
  async getVariableByPath(
    threadId: string,
    frameIndex: number,
    path: string,
  ): Promise<Variable> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBVariable>("getVariableByPath", {
      threadId: parseInt(threadId, 10),
      frameIndex,
      path,
    });

    return this.lldbVariableToVariable(result);
  }

  /**
   * Get target information
   */
  async getTargetInfo(): Promise<LLDBTargetInfo> {
    this.ensureConnected();
    return await this.bridge.call<LLDBTargetInfo>("getTargetInfo", {});
  }

  // ==================== P2 Feature Methods ====================

  /**
   * Set breakpoint by source regex (P2)
   * Creates breakpoints at all locations matching the regex pattern
   */
  async setBreakpointBySourceRegex(
    pattern: string,
    file?: string,
    condition?: string,
    ignoreCount?: number,
  ): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBBreakpoint>(
      "setBreakpointByRegex",
      {
        pattern,
        file,
        condition,
        ignoreCount,
      },
    );

    this.breakpointMap.set(result.id, result);
    return result.id;
  }

  /**
   * Get all modules (P2)
   * Returns list of all loaded modules with their details
   */
  async getModules(): Promise<LLDBModuleInfo[]> {
    this.ensureConnected();
    return await this.bridge.call<LLDBModuleInfo[]>("getModules", {});
  }

  /**
   * Write data to process stdin (P2)
   * Data should be provided as base64 encoded string
   */
  async putStdin(data: string): Promise<{ bytesWritten: number }> {
    this.ensureConnected();

    return await this.bridge.call<{ bytesWritten: number }>("putStdin", {
      data,
    });
  }

  /**
   * Read data from process stdout (P2)
   * Returns base64 encoded data
   */
  async getStdout(size?: number): Promise<LLDBProcessIOResult> {
    this.ensureConnected();

    return await this.bridge.call<LLDBProcessIOResult>("getStdout", {
      size: size ?? 1024,
    });
  }

  /**
   * Read data from process stderr (P2)
   * Returns base64 encoded data
   */
  async getStderr(size?: number): Promise<LLDBProcessIOResult> {
    this.ensureConnected();

    return await this.bridge.call<LLDBProcessIOResult>("getStderr", {
      size: size ?? 1024,
    });
  }

  /**
   * Get detailed breakpoint locations (P2)
   * Returns all locations where a breakpoint is set
   */
  async getBreakpointLocations(
    breakpointId: string,
  ): Promise<LLDBBreakpointLocation[]> {
    this.ensureConnected();

    return await this.bridge.call<LLDBBreakpointLocation[]>(
      "getBreakpointLocations",
      { id: breakpointId },
    );
  }

  // ==================== Private Methods ====================

  private ensureConnected(): void {
    if (!this.connected) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected to LLDB",
      );
    }
  }

  private lldbThreadToThreadInfo(t: LLDBThreadInfo): ThreadInfo {
    return {
      id: String(t.id),
      name: t.name,
      state: t.state,
      status: t.stopReason,
      isSuspended: t.state === "stopped" || t.state === "suspended",
      isDaemon: false,
      priority: 0,
      createdAt: new Date(),
    };
  }

  private lldbFrameToStackFrame(f: LLDBStackFrame): StackFrame {
    return {
      id: String(f.id),
      location: f.location,
      method: f.method,
      line: f.line,
      isNative: true, // LLDB is always native
    };
  }

  private lldbVariableToVariable(v: LLDBVariable): Variable {
    return {
      name: v.name,
      type: v.type,
      value: v.value,
      isPrimitive:
        !v.isPointer && !v.isArray && !v.isStruct && v.numChildren === 0,
      isNull: v.isNil,
    };
  }

  private mapEventType(type: string): DebugEvent["type"] {
    switch (type) {
      case "stopped":
        return "breakpoint";
      case "crashed":
        return "exception";
      case "exited":
        return "terminated";
      default:
        return "breakpoint";
    }
  }

  // ==================== Extended Features ====================

  async eval(
    expression: string,
    threadId: string,
    frameIndex: number,
    options?: EvalOptions,
  ): Promise<EvalResult> {
    const lldbOptions: LLDBEvalOptions = {
      timeout: options?.timeout,
      unwindOnError: options?.unwindOnError,
      ignoreBreakpoints: options?.ignoreBreakpoints,
    };

    const result = await this.bridge.call<{ value: unknown; type: string; error?: string }>("eval", {
      expression,
      threadId,
      frameIndex,
      options: lldbOptions,
    });

    return {
      value: result.value,
      type: result.type,
      error: result.error,
    };
  }

  async getBreakpointInfo(id: string): Promise<ExtendedBreakpointInfo> {
    const bp = await this.bridge.call<LLDBBreakpoint>("getBreakpoint", { id });

    return {
      id: bp.id,
      location: bp.locations[0] ?? "",
      enabled: bp.enabled,
      hitCount: bp.hitCount,
      ignoreCount: bp.ignoreCount,
      condition: bp.condition,
    };
  }

  async getTypeInfo(typeName: string, includeFields?: boolean, includeTemplateArgs?: boolean): Promise<TypeInfo> {
    const result = await this.bridge.call<LLDBTypeInfo>("getTypeInfo", {
      typeName,
      includeFields,
      includeTemplateArgs,
    });

    return {
      name: result.name,
      byteSize: result.byteSize,
      isPointer: result.isPointer,
      isArray: result.isArray,
      isStruct: result.isStruct,
      isClass: result.isClass || false,
      isUnion: result.isUnion || false,
      isEnumeration: result.isEnumeration || false,
      numTemplateArgs: result.numTemplateArgs || 0,
      templateArgs: (result.templateArgs || []).map(t => t.name),
      fields: (result.fields || []).map(f => ({
        name: f.name,
        typeName: f.type,
        offset: f.byteOffset,
        byteSize: 0,
        isStatic: false,
      })),
      baseClasses: (result.baseClasses || []).map(bc => bc.name),
      enumValues: (result.enumValues || []).map(ev => ({
        name: ev.name,
        value: BigInt(ev.value),
      })),
    };
  }

  async getSymbol(threadId: string, frameIndex: number, symbolName?: string, fuzzyMatch?: boolean): Promise<SymbolInfo> {
    const result = await this.bridge.call<LLDBSymbolInfo>("getSymbol", {
      threadId,
      frameIndex,
      symbolName,
      fuzzyMatch,
    });

    return {
      name: result.name,
      type: result.type,
      address: result.address,
      size: result.size,
      module: result.module,
    };
  }

  async getTargetMetadata(): Promise<TargetMetadata> {
    const result = await this.bridge.call<LLDBTargetMetadata>("getTargetMetadata", {});

    return {
      executable: result.executable,
      triple: result.triple,
      numModules: result.numModules,
      numSections: result.numSections || 0,
      numSymbols: result.numSymbols || 0,
    };
  }

  async getThreadBatchInfo(threadId: string): Promise<ThreadBatchInfo> {
    const result = await this.bridge.call<LLDBThreadBatchInfo>("getThreadBatchInfo", { threadId });

    return {
      threadId: threadId,
      functions: result.functions,
      files: result.files,
      lines: result.lines,
      addresses: result.addresses.map(a => BigInt(a)),
      modules: result.modules,
    };
  }

  supportsFeature(feature: FeatureName): boolean {
    switch (feature) {
      case "eval":
        return true;
      case "enableDisableBreakpoint":
        return true;
      case "extendedBreakpointInfo":
        return true;
      case "typeInfo":
        return true;
      case "symbolInfo":
        return true;
      case "targetMetadata":
        return true;
      case "threadBatchInfo":
        return true;
      default:
        return false;
    }
  }
}
