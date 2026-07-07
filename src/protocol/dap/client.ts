/**
 * DAP (Debug Adapter Protocol) Client
 *
 * Implements the DebugProtocol interface using DAP messages.
 * This is a base class that debugpy and js-debug extend with
 * language-specific configurations.
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
import { DAPTransport, type DAPEvent } from "./transport.js";

/**
 * DAP-specific configuration (beyond base DebugConfig)
 */
export interface DAPAdapterConfig {
  /** Adapter name (e.g., "debugpy", "js-debug") */
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
export abstract class BaseDAPClient implements DebugProtocol {
  protected config: DebugConfig;
  protected adapterConfig: DAPAdapterConfig;
  protected transport: DAPTransport | null = null;
  protected connected = false;
  protected adapterID: string | null = null;
  protected threadMap = new Map<number, string>();
  protected nextThreadID = 1;
  protected breakpointMap = new Map<string, { id: string; dapId: number; location: string; enabled: boolean; hitCount: number }>();
  protected nextBreakpointId = 1;
  protected eventQueue: DebugEvent[] = [];
  protected eventQueueLocked = false;

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
      }

      // Step 2: Send Initialized event is received by adapter
      // (the adapter triggers it, we just wait)

      // Step 3: Launch
      await transport.sendRequest("launch", {
        ...this.adapterConfig.launchConfig,
        noDebug: false,
      });

      // Step 4: ConfigurationDone
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
    this.connected = false;
    if (this.transport) {
      const transport = this.transport;
      this.transport = null;
      await transport.close();
    }
    this.threadMap.clear();
    this.breakpointMap.clear();
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
    _condition?: string,
    _type?: "line" | "method-entry" | "method-exit" | "exception" | "field-access" | "field-modify" | "class-load" | "class-unload" | "thread-start" | "thread-death",
  ): Promise<string> {
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

    const dapBreakpoints = await this.resolveDAPBreakpoints(sourcePath, line);

    return String(dapBreakpoints[0]?.id || location);
  }

  async removeBreakpoint(id: string): Promise<void> {
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      return;
    }
    this.breakpointMap.delete(id);
    // DAP doesn't have a removeBreakpoint command - breakpoints are set per-source
    // They are removed by re-setting breakpoints without the removed one
  }

  async clearBreakpoints(): Promise<void> {
    this.breakpointMap.clear();
    // DAP doesn't have a clearBreakpoints command
    // Breakpoints are cleared per-source file
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    return Array.from(this.breakpointMap.values()).map((bp) => ({
      id: bp.id,
      location: bp.location,
      enabled: bp.enabled,
      hitCount: bp.hitCount,
    }));
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

  async setField(_objectId: string, _fieldId: string, _value: unknown): Promise<void> {
    throw new APIError(
      ErrorType.InternalError,
      ErrorCodes.NotImplemented,
      "DAP does not support setting field values",
    );
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
   * Resolve a source path and line number into DAP breakpoint IDs
   */
  protected async resolveDAPBreakpoints(sourcePath: string, line: number): Promise<Array<{ id: number; verified: boolean }>> {
    const response = await this.sendDAPRequest("setBreakpoints", {
      source: { path: sourcePath },
      breakpoints: [{ line }],
    });
    const body = response.body as { breakpoints?: Array<{ id: number; verified: boolean; line: number }> } | undefined;

    const dapBps = body?.breakpoints || [];
    for (const bp of dapBps) {
      const bpId = `bp_${this.nextBreakpointId++}`;
      this.breakpointMap.set(bpId, {
        id: bpId,
        dapId: bp.id,
        location: `${sourcePath}:${line}`,
        enabled: true,
        hitCount: 0,
      });
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
    this.eventQueue.push(event);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}