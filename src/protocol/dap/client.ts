/**
 * DAP (Debug Adapter Protocol) Client
 *
 * Implements the DebugProtocol interface using DAP messages.
 * This is a base class that py-debug and js-debug extend with
 * language-specific configurations.
 */

import type { DebugProtocol } from "../base.js";
import type { ExtendedDebugProtocol } from "../extended.js";
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
import type { EvalOptions, EvalResult, ExtendedBreakpointInfo, TargetMetadata, ExpandedVariable, TypeInfo, ThreadBatchInfo, SymbolInfo } from "../extended.js";
import { DAPTransport, type DAPEvent } from "./transport.js";

/**
 * DAP-specific configuration (beyond base DebugConfig)
 */
export interface DAPAdapterConfig {
  /** Adapter name (e.g., "py-debug", "js-debug") */
  name: string;
  /** Supported languages */
  languages: string[];
  /** Runtime name for metadata */
  runtimeName: string;
  /** Launch configuration for the adapter */
  launchConfig: Record<string, unknown>;
  /** Protocol version string */
  protocolVersion: string;
}

/**
 * Base DAP client implementing the DebugProtocol interface
 */
export abstract class BaseDAPClient implements DebugProtocol, ExtendedDebugProtocol {
  protected config: DebugConfig;
  protected adapterConfig: DAPAdapterConfig;
  protected transport: DAPTransport | null = null;
  protected connected = false;
  protected adapterID: string | null = null;
  protected threadMap = new Map<number, string>();
  protected nextThreadID = 1;
  protected breakpointMap = new Map<string, { id: string; dapId: number; location: string; enabled: boolean; hitCount: number; condition?: string }>();
  /** Maps source path to set of breakpoint IDs for that source (for proper DAP setBreakpoints per-source replacement) */
  protected breakpointSourceMap = new Map<string, Set<string>>();
  protected nextBreakpointId = 1;
  protected exceptionBreakpointMap = new Map<string, string>(); // exceptionFilter -> localBpId
  protected eventQueue: DebugEvent[] = [];
  protected eventQueueLocked = false;
  protected static readonly MAX_EVENT_QUEUE = 1000;
  protected adapterCapabilities: Record<string, boolean> = {};

  constructor(config: DebugConfig, adapterConfig: DAPAdapterConfig) {
    this.config = DebugConfigSchema.parse(config);
    this.adapterConfig = adapterConfig;
  }

  // ==================== Lifecycle ====================

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const transport = new DAPTransport(
      this.config.host,
      this.config.port,
      this.config.timeout,
    );

    // Register event handlers before connecting
    transport.onEvent("stopped", (event: DAPEvent) => this.handleStoppedEvent(event));
    transport.onEvent("continued", (event: DAPEvent) => this.handleContinuedEvent(event));
    transport.onEvent("output", (event: DAPEvent) => this.handleOutputEvent(event));
    transport.onEvent("breakpoint", (event: DAPEvent) => this.handleBreakpointEvent(event));
    transport.onEvent("terminated", () => this.handleTerminatedEvent());
    transport.onEvent("exited", () => this.handleTerminatedEvent());
    transport.onEvent("thread", (event: DAPEvent) => this.handleThreadEvent(event));

    await transport.connect();
    this.transport = transport;

