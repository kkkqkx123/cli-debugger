/**
 * Delve Client Implementation
 * Implements DebugProtocol interface for Go Delve debugger
 */

import type { DebugProtocol } from "../base.js";
import type { DebugConfig } from "../../types/config.js";
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
} from "./types.js";
import * as debuggerApi from "./api/debugger.js";
import * as breakpointApi from "./api/breakpoint.js";
import * as goroutineApi from "./api/goroutine.js";
import * as stackApi from "./api/stack.js";
import * as variableApi from "./api/variable.js";
import * as infoApi from "./api/info.js";
import * as advancedApi from "./api/advanced.js";

/**
 * Delve Client
 * Implements DebugProtocol for Go debugging via Delve
 */
export class DlvClient implements DebugProtocol {
  private config: DebugConfig;
  private rpc: DlvRpcClient;
  private connected = false;
  private breakpointMap = new Map<string, DlvBreakpoint>();
  private currentFrameIndex = 0;

  constructor(config: DebugConfig) {
    this.config = config;
    this.rpc = new DlvRpcClient(config.timeout);
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

    await this.rpc.close();
    this.connected = false;
    this.breakpointMap.clear();
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
    const goroutines = await goroutineApi.getAllGoroutines(this.rpc);

    return goroutines.map((g) => this.goroutineToThreadInfo(g));
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const frames = await stackApi.stacktraceGoroutine(this.rpc, goroutineId);

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

    return bps
      .filter((bp) => bp.id >= 0) // Filter internal breakpoints
      .map((bp) => ({
        id: `dlv_bp_${bp.id}`,
        location: bp.file ? `${bp.file}:${bp.line}` : bp.functionName,
        enabled: !bp.disabled,
        hitCount: bp.hitCount,
        condition: bp.Cond || undefined,
      }));
  }

  // ==================== Variable Inspection ====================

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    this.ensureConnected();

    const goroutineId = parseInt(threadId, 10);
    const scope = variableApi.createEvalScope(goroutineId, frameIndex);
    const vars = await variableApi.listLocalVars(this.rpc, scope);

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
    const funcs = await infoApi.listFunctions(this.rpc, filter);
    return funcs.map((f) => f.name);
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
    return types.map((t) => t.name);
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

  // ==================== Advanced Methods ====================

  /**
   * Create checkpoint
   */
  async createCheckpoint(note?: string): Promise<DlvCheckpoint> {
    this.ensureConnected();
    return advancedApi.createCheckpoint(this.rpc, note);
  }

  /**
   * List checkpoints
   */
  async listCheckpoints(): Promise<DlvCheckpoint[]> {
    this.ensureConnected();
    return advancedApi.listCheckpoints(this.rpc);
  }

  /**
   * Clear checkpoint
   */
  async clearCheckpoint(id: number): Promise<void> {
    this.ensureConnected();
    await advancedApi.clearCheckpoint(this.rpc, id);
  }

  /**
   * Get debugger config
   */
  async getConfig(): Promise<advancedApi.DlvDebuggerConfig> {
    this.ensureConnected();
    return advancedApi.getConfig(this.rpc);
  }

  /**
   * Set debugger config
   */
  async setConfig(
    config: Partial<advancedApi.DlvDebuggerConfig>,
  ): Promise<void> {
    this.ensureConnected();
    await advancedApi.setConfig(this.rpc, config);
  }

  /**
   * Dump core
   */
  async dumpCore(outputPath: string): Promise<void> {
    this.ensureConnected();
    await advancedApi.dumpCore(this.rpc, outputPath);
  }

  /**
   * Rebuild target
   */
  async rebuild(): Promise<void> {
    this.ensureConnected();
    await advancedApi.rebuild(this.rpc);
  }

  /**
   * Get target process info
   */
  async getTarget(): Promise<advancedApi.DlvTarget> {
    this.ensureConnected();
    return advancedApi.getTarget(this.rpc);
  }
}
