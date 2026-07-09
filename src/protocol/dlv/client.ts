/**
 * Delve Client Implementation
 * Implements DebugProtocol interface for Go Delve debugger
 */

import type { ExtendedDebugProtocol, EvalOptions, EvalResult, ExtendedBreakpointInfo, TypeInfo, SymbolInfo, TargetMetadata, ThreadBatchInfo, ExpandedVariable, FeatureName } from "../extended.js";
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
import { DlvRpcClient } from "./rpc.js";
import type {
  DlvBreakpoint,
  DlvGoroutine,
  DlvStackFrame,
  DlvVariable,
  DlvDeferredCall,
  DlvCheckpoint,
  DlvLoadConfig,
  DlvFilterKind,
} from "./types.js";
import { getDefaultLoadConfig, isPrimitiveKind } from "./types.js";
import * as debuggerApi from "./api/debugger.js";
import * as breakpointApi from "./api/breakpoint.js";
import * as goroutineApi from "./api/goroutine.js";
import * as stackApi from "./api/stack.js";
import * as variableApi from "./api/variable.js";
import * as infoApi from "./api/info.js";
import * as checkpointApi from "./api/checkpoint.js";
import * as configApi from "./api/config.js";
import * as miscApi from "./api/misc.js";

/**
 * Delve Client
 * Implements ExtendedDebugProtocol for Go debugging via Delve
 */
export class DlvClient implements ExtendedDebugProtocol {
  private config: DebugConfig;
  private rpc: DlvRpcClient;
  private connected = false;
  private breakpointMap = new Map<string, DlvBreakpoint>();
  private currentFrameIndex = 0;
  private loadConfig: DlvLoadConfig;

  constructor(config: DebugConfig, loadConfig?: DlvLoadConfig) {
    // Validate configuration
    this.config = DebugConfigSchema.parse(config);
    this.rpc = new DlvRpcClient(this.config.timeout);
    this.loadConfig = loadConfig ?? getDefaultLoadConfig();
  }

  /**
   * Get current load configuration
   */
  getLoadConfig(): DlvLoadConfig {
    return { ...this.loadConfig };
  }

  /**
   * Set load configuration for variable inspection
   */
  setLoadConfig(config: Partial<DlvLoadConfig>): void {
    this.loadConfig = { ...this.loadConfig, ...config };
  }