    try {
      // Step 1: Initialize
      const initResponse = await transport.sendRequest("initialize", {
        clientID: "cli-debugger-sdk",
        clientName: "CLI Debugger SDK",
        adapterID: this.adapterConfig.name,
        locale: "en",
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: "path",
        supportsVariableType: true,
        supportsVariablePaging: false,
        supportsRunInTerminalRequest: false,
        supportsMemoryReferences: false,
        supportsProgressReporting: false,
        supportsInvalidatedEvent: false,
      });

      if (initResponse.body && typeof initResponse.body === "object") {
        const body = initResponse.body as Record<string, unknown>;
        this.adapterID = (body["adapterID"] as string) || this.adapterConfig.name;
        this.parseCapabilities(body);
      }

      // Step 2: Listen for the "initialized" event from the adapter.
      // Some adapters (e.g. debugpy) defer the launch/attach response
      // until after configurationDone, so we need to track the event.
      const initializedPromise = new Promise<void>((resolve) => {
        transport.onEvent("initialized", () => { resolve(); });
      });

      // Step 3: Launch/Attach
      // Use the "request" field from launchConfig to determine the command
      const launchRequest = (this.adapterConfig.launchConfig.request as string) || "launch";
      // Fire the request but don't block — some adapters defer the response
      transport.sendRequest(launchRequest, {
        ...this.adapterConfig.launchConfig,
        noDebug: false,
      }).catch(() => {
        // Response may be deferred by some adapters (e.g. debugpy),
        // so ignore timeouts and other errors here.
      });

      // Step 4: Wait for the initialized event before proceeding
      await initializedPromise;

      // Step 5: ConfigurationDone
      await transport.sendRequest("configurationDone");

      // DAP doesn't support framesAt1 based on our initialize request
      this.connected = true;
    } catch (err) {
      await transport.close();
      this.transport = null;
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.connected && this.transport) {
      try {
        // Send DAP disconnect request before closing the connection
        await this.transport.sendRequest("disconnect", {
          restart: false,
          terminateDebuggee: false,
        });
      } catch {
        // Ignore disconnect errors (adapter may already be closing)
      }
    }
    this.connected = false;
    if (this.transport) {
      const transport = this.transport;
      this.transport = null;
      await transport.close();
    }
    this.threadMap.clear();
    this.breakpointMap.clear();
    this.breakpointSourceMap.clear();
    this.eventQueue = [];
  }

  isConnected(): boolean {
    return this.connected && this.transport !== null && this.transport.isConnected();
  }

  // ==================== Metadata ====================

  protocolName(): string {
    return this.adapterConfig.name;
  }

  supportedLanguages(): string[] {
    return this.adapterConfig.languages;
  }

  async version(): Promise<VersionInfo> {
    return {
      protocolVersion: this.adapterConfig.protocolVersion,
      runtimeVersion: "N/A",
      runtimeName: this.adapterConfig.runtimeName,
      description: `${this.adapterConfig.name} DAP adapter`,
    };
  }

  async capabilities(): Promise<Capabilities> {
    return {
      supportsVersion: true,
      supportsThreads: true,
      supportsStack: true,
      supportsLocals: true,
      supportsBreakpoints: true,
      supportsSuspend: true,  // pause
      supportsResume: true,   // continue
      supportsStep: true,
      supportsCont: true,
      supportsNext: true,
      supportsFinish: true,
      supportsEvents: true,
      supportsWatchMode: false,
      supportsStreaming: false,
    };
  }

  async getTargetMetadata(): Promise<TargetMetadata> {
    // Try to get modules count
    let numModules = 0;
    try {
      const modResponse = await this.sendDAPRequest("modules");
      const modBody = modResponse.body as { modules?: unknown[] } | undefined;
      if (modBody?.modules) {
        numModules = modBody.modules.length;
      }
    } catch {
      // Modules unavailable
    }

    return {
      executable: this.adapterConfig.name,
      triple: "unknown",
      numModules,
      numSections: 0,
      numSymbols: 0,
    };
  }

  // ==================== Thread Management ====================

  async threads(): Promise<ThreadInfo[]> {
    const response = await this.sendDAPRequest("threads");
    const body = response.body as { threads: Array<{ id: number; name: string }> } | undefined;
    if (!body || !body.threads) {
      return [];
    }

    return body.threads.map((t) => {
      const localId = this.toLocalThreadId(t.id);
      return {
        id: localId,
        name: t.name,
        state: "unknown",
        status: "unknown",
        isSuspended: false,
        isDaemon: false,
        priority: 0,
        createdAt: new Date(),
      };
    });
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    const dapThreadId = this.toDAPThreadId(threadId);
    const response = await this.sendDAPRequest("stackTrace", {
      threadId: dapThreadId,
    });
    const body = response.body as { stackFrames?: Array<{ id: number; name: string; line: number; column: number; source?: { path?: string }; presentationHint?: string }> } | undefined;
    if (!body || !body.stackFrames) {
      return [];
    }

    return body.stackFrames.map((f) => ({
      id: String(f.id),
      location: f.source?.path || "unknown",
      method: f.name,
      line: f.line,
      isNative: f.presentationHint === "label",
    }));
  }

  async threadState(threadId: string): Promise<string> {
    // DAP doesn't have a direct threadState, get from threads list
    const threads = await this.threads();
    const thread = threads.find((t) => t.id === threadId);
    return thread?.state || "unknown";
  }

  // ==================== Execution Control ====================

  async suspend(threadId?: string): Promise<void> {
    if (threadId) {
      const dapThreadId = this.toDAPThreadId(threadId);
      await this.sendDAPRequest("pause", { threadId: dapThreadId });
    } else {
      // Pause all threads - DAP requires a threadId, use the first one
      const threads = await this.threads();
      if (threads.length > 0 && threads[0]) {
        const dapThreadId = this.toDAPThreadId(threads[0].id);
        await this.sendDAPRequest("pause", { threadId: dapThreadId });
      }
    }
  }

  async resume(threadId?: string): Promise<void> {
    if (threadId) {
      const dapThreadId = this.toDAPThreadId(threadId);
      await this.sendDAPRequest("continue", { threadId: dapThreadId });
    } else {
      // Continue all threads
      const threads = await this.threads();
      for (const t of threads) {
        const dapThreadId = this.toDAPThreadId(t.id);
        await this.sendDAPRequest("continue", { threadId: dapThreadId });
      }
    }
  }

  async stepInto(threadId: string): Promise<void> {
    const dapThreadId = this.toDAPThreadId(threadId);
    await this.sendDAPRequest("stepIn", { threadId: dapThreadId });
  }

  async stepOver(threadId: string): Promise<void> {
    const dapThreadId = this.toDAPThreadId(threadId);
    await this.sendDAPRequest("next", { threadId: dapThreadId });
  }

  async stepOut(threadId: string): Promise<void> {
    const dapThreadId = this.toDAPThreadId(threadId);
    await this.sendDAPRequest("stepOut", { threadId: dapThreadId });
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(
    location: string,
    condition?: string,
    type?: "line" | "method-entry" | "method-exit" | "exception" | "field-access" | "field-modify" | "class-load" | "class-unload" | "thread-start" | "thread-death",
  ): Promise<string> {
    // Handle method-entry breakpoints via DAP setFunctionBreakpoints
    if (type === "method-entry") {
      const bpId = `function_bp_${this.nextBreakpointId++}`;
      const response = await this.sendDAPRequest("setFunctionBreakpoints", {
        breakpoints: [{ name: location, condition }],
      });
      const body = response.body as { breakpoints?: Array<{ id?: number }> } | undefined;
      const dapId = body?.breakpoints?.[0]?.id ?? 0;
      this.breakpointMap.set(bpId, {
        id: bpId,
        dapId,
        location,
        enabled: true,
        hitCount: 0,
        condition,
      });
      return bpId;
    }

    // Handle exception breakpoints separately via DAP setExceptionBreakpoints
    if (type === "exception") {
      const filter = location; // location is the exception filter name
      await this.sendDAPRequest("setExceptionBreakpoints", {
        filters: [filter],
        exceptionOptions: [],
      });
      // Track the exception breakpoint
      const bpId = `exception_bp_${this.nextBreakpointId++}`;
      this.exceptionBreakpointMap.set(filter, bpId);
      this.breakpointMap.set(bpId, {
        id: bpId,
        dapId: 0,
        location,
        enabled: true,
        hitCount: 0,
      });
      return bpId;
    }

    // Parse location: "file:line" (DAP uses source + line)
    const colonIndex = location.lastIndexOf(":");
    let sourcePath: string;
    let line: number;

    if (colonIndex === -1) {
      // Just a line number, use current source
      sourcePath = location;
      line = 1;
    } else {
      sourcePath = location.substring(0, colonIndex);
      line = parseInt(location.substring(colonIndex + 1), 10);
      if (isNaN(line)) {
        line = 1;
      }
    }

    // Create the breakpoint entry before syncing with DAP adapter
    const bpId = `bp_${this.nextBreakpointId++}`;
    this.breakpointMap.set(bpId, {
      id: bpId,
      dapId: 0,
      location: `${sourcePath}:${line}`,
      enabled: true,
      hitCount: 0,
      condition,
    });

    // Register in source tracking map
    let sourceBps = this.breakpointSourceMap.get(sourcePath);
    if (!sourceBps) {
      sourceBps = new Set();
      this.breakpointSourceMap.set(sourcePath, sourceBps);
    }
    sourceBps.add(bpId);

    // Sync ALL breakpoints for this source with the DAP adapter (replaces all previous)
    await this.resolveDAPBreakpoints(sourcePath);

    return bpId;
  }

  async removeBreakpoint(id: string): Promise<void> {
    // Check exception breakpoints first
    for (const [filter, bpId] of this.exceptionBreakpointMap.entries()) {
      if (bpId === id) {
        this.exceptionBreakpointMap.delete(filter);
        this.breakpointMap.delete(id);
        return;
      }
    }
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      return;
    }

    // Extract source path from location
    const location = bp.location;
    const colonIndex = location.lastIndexOf(":");
    const sourcePath = colonIndex === -1 ? location : location.substring(0, colonIndex);

    this.breakpointMap.delete(id);

    // Remove from source tracking map
    const sourceBps = this.breakpointSourceMap.get(sourcePath);
    if (sourceBps) {
      sourceBps.delete(id);
      if (sourceBps.size === 0) {
        this.breakpointSourceMap.delete(sourcePath);
      }
    }

    // Re-sync with DAP adapter: send updated breakpoint list for this source
    if (this.isConnected()) {
      await this.resolveDAPBreakpoints(sourcePath);
    }
  }

  async clearBreakpoints(): Promise<void> {
    this.breakpointMap.clear();
    this.exceptionBreakpointMap.clear();
    this.breakpointSourceMap.clear();
    // DAP doesn't have a clearBreakpoints command
    // Breakpoints are cleared per-source file
  }

  /**
   * Enable a breakpoint by ID.
   * DAP doesn't have a native enable/disable command, so we simulate it
   * by toggling the local enabled flag and re-syncing the breakpoints.
   */
  async enableBreakpoint(id: string): Promise<void> {
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }
    if (bp.enabled) return;

    bp.enabled = true;

    // Re-sync the source file's breakpoints with DAP adapter
    try {
      if (this.isConnected()) {
        const location = bp.location;
        const colonIndex = location.lastIndexOf(":");
        const sourcePath = colonIndex === -1 ? location : location.substring(0, colonIndex);
        await this.resolveDAPBreakpoints(sourcePath);
      }
    } catch {
      // If re-sync fails, revert the flag
      bp.enabled = false;
      throw new APIError(
        ErrorType.ProtocolError,
        ErrorCodes.ProtocolError,
        `Failed to enable breakpoint ${id}`,
        { id },
      );
    }
  }

  /**
   * Disable a breakpoint by ID.
   * DAP doesn't have a native enable/disable command, so we simulate it
   * by toggling the local enabled flag and re-syncing the breakpoints.
   */
  async disableBreakpoint(id: string): Promise<void> {
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }
    if (!bp.enabled) return;

    bp.enabled = false;

    // Re-sync the source file's breakpoints with DAP adapter (excluding this one)
    try {
      if (this.isConnected()) {
        const location = bp.location;
        const colonIndex = location.lastIndexOf(":");
        const sourcePath = colonIndex === -1 ? location : location.substring(0, colonIndex);
        await this.resolveDAPBreakpoints(sourcePath);
      }
    } catch {
      // If re-sync fails, revert the flag
      bp.enabled = true;
      throw new APIError(
        ErrorType.ProtocolError,
        ErrorCodes.ProtocolError,
        `Failed to disable breakpoint ${id}`,
        { id },
      );
    }
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    return Array.from(this.breakpointMap.values()).map((bp) => ({
      id: bp.id,
      location: bp.location,
      enabled: bp.enabled,
      hitCount: bp.hitCount,
    }));
  }

  async getBreakpointInfo(id: string): Promise<ExtendedBreakpointInfo> {
    if (!this.isConnected()) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected",
      );
    }
    // Check exception breakpoints first
    for (const [, bpId] of this.exceptionBreakpointMap.entries()) {
      if (bpId === id) {
        const bp = this.breakpointMap.get(id);
        if (!bp) break;
        return {
          id: bp.id,
          location: bp.location,
          enabled: bp.enabled,
          hitCount: bp.hitCount || 0,
          ignoreCount: 0,
          condition: null,
        };
      }
    }
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
      id: bp.id,
      location: bp.location,
      enabled: bp.enabled,
      hitCount: bp.hitCount || 0,
      ignoreCount: 0,
      condition: null,
    };
  }

  // ==================== Variable Inspection ====================

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    const dapThreadId = this.toDAPThreadId(threadId);

    // Step 1: Get stack trace to find frame IDs
    const stackResponse = await this.sendDAPRequest("stackTrace", {
      threadId: dapThreadId,
      startFrame: frameIndex,
      levels: 1,
    });
    const stackBody = stackResponse.body as { stackFrames?: Array<{ id: number }> } | undefined;
    if (!stackBody?.stackFrames || stackBody.stackFrames.length === 0 || !stackBody.stackFrames[0]) {
      return [];
    }

    const frameId = stackBody.stackFrames[0].id;

    // Step 2: Get scopes for the frame
    const scopesResponse = await this.sendDAPRequest("scopes", { frameId });
    const scopesBody = scopesResponse.body as { scopes?: Array<{ variablesReference: number; name: string }> } | undefined;
    if (!scopesBody?.scopes) {
      return [];
    }

    // Step 3: Get variables from the first scope (usually "Local")
    const localScope = scopesBody.scopes.find((s) => s.name === "Local") || scopesBody.scopes[0];
    if (!localScope || localScope.variablesReference === 0) {
      return [];
    }

    const variablesResponse = await this.sendDAPRequest("variables", {
      variablesReference: localScope.variablesReference,
    });
    const variablesBody = variablesResponse.body as { variables?: Array<{ name: string; value: string; type: string; variablesReference: number }> } | undefined;
    if (!variablesBody?.variables) {
      return [];
    }

    return variablesBody.variables.map((v) => ({
      name: v.name,
      type: v.type || typeof v.value,
      value: this.parseVariableValue(v.value, v.type, v.variablesReference),
      isPrimitive: v.variablesReference === 0,
      isNull: v.value === "null" || v.value === "undefined",
    }));
  }

  async fields(objectId: string): Promise<Variable[]> {
    const variablesReference = parseInt(objectId, 10);
    if (isNaN(variablesReference) || variablesReference === 0) {
      return [];
    }

    const response = await this.sendDAPRequest("variables", {
      variablesReference,
    });
    const body = response.body as { variables?: Array<{ name: string; value: string; type: string; variablesReference: number }> } | undefined;
    if (!body?.variables) {
      return [];
    }

    return body.variables.map((v) => ({
      name: v.name,
      type: v.type || typeof v.value,
      value: this.parseVariableValue(v.value, v.type, v.variablesReference),
      isPrimitive: v.variablesReference === 0,
      isNull: v.value === "null" || v.value === "undefined",
    }));
  }

  async setField(objectId: string, fieldId: string, value: unknown): Promise<void> {
    // Try DAP setVariable if the adapter supports it
    const variablesReference = parseInt(objectId, 10);
    if (!isNaN(variablesReference) && variablesReference > 0) {
      await this.sendDAPRequest("setVariable", {
        variablesReference,
        name: fieldId,
        value: String(value),
      });
      return;
    }
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "DAP setVariable requires a valid variablesReference",
    );
  }

  // ==================== Expression Evaluation ====================

  async eval(
    expression: string,
    threadId: string,
    frameIndex: number,
    _options?: EvalOptions,
  ): Promise<EvalResult> {
    const dapThreadId = this.toDAPThreadId(threadId);

    // Get the frame ID for evaluation context
    const stackResponse = await this.sendDAPRequest("stackTrace", {
      threadId: dapThreadId,
      startFrame: frameIndex,
      levels: 1,
    });
    const stackBody = stackResponse.body as { stackFrames?: Array<{ id: number }> } | undefined;
    if (!stackBody?.stackFrames || stackBody.stackFrames.length === 0 || !stackBody.stackFrames[0]) {
      throw new APIError(
        ErrorType.InternalError,
        ErrorCodes.NotImplemented,
        "No stack frame found for expression evaluation",
      );
    }

    const frameId = stackBody.stackFrames[0].id;
    const response = await this.sendDAPRequest("evaluate", {
      expression,
      frameId,
      context: "repl",
    });
    const body = response.body as { result?: unknown; type?: string; presentationHint?: string } | undefined;
    return {
      value: body?.result ?? null,
      type: body?.type || "unknown",
    };
  }

  // ==================== Feature Detection ====================

  /**
   * Parse capabilities from the DAP initialize response body
   */
  protected parseCapabilities(body: Record<string, unknown>): void {
    const capMap: Record<string, string> = {
      supportsConditionalBreakpoints: "conditionalBreakpoints",
      supportsSetVariable: "setVariable",
      supportsEvaluateForHovers: "evaluate",
      supportsExceptionInfoRequest: "exceptionInfo",
      supportsTerminateRequest: "terminate",
      supportsFunctionBreakpoints: "functionBreakpoints",
      supportsHitConditionalBreakpoints: "hitConditionalBreakpoints",
      supportsSteppingGranularity: "steppingGranularity",
      supportsValueFormattingOptions: "valueFormattingOptions",
      supportsReadMemoryRequest: "readMemory",
      supportsDisassembleRequest: "disassemble",
    };
    for (const [key, feature] of Object.entries(capMap)) {
      this.adapterCapabilities[feature] = body[key] === true;
    }
  }

  /**
   * Recursively expand variable fields using DAP VariablesReference chain
   * @param objectId - DAP variablesReference (as string)
   * @param depth - Recursion depth (default: 1)
   * @param maxChildren - Maximum children to fetch at each level (default: 50)
   * @returns Array of ExpandedVariable with nested children
   */
  async expandVariable(objectId: string, depth: number = 1, maxChildren: number = 50): Promise<ExpandedVariable[]> {
    const ref = parseInt(objectId, 10);
    if (isNaN(ref) || ref <= 0) {
      return [];
    }

    const response = await this.sendDAPRequest("variables", {
      variablesReference: ref,
      count: maxChildren,
    });
    const body = response.body as { variables?: Array<{ name: string; value: string; type?: string; variablesReference?: number }> } | undefined;
    if (!body?.variables || !Array.isArray(body.variables)) {
      return [];
    }

    const result: ExpandedVariable[] = [];
    for (const v of body.variables) {
      const entry: ExpandedVariable = {
        name: v.name,
        type: v.type ?? typeof v.value,
        value: v.value,
        isPrimitive: !v.variablesReference || v.variablesReference <= 0,
        isNull: v.value === "null" || v.value === "undefined" || v.value === null,
      };

      if (!entry.isPrimitive && depth > 1) {
        entry.objectId = String(v.variablesReference);
        entry.children = await this.expandVariable(String(v.variablesReference), depth - 1, maxChildren);
      }

      result.push(entry);
    }

    return result;
  }

  /**
   * Get batch thread information using DAP threads + stackTrace
   * @param threadId - Thread ID to query
   * @returns ThreadBatchInfo with function/file/line info for each frame
   */
  async getThreadBatchInfo(threadId: string, maxLevels: number = 200): Promise<ThreadBatchInfo> {
    const dapThreadId = this.toDAPThreadId(threadId);
    const response = await this.sendDAPRequest("stackTrace", {
      threadId: dapThreadId,
      startFrame: 0,
      levels: maxLevels,
    });
    const body = response.body as { stackFrames?: Array<{ name: string; source?: { path?: string }; line: number; instructionPointerReference?: string }> } | undefined;
    if (!body?.stackFrames) {
      return {
        threadId,
        functions: [],
        files: [],
        lines: [],
        addresses: [],
        modules: [],
      };
    }

    const functions: string[] = [];
    const files: string[] = [];
    const lines: number[] = [];
    const addresses: bigint[] = [];

    for (const frame of body.stackFrames) {
      functions.push(frame.name);
      files.push(frame.source?.path ?? "unknown");
      lines.push(frame.line);
      // Use instructionPointerReference when available, fall back to 0
      const addr = frame.instructionPointerReference
        ? parseInt(frame.instructionPointerReference, 16) || 0
        : 0;
      addresses.push(BigInt(addr));
    }

    // Try to get module names from DAP modules request (best-effort)
    let modules: string[] = [];
    try {
      const modResponse = await this.sendDAPRequest("modules");
      const modBody = modResponse.body as { modules?: Array<{ name: string }> } | undefined;
      if (modBody?.modules) {
        modules = modBody.modules.map(m => m.name);
      }
    } catch {
      // Modules unavailable
    }

    return {
      threadId,
      functions,
      files,
      lines,
      addresses,
      modules,
    };
  }

  /**
   * Get symbol information using DAP stackTrace and evaluate (best-effort)
   * @param threadId - Thread ID for context
   * @param frameIndex - Stack frame index
   * @param symbolName - Optional symbol name to query
   * @param fuzzyMatch - Enable fuzzy matching (not supported in DAP base)
   * @returns SymbolInfo with basic symbol details
   */
  async getSymbol(threadId: string, frameIndex: number, symbolName?: string, _fuzzyMatch?: boolean): Promise<SymbolInfo> {
    if (!symbolName) {
      // Get current frame context to find the function name
      try {
        const dapThreadId = this.toDAPThreadId(threadId);
        const response = await this.sendDAPRequest("stackTrace", {
          threadId: dapThreadId,
          startFrame: frameIndex,
          levels: 1,
        });
        const body = response.body as { stackFrames?: Array<{ name: string }> } | undefined;
        if (body?.stackFrames?.[0]) {
          return {
            name: body.stackFrames[0].name,
            type: "code",
            address: 0,
            size: 0,
            module: this.adapterConfig.name,
          };
        }
      } catch {
        // Fall through
      }
    } else {
      // Try to evaluate the symbol name in the correct frame context
      try {
        const dapThreadId = this.toDAPThreadId(threadId);
        // First get the frame ID for proper evaluation context
        const stackResponse = await this.sendDAPRequest("stackTrace", {
          threadId: dapThreadId,
          startFrame: frameIndex,
          levels: 1,
        });
        const stackBody = stackResponse.body as { stackFrames?: Array<{ id: number; instructionPointerReference?: string }> } | undefined;
        const frameId = stackBody?.stackFrames?.[0]?.id;

        const evalArgs: Record<string, unknown> = {
          expression: symbolName,
          context: "repl",
        };
        if (frameId !== undefined) {
          evalArgs.frameId = frameId;
        }
        const response = await this.sendDAPRequest("evaluate", evalArgs);
        const body = response.body as { result?: string; type?: string } | undefined;
        if (body) {
          const address = stackBody?.stackFrames?.[0]?.instructionPointerReference
            ? parseInt(stackBody.stackFrames[0].instructionPointerReference, 16) || 0
            : 0;
          return {
            name: symbolName,
            type: "data",
            address,
            size: 0,
            module: this.adapterConfig.name,
          };
        }
      } catch {
        // Fall through
      }
    }

    throw new APIError(
      ErrorType.CommandError,
      ErrorCodes.ResourceNotFound,
      `Symbol '${symbolName ?? "<current>"}' not found`,
      { threadId, frameIndex, symbolName },
    );
  }

  /**
   * Get type information using DAP evaluate and variablesReference
   * @param typeName - Type name to query
   * @param includeFields - Whether to include fields
   * @returns TypeInfo with type details
   */
  async getTypeInfo(typeName: string, includeFields?: boolean, _includeTemplateArgs?: boolean): Promise<TypeInfo> {
    // Use typeof to get language-level type information, then try to get fields
    let typeResult = "";
    let evalBody: { result?: string; type?: string; variablesReference?: number } | undefined;
    let fields: TypeInfo["fields"] = [];

    try {
      // Step 1: Try typeof first (works for any identifier, doesn't need to be a variable)
      const typeofResponse = await this.sendDAPRequest("evaluate", {
        expression: `typeof ${typeName}`,
        context: "repl",
      });
      const typeofBody = typeofResponse.body as { result?: string } | undefined;
      typeResult = typeofBody?.result ?? "";
    } catch {
      // typeof failed, will try other approaches
    }

    // Step 2: Try to evaluate the expression for variablesReference (for field resolution)
    if (includeFields || !typeResult) {
      try {
        const evalResponse = await this.sendDAPRequest("evaluate", {
          expression: typeName,
          context: "repl",
        });
        evalBody = evalResponse.body as { result?: string; type?: string; variablesReference?: number } | undefined;

        if (!typeResult && evalBody?.type) {
          typeResult = evalBody.type;
        }

        // If we have a variablesReference, use it to get detailed field info
        if (includeFields && evalBody?.variablesReference && evalBody.variablesReference > 0) {
          fields = await this.resolveTypeFieldsFromVarRef(evalBody.variablesReference);
        }
      } catch {
        // Evaluate failed, use what we have from typeof
      }
    }

    if (!typeResult) {
      typeResult = "unknown";
    }

    return {
      name: typeName,
      byteSize: 0,
      isPointer: typeResult.includes("pointer"),
      isArray: typeResult.includes("array") || typeResult.includes("Array") || (evalBody?.result?.startsWith("[") === true),
      isStruct: typeResult.includes("object") || typeResult.includes("Object"),
      isClass: typeResult.includes("class") || typeResult.includes("function"),
      isUnion: false,
      isEnumeration: false,
      numTemplateArgs: 0,
      templateArgs: [],
      fields,
      baseClasses: [],
      enumValues: [],
    };
  }

  /**
   * Resolve type fields via DAP variablesReference chain
   */
  private async resolveTypeFieldsFromVarRef(variablesReference: number): Promise<TypeInfo["fields"]> {
    try {
      const response = await this.sendDAPRequest("variables", {
        variablesReference,
      });
      const body = response.body as { variables?: Array<{ name: string; value: string; type?: string; variablesReference?: number }> } | undefined;
      if (body?.variables) {
        return body.variables.map(v => ({
          name: v.name,
          typeName: v.type ?? "unknown",
          offset: 0,
          byteSize: 0,
          isStatic: false,
        }));
      }
    } catch {
      // Ignore errors
    }
    return [];
  }

  /**
   * Check if a specific feature is supported by the adapter
   * Bridges between FeatureNames (from ExtendedDebugProtocol) and DAP adapter capabilities.
   * @param feature - Feature name (FeatureNames constant, or DAP capability name)
   * @returns true if the feature is supported
   */
  supportsFeature(feature: string): boolean {
    // Map FeatureNames to DAP adapter capabilities
    const featureNameToDAP: Record<string, string> = {
      eval: "evaluate",
      symbolInfo: "", // DAP doesn't support symbol query natively
    };

    // Features that are always supported by BaseDAPClient
    const alwaysSupported: Record<string, boolean> = {
      extendedBreakpointInfo: true,
      targetMetadata: true,
      threadBatchInfo: true,
      typeInfo: true,
      expandVariable: true,
      enableDisableBreakpoint: true,
      symbolInfo: true,
    };

    // Features that are never supported by DAP
    const neverSupported: Record<string, boolean> = {};

    // Check always-supported features first
    if (feature in alwaysSupported) {
      return alwaysSupported[feature]!;
    }

    // Check never-supported features
    if (feature in neverSupported) {
      return false;
    }

    // Map to DAP capability name and check or fall through to adapterCapabilities
    const dapCapability = featureNameToDAP[feature];
    if (dapCapability) {
      return this.adapterCapabilities[dapCapability] ?? false;
    }

    // Direct check in adapterCapabilities (for DAP-specific feature names)
    return this.adapterCapabilities[feature] ?? false;
  }

  // ==================== P2: Advanced Debug Queries ====================

  /**
   * Get exception information for a thread
   * @param threadId - Thread ID to query
   * @returns Exception details (type, message, stack trace)
   */
  async exceptionInfo(threadId: string): Promise<{
    id: number;
    description: string;
    breakMode: string;
    details?: {
      message?: string;
      typeName?: string;
      stackTrace?: string;
    };
  }> {
    const dapThreadId = this.toDAPThreadId(threadId);
    const response = await this.sendDAPRequest("exceptionInfo", {
      threadId: dapThreadId,
    });
    const body = response.body as {
      exceptionId?: number;
      description?: string;
      breakMode?: string;
      details?: { message?: string; typeName?: string; stackTrace?: string };
    } | undefined;
    return {
      id: body?.exceptionId ?? 0,
      description: body?.description ?? "",
      breakMode: body?.breakMode ?? "unhandled",
      details: body?.details,
    };
  }

  /**
   * Get list of loaded source files
   * @returns List of source file paths
   */
  async loadedSources(): Promise<string[]> {
    const response = await this.sendDAPRequest("loadedSources");
    const body = response.body as { sources?: Array<{ path?: string; name?: string }> } | undefined;
    if (!body?.sources) {
      return [];
    }
    return body.sources.map((s) => s.path ?? s.name ?? "unknown");
  }

  /**
   * Query valid breakpoint locations in a source file
   * @param sourcePath - Path to the source file
   * @param line - Optional line number to query around
   * @returns Array of valid breakpoint line numbers
   */
  async breakpointLocations(sourcePath: string, line?: number): Promise<number[]> {
    const args: Record<string, unknown> = {
      source: { path: sourcePath },
    };
    if (line !== undefined) {
      args["line"] = line;
    }
    const response = await this.sendDAPRequest("breakpointLocations", args);
    const body = response.body as { breakpoints?: Array<{ line: number }> } | undefined;
    if (!body?.breakpoints) {
      return [];
    }
    return body.breakpoints.map((bp) => bp.line);
  }

  // ==================== P3: Lifecycle Extensions ====================

  /**
   * Terminate the debuggee process
   * @param restart - Whether to restart after termination
   */
  async terminate(restart?: boolean): Promise<void> {
    await this.sendDAPRequest("terminate", {
      restart: restart ?? false,
    });
  }

  /**
   * Get list of loaded modules
   * @returns List of module information
   */
  async modules(): Promise<Array<{
    id: number | string;
    name: string;
    path?: string;
    version?: string;
    isOptimized?: boolean;
  }>> {
    const response = await this.sendDAPRequest("modules");
    const body = response.body as { modules?: Array<{
      id: number | string;
      name: string;
      path?: string;
      version?: string;
      isOptimized?: boolean;
    }> } | undefined;
    return body?.modules ?? [];
  }

  // ==================== Event Handling ====================

  async waitForEvent(timeout?: number): Promise<DebugEvent | null> {
    const startTime = Date.now();
    const effectiveTimeout = timeout ?? this.config.timeout;

    // First check if we have queued events
    if (this.eventQueue.length > 0) {
      return this.eventQueue.shift() ?? null;
    }

    // Wait for events to appear in the queue
    while (Date.now() - startTime < effectiveTimeout) {
      if (this.eventQueue.length > 0) {
        return this.eventQueue.shift() ?? null;
      }
      await this.delay(50);
    }

    return null;
  }

  // ==================== Protected Helpers ====================

  /**
   * Override to provide DAP variable value parsing
   */
  protected parseVariableValue(value: string, type: string, _variablesReference: number): unknown {
    // DAP returns values as strings - try to parse common types
    if (value === "null" || value === "undefined") {
      return value;
    }
    if (type === "number") {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    if (type === "boolean") {
      return value === "true";
    }
    // For objects, return a summary string
    if (_variablesReference > 0) {
      return value; // e.g., "{...}" or "[...]"
    }
    return value;
  }

  /**
   * Send a DAP request through the transport
   */
  protected async sendDAPRequest(command: string, args?: unknown) {
    if (!this.transport || !this.connected) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected to DAP adapter",
      );
    }
    return this.transport.sendRequest(command, args);
  }

  /**
   * Resolve a source path by syncing all enabled breakpoints for the source to DAP adapter.
   * This follows DAP protocol: breakpoints are set per-source and replaced on every update.
   */
  protected async resolveDAPBreakpoints(sourcePath: string): Promise<Array<{ id: number; verified: boolean }>> {
    // Get all enabled breakpoints for this source
    const sourceBpIds = this.breakpointSourceMap.get(sourcePath);
    const enabledBps: Array<{ line: number; condition?: string }> = [];

    if (sourceBpIds) {
      for (const bpId of sourceBpIds) {
        const bp = this.breakpointMap.get(bpId);
        if (bp && bp.enabled) {
          // Parse line from location "file:line"
          const colonIndex = bp.location.lastIndexOf(":");
          const lineStr = colonIndex === -1 ? "1" : bp.location.substring(colonIndex + 1);
          const line = parseInt(lineStr, 10);
          if (!isNaN(line)) {
            if (bp.condition) {
              enabledBps.push({ line, condition: bp.condition });
            } else {
              enabledBps.push({ line });
            }
          }
        }
      }
    }

    // Send all enabled breakpoints for this source to DAP (replaces all previous)
    const response = await this.sendDAPRequest("setBreakpoints", {
      source: { path: sourcePath },
      breakpoints: enabledBps,
    });
    const body = response.body as { breakpoints?: Array<{ id: number; verified: boolean; line: number }> } | undefined;

    const dapBps = body?.breakpoints || [];

    // Update the dapId in our local map to match what the adapter assigned
    let i = 0;
    if (sourceBpIds) {
      for (const bpId of sourceBpIds) {
        const bp = this.breakpointMap.get(bpId);
        if (bp && bp.enabled && i < dapBps.length) {
          const dapBp = dapBps[i];
          if (dapBp) {
            bp.dapId = dapBp.id;
          }
        }
        i++;
      }
    }

    return dapBps;
  }

  /**
   * Map DAP thread IDs to local thread IDs
   */
  protected toLocalThreadId(dapThreadId: number): string {
    const strId = String(dapThreadId);
    if (!this.threadMap.has(dapThreadId)) {
      this.threadMap.set(dapThreadId, strId);
    }
    return strId;
  }

  /**
   * Map local thread ID back to DAP thread ID
   */
  protected toDAPThreadId(localId: string): number {
    // Try direct conversion
    const directId = parseInt(localId, 10);
    if (!isNaN(directId) && this.threadMap.has(directId)) {
      return directId;
    }
    // Search map
    for (const [dapId, local] of this.threadMap.entries()) {
      if (local === localId) {
        return dapId;
      }
    }
    // Default: use the parsed integer value
    return directId;
  }

  // ==================== Event Handlers ====================

  private handleStoppedEvent(event: DAPEvent): void {
    const body = event.body as { threadId?: number; reason?: string; hitBreakpointIds?: number[] } | undefined;
    const threadId = body?.threadId !== undefined
      ? this.toLocalThreadId(body.threadId)
      : "unknown";
    const reason = body?.reason || "unknown";

    // Update hit counts for breakpoints
    if (body?.hitBreakpointIds) {
      for (const dapBpId of body.hitBreakpointIds) {
        for (const [, bp] of this.breakpointMap) {
          if (bp.dapId === dapBpId) {
            bp.hitCount++;
          }
        }
      }
    }

    this.enqueueEvent({
      type: "breakpoint",
      threadId,
      location: reason,
      timestamp: new Date(),
      data: event.body,
    });
  }

  private handleContinuedEvent(event: DAPEvent): void {
    const body = event.body as { threadId?: number } | undefined;
    const threadId = body?.threadId !== undefined
      ? this.toLocalThreadId(body.threadId)
      : "unknown";

    this.enqueueEvent({
      type: "state",
      threadId,
      location: "continued",
      timestamp: new Date(),
      data: event.body,
    });
  }

  private handleOutputEvent(event: DAPEvent): void {
    const body = event.body as { output?: string; category?: string; threadId?: number } | undefined;
    const threadId = body?.threadId !== undefined
      ? this.toLocalThreadId(body.threadId)
      : "unknown";

    this.enqueueEvent({
      type: "output",
      threadId,
      location: "output",
      timestamp: new Date(),
      data: {
        data: [body?.output || ""],
        stream: body?.category === "stderr" ? "stderr" : "stdout",
      },
    });
  }

  private handleBreakpointEvent(_event: DAPEvent): void {
    // DAP breakpoint events are usually about breakpoint verification
    // We handle breakpoint hits via stopped events
  }

  // ==================== Extended Features ====================

  private handleTerminatedEvent(): void {
    this.connected = false;
  }

  private handleThreadEvent(event: DAPEvent): void {
    const body = event.body as { threadId?: number; reason?: string } | undefined;
    const threadId = body?.threadId !== undefined
      ? this.toLocalThreadId(body.threadId)
      : "unknown";

    this.enqueueEvent({
      type: "thread",
      threadId,
      location: body?.reason || "started",
      timestamp: new Date(),
      data: event.body,
    });
  }

  private enqueueEvent(event: DebugEvent): void {
    if (this.eventQueue.length >= BaseDAPClient.MAX_EVENT_QUEUE) {
      this.eventQueue.shift(); // Drop oldest event to keep queue bounded
    }
    this.eventQueue.push(event);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}