  // ==================== Lifecycle ====================

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.rpc.connect(this.config.host, this.config.port, this.config.timeout);
    this.connected = true;
  }

  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.breakpointMap.clear();

    try {
      // Call Detach to properly clean up resources
      // Use kill=false to keep the target process alive
      await debuggerApi.detach(this.rpc, false);
    } catch {
      // Ignore detach errors - connection might already be closed
    }

    await this.rpc.close();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ==================== Metadata ====================

  protocolName(): string {
    return "dlv";
  }

  supportedLanguages(): string[] {
    return ["go"];
  }

  async version(): Promise<VersionInfo> {
    this.ensureConnected();
    const result = await debuggerApi.getVersion(this.rpc);
    return {
      protocolVersion: result.APIVersion,
      runtimeVersion: result.DelveVersion,
      runtimeName: "go",
      description: "Delve Go Debugger",
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

    // In Go, we use goroutines instead of threads
    let goroutines = await goroutineApi.getAllGoroutines(this.rpc);

    // If no goroutines found, try to get current goroutine from state
    // This can happen when program is stopped at entry point
    if (goroutines.length === 0) {
      const state = await debuggerApi.getState(this.rpc);
      if (state.currentGoroutine) {
        goroutines = [state.currentGoroutine];
      } else if (state.SelectedGoroutine) {
        goroutines = [state.SelectedGoroutine];
      }
    }

    return goroutines.map((g) => this.goroutineToThreadInfo(g));
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const frames = await stackApi.stacktraceGoroutine(this.rpc, goroutineId);

    return (frames || []).map((f, i) => this.stackFrameToStackFrame(f, i));
  }

  /**
   * Get stacktrace with deferred calls included
   */
  async stackWithDefers(threadId: string, depth = 50): Promise<StackFrame[]> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const frames = await stackApi.stacktraceWithDefers(this.rpc, goroutineId, depth);

    return frames.map((f, i) => this.stackFrameToStackFrame(f, i));
  }

  /**
   * Get full stacktrace with variable information
   */
  async stackFull(threadId: string, depth = 50): Promise<StackFrame[]> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const frames = await stackApi.stacktraceFull(this.rpc, goroutineId, depth);

    return frames.map((f, i) => this.stackFrameToStackFrame(f, i));
  }

  async threadState(threadId: string): Promise<string> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const goroutine = await goroutineApi.getGoroutine(this.rpc, goroutineId);

    // Determine state based on thread ID
    if (goroutine.threadId > 0) {
      return "running";
    }
    return "waiting";
  }

  /**
   * List goroutines with pagination
   */
  async threadsPaginated(start = 0, count = 100): Promise<{
    threads: ThreadInfo[];
    nextIndex: number;
    hasMore: boolean;
  }> {
    this.ensureConnected();

    const result = await goroutineApi.listGoroutines(this.rpc, start, count);
    const threads = result.Goroutines.map((g) => this.goroutineToThreadInfo(g));

    return {
      threads,
      nextIndex: result.Nextg,
      hasMore: result.Nextg >= 0,
    };
  }

  /**
   * List goroutines with filter
   */
  async threadsFiltered(params: {
    start?: number;
    count?: number;
    labels?: Record<string, string>;
    filter?: { kind: DlvFilterKind; arg: string | number | boolean };
  }): Promise<ThreadInfo[]> {
    this.ensureConnected();

    const result = await goroutineApi.listGoroutinesFiltered(this.rpc, params);
    return result.Goroutines.map((g) => this.goroutineToThreadInfo(g));
  }

  /**
   * List goroutines grouped by location
   */
  async threadsGrouped(
    groupBy: "userloc" | "curloc" | "goloc" | "startloc" | "running" | "user",
  ): Promise<Map<string, ThreadInfo[]>> {
    this.ensureConnected();

    const result = await goroutineApi.listGoroutinesGrouped(this.rpc, groupBy);
    const groupMap = goroutineApi.groupByToMap(result);

    const resultMap = new Map<string, ThreadInfo[]>();
    for (const [group, ids] of groupMap) {
      const threads: ThreadInfo[] = [];
      for (const id of ids) {
        try {
          const g = await goroutineApi.getGoroutine(this.rpc, id);
          threads.push(this.goroutineToThreadInfo(g));
        } catch {
          // Skip if goroutine no longer exists
        }
      }
      resultMap.set(group, threads);
    }

    return resultMap;
  }

  /**
   * List running goroutines only
   */
  async runningThreads(): Promise<ThreadInfo[]> {
    this.ensureConnected();

    const result = await goroutineApi.listRunningGoroutines(this.rpc);
    return result.Goroutines.map((g) => this.goroutineToThreadInfo(g));
  }

  /**
   * Get goroutine labels
   */
  async getThreadLabels(threadId: string): Promise<Record<string, string>> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    return goroutineApi.getGoroutineLabels(this.rpc, goroutineId);
  }

  // ==================== Execution Control ====================

  async suspend(threadId?: string): Promise<void> {
    this.ensureConnected();

    if (threadId) {
      // Switch to goroutine first
      const goroutineId = parseInt(threadId, 10);
      await debuggerApi.switchGoroutine(this.rpc, goroutineId);
    }

    await debuggerApi.halt(this.rpc);
  }

  async resume(threadId?: string): Promise<void> {
    this.ensureConnected();

    if (threadId) {
      const goroutineId = parseInt(threadId, 10);
      await debuggerApi.continueExecution(this.rpc, goroutineId);
    } else {
      await debuggerApi.continueExecution(this.rpc);
    }
  }

  async stepInto(threadId: string): Promise<void> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    await debuggerApi.step(this.rpc, goroutineId);
  }

  async stepOver(threadId: string): Promise<void> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    await debuggerApi.next(this.rpc, goroutineId);
  }

  async stepOut(threadId: string): Promise<void> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    await debuggerApi.stepOut(this.rpc, goroutineId);
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(
    location: string,
    condition?: string,
    type?:
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

    if (type && type !== "line") {
      // Add best-effort exception breakpoint support for Go panics
      if (type === "exception") {
        const bp = await breakpointApi.createBreakpointAtFunction(
          this.rpc,
          "runtime.gopanic",
          condition,
        );
        const id = `dlv_bp_${bp.id}`;
        this.breakpointMap.set(id, bp);
        return id;
      }
      throw new APIError(
        ErrorType.InternalError,
        ErrorCodes.NotImplemented,
        `Delve only supports 'line' breakpoints, not '${type}'`,
        { type },
      );
    }

    // Parse location: "file.go:line" or "function"
    let bp: DlvBreakpoint;

    if (location.includes(":")) {
      // File:line format
      const lastColon = location.lastIndexOf(":");
      const file = location.substring(0, lastColon);
      const line = parseInt(location.substring(lastColon + 1), 10);

      if (isNaN(line)) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid line number in location: ${location}`,
        );
      }

      bp = await breakpointApi.createBreakpointAtLocation(
        this.rpc,
        file,
        line,
        condition,
      );
    } else {
      // Function name format
      bp = await breakpointApi.createBreakpointAtFunction(
        this.rpc,
        location,
        condition,
      );
    }

    const id = `dlv_bp_${bp.id}`;
    this.breakpointMap.set(id, bp);
    return id;
  }

  async removeBreakpoint(id: string): Promise<void> {
    this.ensureConnected();

    const bp = this.breakpointMap.get(id);
    if (bp) {
      await breakpointApi.clearBreakpoint(this.rpc, bp.id);
      this.breakpointMap.delete(id);
    }
  }

  async clearBreakpoints(): Promise<void> {
    this.ensureConnected();

    await breakpointApi.clearAllBreakpoints(this.rpc);
    this.breakpointMap.clear();
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    this.ensureConnected();

    const bps = await breakpointApi.listBreakpoints(this.rpc);

    return (bps || [])
      .filter((bp) => bp.id >= 0) // Filter internal breakpoints
      .map((bp) => ({
        id: `dlv_bp_${bp.id}`,
        location: bp.file ? `${bp.file}:${bp.line}` : bp.functionName,
        enabled: !bp.disabled,
        hitCount: bp.hitCount,
        condition: bp.Cond || undefined,
      }));
  }

  /**
   * Toggle breakpoint enabled state
   */
  async toggleBreakpoint(id: string): Promise<void> {
    this.ensureConnected();

    const bp = this.breakpointMap.get(id);
    if (bp) {
      const updated = await breakpointApi.toggleBreakpoint(this.rpc, bp.id, !bp.disabled);
      this.breakpointMap.set(id, updated);
    }
  }

  /**
   * Set breakpoint condition
   */
  async setBreakpointCondition(id: string, condition: string): Promise<void> {
    this.ensureConnected();

    const bp = this.breakpointMap.get(id);
    if (bp) {
      const updated = await breakpointApi.setBreakpointCondition(this.rpc, bp.id, condition);
      this.breakpointMap.set(id, updated);
    }
  }

  // ==================== Variable Inspection ====================

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const scope = variableApi.createEvalScope(goroutineId, frameIndex);
    const vars = await variableApi.listLocalVars(this.rpc, scope, this.loadConfig);

    return vars.map((v) => this.dlvVariableToVariable(v));
  }

  async fields(objectId: string): Promise<Variable[]> {
    this.ensureConnected();

    // objectId format: "goroutineId:frameIndex:varName" or just expression
    const parts = objectId.split(":");
    let scope: { goroutineID: number; frame: number; deferredCall: number } | undefined;
    let expr: string;

    if (parts.length >= 3) {
      scope = {
        goroutineID: parseInt(parts[0]!, 10),
        frame: parseInt(parts[1]!, 10),
        deferredCall: 0,
      };
      expr = parts.slice(2).join(":");
    } else {
      expr = objectId;
    }

    const result = await variableApi.evalExpr(this.rpc, expr, scope);

    if (!result.children || result.children.length === 0) {
      return [];
    }

    return result.children.map((v) => this.dlvVariableToVariable(v));
  }

  async setField(objectId: string, fieldId: string, value: unknown): Promise<void> {
    this.ensureConnected();

    // Parse objectId to get scope and base expression
    const parts = objectId.split(":");
    let scope: { goroutineID: number; frame: number; deferredCall: number } | undefined;
    let baseExpr: string;

    if (parts.length >= 3) {
      scope = {
        goroutineID: parseInt(parts[0]!, 10),
        frame: parseInt(parts[1]!, 10),
        deferredCall: 0,
      };
      baseExpr = parts.slice(2).join(":");
    } else {
      baseExpr = objectId;
    }

    // Construct full expression for the field
    const fullExpr = `${baseExpr}.${fieldId}`;
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);

    if (!scope) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "Scope required for setting variable",
      );
    }

    await variableApi.setVar(this.rpc, scope, fullExpr, valueStr);
  }

  // ==================== Event Handling ====================

  async waitForEvent(timeout?: number): Promise<DebugEvent | null> {
    this.ensureConnected();

    // Delve doesn't have a direct event API like JDWP
    // We poll for state changes
    const startTime = Date.now();
    const pollInterval = 100;
    const actualTimeout = timeout ?? this.config.timeout;

    while (Date.now() - startTime < actualTimeout) {
      const state = await debuggerApi.getState(this.rpc);

      // Check if stopped at breakpoint
      if (!state.running && state.currentThread?.breakPoint) {
        const bp = state.currentThread.breakPoint;
        return {
          type: "breakpoint",
          threadId: String(state.currentGoroutine?.id ?? 0),
          location: bp.file ? `${bp.file}:${bp.line}` : bp.functionName,
          timestamp: new Date(),
          data: {
            breakpointId: bp.id,
            hitCount: bp.hitCount,
          },
        };
      }

      // Check if exited
      if (state.exited) {
        return {
          type: "terminated",
          threadId: "",
          location: "",
          timestamp: new Date(),
          data: {
            exitStatus: state.exitStatus,
          },
        };
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return null;
  }

  // ==================== Private Methods ====================

  private ensureConnected(): void {
    if (!this.connected) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected to Delve server",
      );
    }
  }

  private goroutineToThreadInfo(g: DlvGoroutine): ThreadInfo {
    const funcName = g.userCurrentLoc.function?.name ?? "<unknown>";
    const isRunning = g.threadId > 0;

    return {
      id: String(g.id),
      name: funcName,
      state: isRunning ? "running" : "waiting",
      status: isRunning ? "running" : "waiting",
      isSuspended: !isRunning,
      isDaemon: g.systemStack,
      priority: 0,
      createdAt: new Date(),
    };
  }

  private stackFrameToStackFrame(f: DlvStackFrame, index: number): StackFrame {
    return {
      id: String(index),
      location: `${f.file}:${f.line}`,
      method: f.function?.name ?? "<unknown>",
      line: f.line,
      isNative: f.systemStack,
    };
  }

  private dlvVariableToVariable(v: DlvVariable): Variable {
    return {
      name: v.name,
      type: v.type,
      value: variableApi.parseVariableValue(v),
      isPrimitive: variableApi.isPrimitive(v),
      isNull: variableApi.isNil(v),
    };
  }

  // ==================== Extended Methods ====================

  /**
   * Get function arguments
   */
  async args(threadId: string, frameIndex: number): Promise<Variable[]> {
    this.ensureConnected();
    const goroutineId = parseInt(threadId, 10);
    const scope = variableApi.createEvalScope(goroutineId, frameIndex);
    const vars = await variableApi.listFunctionArgs(this.rpc, scope);
    return vars.map((v) => this.dlvVariableToVariable(v));
  }

  /**
   * Navigate up in call stack
   */
  async frameUp(steps = 1): Promise<StackFrame | null> {
    this.ensureConnected();
    const state = await debuggerApi.getState(this.rpc);
    const goroutineId = state.currentGoroutine?.id ?? 0;
    const result = await stackApi.frameUp(
      this.rpc,
      goroutineId,
      this.currentFrameIndex,
      steps,
    );
    if (result) {
      this.currentFrameIndex = result.index;
      return this.stackFrameToStackFrame(result.frame, result.index);
    }
    return null;
  }

  /**
   * Navigate down in call stack
   */
  async frameDown(steps = 1): Promise<StackFrame | null> {
    this.ensureConnected();
    const state = await debuggerApi.getState(this.rpc);
    const goroutineId = state.currentGoroutine?.id ?? 0;
    const result = await stackApi.frameDown(
      this.rpc,
      goroutineId,
      this.currentFrameIndex,
      steps,
    );
    if (result) {
      this.currentFrameIndex = result.index;
      return this.stackFrameToStackFrame(result.frame, result.index);
    }
    return null;
  }

  /**
   * Set current frame
   */
  async setFrame(frameIndex: number): Promise<void> {
    this.ensureConnected();
    const state = await debuggerApi.getState(this.rpc);
    const goroutineId = state.currentGoroutine?.id ?? 0;
    await stackApi.setFrame(this.rpc, goroutineId, frameIndex);
    this.currentFrameIndex = frameIndex;
  }

  /**
   * Get deferred calls
   */
  async deferredCalls(
    threadId: string,
    frameIndex: number,
  ): Promise<DlvDeferredCall[]> {
    this.ensureConnected();
    const goroutineId = parseInt(threadId, 10);
    return stackApi.listDeferredCalls(this.rpc, goroutineId, frameIndex);
  }

  /**
   * Instruction-level step
   */
  async stepInstruction(threadId: string): Promise<void> {
    this.ensureConnected();
    const goroutineId = parseInt(threadId, 10);
    await debuggerApi.stepInstruction(this.rpc, goroutineId);
  }

  /**
   * Instruction-level next
   */
  async nextInstruction(threadId: string): Promise<void> {
    this.ensureConnected();
    const goroutineId = parseInt(threadId, 10);
    await debuggerApi.nextInstruction(this.rpc, goroutineId);
  }

  // ==================== Info Methods ====================

  /**
   * List functions
   */
  async listFunctions(filter?: string): Promise<string[]> {
    this.ensureConnected();
    return infoApi.listFunctions(this.rpc, filter);
  }

  /**
   * List packages
   */
  async listPackages(filter?: string): Promise<string[]> {
    this.ensureConnected();
    return infoApi.listPackages(this.rpc, filter);
  }

  /**
   * List source files
   */
  async listSources(filter?: string): Promise<string[]> {
    this.ensureConnected();
    return infoApi.listSources(this.rpc, filter);
  }

  /**
   * List types
   */
  async listTypes(filter?: string): Promise<string[]> {
    this.ensureConnected();
    const types = await infoApi.listTypes(this.rpc, filter);
    return (types || []).map((t) => t.name);
  }

  /**
   * List dynamic libraries
   */
  async listLibraries(): Promise<infoApi.DlvLibrary[]> {
    this.ensureConnected();
    return infoApi.listLibraries(this.rpc);
  }

  /**
   * Show source code
   */
  async showSource(locspec?: string): Promise<infoApi.DlvSourceLocation> {
    this.ensureConnected();
    return infoApi.listSource(this.rpc, locspec);
  }

  // ==================== Checkpoint Methods ====================

  /**
   * Create checkpoint
   */
  async createCheckpoint(note?: string): Promise<DlvCheckpoint> {
    this.ensureConnected();
    return checkpointApi.createCheckpoint(this.rpc, note);
  }

  /**
   * List checkpoints
   */
  async listCheckpoints(): Promise<DlvCheckpoint[]> {
    this.ensureConnected();
    return checkpointApi.listCheckpoints(this.rpc);
  }

  /**
   * Clear checkpoint
   */
  async clearCheckpoint(id: number): Promise<void> {
    this.ensureConnected();
    await checkpointApi.clearCheckpoint(this.rpc, id);
  }

  // ==================== Config Methods ====================

  /**
   * Get debugger config
   */
  async getConfig(): Promise<configApi.DlvDebuggerConfig> {
    this.ensureConnected();
    return configApi.getConfig(this.rpc);
  }

  /**
   * Set debugger config
   */
  async setConfig(
    config: Partial<configApi.DlvDebuggerConfig>,
  ): Promise<void> {
    this.ensureConnected();
    await configApi.setConfig(this.rpc, config);
  }

  // ==================== Debug Operations ====================

  /**
   * Restart the debugged process
   */
  async restart(position?: string, resetArgs = false, newArgs?: string[]): Promise<void> {
    this.ensureConnected();
    await debuggerApi.restart(this.rpc, position, resetArgs, newArgs);
    // Clear breakpoint map as restart may discard breakpoints
    this.breakpointMap.clear();
  }

  /**
   * Dump core
   */
  async dumpCore(outputPath: string): Promise<void> {
    this.ensureConnected();
    await miscApi.dumpCore(this.rpc, outputPath);
  }

  /**
   * Rebuild target
   */
  async rebuild(): Promise<void> {
    this.ensureConnected();
    await miscApi.rebuild(this.rpc);
  }

  // ==================== Target Methods ====================

  /**
   * Get target process info
   */
  async getTarget(): Promise<miscApi.DlvTarget> {
    this.ensureConnected();
    return miscApi.getTarget(this.rpc);
  }

  // ==================== Extended Features ====================

  async eval(
    expression: string,
    _threadId: string,
    _frameIndex: number,
    _options?: EvalOptions,
  ): Promise<EvalResult> {
    this.ensureConnected();
    const result = await variableApi.evalExpr(this.rpc, expression);

    return {
      value: result.value,
      type: result.type,
    };
  }

  async enableBreakpoint(id: string): Promise<void> {
    this.ensureConnected();
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }

    await breakpointApi.amendBreakpoint(this.rpc, {
      ...bp,
      disabled: false,
    });

    bp.disabled = false;
  }

  async disableBreakpoint(id: string): Promise<void> {
    this.ensureConnected();
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }

    await breakpointApi.amendBreakpoint(this.rpc, {
      ...bp,
      disabled: true,
    });

    bp.disabled = true;
  }

  async getBreakpointInfo(id: string): Promise<ExtendedBreakpointInfo> {
    this.ensureConnected();
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }

    return {
      id: id,
      location: `${bp.file}:${bp.line}`,
      enabled: !bp.disabled,
      hitCount: bp.hitCount,
      ignoreCount: 0,
      condition: bp.Cond || null,
    };
  }

  async getTypeInfo(typeName: string, includeFields?: boolean, _includeTemplateArgs?: boolean): Promise<TypeInfo> {
    this.ensureConnected();

    // Use listTypes to find type info
    const types = await infoApi.listTypes(this.rpc, typeName);
    const matchedType = types.find(t => t.name === typeName) || types[0];

    if (!matchedType) {
      throw new APIError(
        ErrorType.CommandError,
        ErrorCodes.ResourceNotFound,
        `Type '${typeName}' not found`,
        { typeName },
      );
    }

    // Try to get fields via eval if requested
    let fields: TypeInfo["fields"] = [];
    if (includeFields) {
      try {
        const scope = variableApi.createEvalScope(0, 0);
        // Use a dummy eval to get the type's fields
        const result = await variableApi.evalExpr(this.rpc, `reflect.TypeOf(${typeName}{})`, scope);
        // Map fields from the type's structure
        try {
          if (result.children) {
            fields = result.children.map((child) => ({
              name: child.name,
              typeName: child.type,
              offset: 0,
              byteSize: 0,
              isStatic: false,
            }));
          }
        } catch {
          // If eval fails, use the children info from the type
          if (result.children) {
            fields = result.children.map((child) => ({
              name: child.name,
              typeName: child.type,
              offset: 0,
              byteSize: 0,
              isStatic: false,
            }));
          }
        }
      } catch {
        // Fields not available
      }
    }

    return {
      name: matchedType.name,
      byteSize: matchedType.size,
      isPointer: false,
      isArray: false,
      isStruct: matchedType.kind === 7, // Struct kind
      isClass: false,
      isUnion: false,
      isEnumeration: false,
      numTemplateArgs: 0,
      templateArgs: [],
      fields,
      baseClasses: [],
      enumValues: [],
    };
  }

  async getSymbol(threadId: string, frameIndex: number, symbolName?: string, fuzzyMatch?: boolean): Promise<SymbolInfo> {
    this.ensureConnected();

    if (symbolName) {
      // Try to find the symbol by searching functions, types, and packages
      try {
        // Search functions first
        const functions = await infoApi.listFunctions(this.rpc, fuzzyMatch ? "" : symbolName);
        const matchedFunc = fuzzyMatch
          ? functions.find(f => f.toLowerCase().includes(symbolName.toLowerCase()))
          : functions.find(f => f === symbolName);

        if (matchedFunc) {
          return {
            name: matchedFunc,
            type: "code",
            address: 0,
            size: 0,
            module: "go",
          };
        }
      } catch {
        // Fall through
      }

      try {
        // Search types
        const types = await infoApi.listTypes(this.rpc, fuzzyMatch ? "" : symbolName);
        const matchedType = fuzzyMatch
          ? types.find(t => t.name.toLowerCase().includes(symbolName.toLowerCase()))
          : types.find(t => t.name === symbolName);

        if (matchedType) {
          return {
            name: matchedType.name,
            type: "data",
            address: 0,
            size: matchedType.size,
            module: "go",
          };
        }
      } catch {
        // Fall through
      }

      try {
        // Search packages as module info
        const packages = await infoApi.listPackages(this.rpc, fuzzyMatch ? "" : symbolName);
        const matchedPkg = fuzzyMatch
          ? packages.find(p => p.toLowerCase().includes(symbolName.toLowerCase()))
          : packages.find(p => p === symbolName);

        if (matchedPkg) {
          return {
            name: matchedPkg,
            type: "code",
            address: 0,
            size: 0,
            module: "go",
          };
        }
      } catch {
        // Fall through
      }

      throw new APIError(
        ErrorType.CommandError,
        ErrorCodes.ResourceNotFound,
        `Symbol '${symbolName}' not found`,
        { symbolName },
      );
    }

    // No symbol name: return current function context
    try {
      const state = await debuggerApi.getState(this.rpc);
      const goroutine = state.currentGoroutine;
      if (goroutine?.currentLoc?.function?.name) {
        return {
          name: goroutine.currentLoc.function.name,
          type: "code",
          address: 0,
          size: 0,
          module: "go",
        };
      }
    } catch {
      // Fall through
    }

    throw new APIError(
      ErrorType.CommandError,
      ErrorCodes.ResourceNotFound,
      "Could not resolve symbol for current context",
      { threadId, frameIndex },
    );
  }

  async getTargetMetadata(): Promise<TargetMetadata> {
    this.ensureConnected();
    const target = await miscApi.getTarget(this.rpc);

    // Get package count for numModules
    let numModules = 0;
    try {
      const packages = await infoApi.listPackages(this.rpc);
      numModules = packages.length;
    } catch {
      // Packages unavailable
    }

    return {
      executable: target.cmd[0] || "",
      triple: "go",
      numModules,
      numSections: 0,
      numSymbols: 0,
    };
  }

  async getThreadBatchInfo(threadId: string): Promise<ThreadBatchInfo> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const rawFrames = await stackApi.stacktraceFull(this.rpc, goroutineId, 50);

    // Get module names from listPackages
    let modules: string[] = [];
    try {
      modules = await infoApi.listPackages(this.rpc);
    } catch {
      // Packages unavailable
    }

    return {
      threadId,
      functions: rawFrames.map(f => f.function?.name ?? "<unknown>"),
      files: rawFrames.map(f => f.file),
      lines: rawFrames.map(f => f.line),
      addresses: rawFrames.map(f => BigInt(f.pc)),
      modules,
    };
  }

  async expandVariable(objectId: string, depth: number = 1): Promise<ExpandedVariable[]> {
    this.ensureConnected();

    // Evaluate the variable expression to get its children
    const state = await debuggerApi.getState(this.rpc);
    const goroutineId = state.currentGoroutine?.id ?? 0;
    const scope = variableApi.createEvalScope(goroutineId, 0);

    const result = await variableApi.evalExpr(this.rpc, objectId, scope);
    return this.expandDlvVariableChildren(result, depth, goroutineId);
  }

  private expandDlvVariableChildren(
    var_: DlvVariable,
    depth: number,
    _goroutineId: number,
    parentObjectId?: string,
  ): ExpandedVariable[] {
    if (!var_.children || var_.children.length === 0) {
      return [];
    }

    const result: ExpandedVariable[] = [];
    for (const child of var_.children) {
      const entry: ExpandedVariable = {
        name: child.name,
        type: child.type,
        value: child.value,
        isPrimitive: isPrimitiveKind(child.kind),
        isNull: child.value === "nil" || child.unreadable !== "",
      };

      if (!entry.isPrimitive && depth > 1 && child.children && child.children.length > 0) {
        const childId = parentObjectId ? `${parentObjectId}.${child.name}` : child.name;
        entry.objectId = childId;
        entry.children = this.expandDlvVariableChildren(child, depth - 1, _goroutineId, childId);
      }

      result.push(entry);
    }

    return result;
  }

  supportsFeature(feature: FeatureName): boolean {
    switch (feature) {
      case "eval":
        return true;
      case "enableDisableBreakpoint":
        return true;
      case "extendedBreakpointInfo":
        return true;
      case "targetMetadata":
        return true;
      case "typeInfo":
        return true;
      case "symbolInfo":
        return true;
      case "threadBatchInfo":
        return true;
      case "expandVariable":
        return true;
      default:
        return false;
    }
  }
}
