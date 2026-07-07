/**
 * Debugger — Main SDK Class
 *
 * The primary entry point for programmatic debugging.
 * Provides a chainable, event-driven API over the existing protocol layer.
 *
 * @example
 * ```ts
 * // Connect and debug
 * const dbg = await Debugger.connect({ protocol: 'jdwp', port: 5005 });
 *
 * await dbg.breakpoint('com.example.App:42');
 * await dbg.continue();
 *
 * dbg.on('breakpoint', (event) => {
 *   console.log('Hit:', event.location);
 * });
 * ```
 */

import { SessionManager } from "../session/manager.js";
import type { AutoContext } from "../session/manager.js";
import type { DebugProtocol } from "../protocol/base.js";
import type { ExtendedDebugProtocol } from "../protocol/extended.js";
import type { EvalOptions, EvalResult } from "../protocol/extended.js";
import type {
  DebugConfig,
  PartialDebugConfig,
} from "../types/config.js";
import { DebugConfigSchema } from "../types/config.js";
import type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
} from "../types/debug.js";
import { DebuggerEventEmitter } from "./events.js";
import type { SdkEventMap } from "./events.js";
import { createQuery } from "./query/index.js";
import type { QueryModule, VariableDetail } from "./query/index.js";
import { createAssert } from "./assert/index.js";
import type { AssertModule } from "./assert/index.js";
import { createFormat } from "./format/index.js";
import type { FormatModule } from "./format/index.js";
import { ConfigBuilder } from "./config/builder.js";

// ─── Watch Types ─────────────────────────────────────────────────────────────

/** Options for variable/expression watching */
export interface WatchOptions {
  interval?: number;
  timeout?: number;
  threadId?: string;
  frameIndex?: number;
}

/** Handle returned by watchVariable/watchExpression for cancellation */
export interface WatchHandle {
  /** Cancel the watch */
  cancel(): void;
  /** Whether the watch is still active */
  active: boolean;
}

/** Options for breakpoint setting */
export interface BreakpointOptions {
  condition?: string;
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
    | "thread-death";
}

/** Options for variable inspection */
export interface InspectOptions {
  threadId?: string;
  frameIndex?: number;
  depth?: number;
}

// ─── Debugger Main Class ─────────────────────────────────────────────────────

/**
 * High-level debugger client for programmatic debugging.
 *
 * Features:
 * - Chainable API: `Debugger.connect().breakpoint().continue()`
 * - Event-driven: subscribe to breakpoint, output, thread, state events
 * - Auto-context: mutation commands return full context
 * - Query module: rich data inspection with filtering
 */
export class Debugger {
  private manager: SessionManager;
  private _events = new DebuggerEventEmitter();
  private _query: QueryModule | null = null;
  private _assert: AssertModule | null = null;
  private _config: DebugConfig;
  private _connected = false;
  private _state: "connected" | "disconnected" | "running" | "paused" = "disconnected";

  // ─── Construction ───

  /**
   * Create a Debugger instance (not connected).
   * Use `connect()` or `Debugger.connect()` to establish a connection.
   */
  constructor(config: DebugConfig | PartialDebugConfig) {
    this._config = DebugConfigSchema.parse(config);
    this.manager = new SessionManager();
  }

  /**
   * Create and connect a Debugger instance in one step.
   *
   * @param config - Debug configuration or protocol name string
   * @returns Connected Debugger instance
   *
   * @example
   * ```ts
   * const dbg = await Debugger.connect({ protocol: 'jdwp', port: 5005 });
   * const dbg2 = await Debugger.connect('jdwp'); // uses defaults
   * ```
   */
  static async connect(
    config: DebugConfig | PartialDebugConfig | string,
  ): Promise<Debugger> {
    const cfg =
      typeof config === "string"
        ? DebugConfigSchema.parse({ protocol: config })
        : DebugConfigSchema.parse(config);
    const dbg = new Debugger(cfg);
    await dbg.connect();
    return dbg;
  }

  /**
   * Create a Debugger using a ConfigBuilder.
   *
   * @example
   * ```ts
   * const dbg = await Debugger.from(builder => builder
   *   .protocol('jdwp')
   *   .port(5005)
   *   .host('127.0.0.1')
   * );
   * ```
   */
  static async from(
    configure: (builder: ConfigBuilder) => ConfigBuilder,
  ): Promise<Debugger> {
    const builder = new ConfigBuilder();
    const config = configure(builder).build();
    return Debugger.connect(config);
  }

  /**
   * Create a Debugger using a preset.
   *
   * @example
   * ```ts
   * const dbg = await Debugger.preset(Presets.jdwp(5005));
   * ```
   */
  static async preset(config: DebugConfig): Promise<Debugger> {
    return Debugger.connect(config);
  }

  // ─── Connection Management ───

  /**
   * Connect to the debug target.
   * The config was provided at construction time.
   */
  async connect(): Promise<this> {
    if (this._connected) {
      throw new Error("Already connected");
    }
    const sessionId = await this.manager.createSession(this._config);
    const session = this.manager.getSession(sessionId);
    if (!session) {
      throw new Error("Failed to create session");
    }
    this._connected = true;
    this._state = "paused";
    this._events.startPolling(session.client);
    return this;
  }

  /**
   * Disconnect from the debug target.
   */
  async disconnect(): Promise<void> {
    if (!this._connected) return;
    this._events.stopPolling();
    await this.manager.closeAllSessions();
    this._connected = false;
    this._state = "disconnected";
  }

  /**
   * Whether the debugger is currently connected.
   */
  get isConnected(): boolean {
    return this._connected;
  }

  /**
   * Get the current connection state.
   */
  getState(): "connected" | "disconnected" | "running" | "paused" {
    return this._state;
  }

  /**
   * Get the debug configuration.
   */
  get config(): DebugConfig {
    return { ...this._config };
  }

  // ─── Internal Helpers ───

  private requireClient(): DebugProtocol {
    const client = this.manager.getCurrentClient();
    if (!client) {
      throw new Error("No active debug session");
    }
    return client;
  }

  private requireExtendedClient(): ExtendedDebugProtocol {
    const client = this.requireClient();
    const extended = client as ExtendedDebugProtocol;
    return extended;
  }

  private async resolveThreadId(threadId?: string): Promise<string> {
    if (threadId) {
      this.manager.setActiveThread(threadId);
      return threadId;
    }
    const active = this.manager.getActiveThread();
    if (active) return active;

    const client = this.requireClient();
    const threads = await client.threads();
    if (threads.length === 0) {
      throw new Error("No threads available");
    }
    const first = threads[0]!.id;
    this.manager.setActiveThread(first);
    return first;
  }

  private async buildAutoContext(
    threadId?: string,
    options?: {
      includeSource?: boolean;
      includeLocals?: boolean;
      includeStack?: boolean;
    },
  ): Promise<AutoContext> {
    const client = this.requireClient();
    const ctx: AutoContext = {};
    const tid = threadId ?? this.manager.getActiveThread();
    const opts = {
      includeSource: true,
      includeLocals: true,
      includeStack: true,
      ...options,
    };

    try {
      const threads = await client.threads();
      ctx.threads = threads;

      if (tid) {
        const currentThread = threads.find((t) => t.id === tid);
        if (currentThread) {
          ctx.thread = currentThread;
        }

        if (opts.includeStack) {
          const frames = await client.stack(tid);
          ctx.stack = frames;

          const topFrame = frames[0];
          if (topFrame) {
            ctx.location = {
              file: topFrame.location,
              line: topFrame.line,
              method: topFrame.method,
            };

            if (opts.includeLocals) {
              const frameIndex = this.manager.getActiveFrameIndex();
              ctx.locals = await client.locals(tid, frameIndex);
            }
          }
        }
      }
    } catch {
      // Partial context is fine
    }

    return ctx;
  }

  // ─── Event System ───

  /**
   * Subscribe to a debug event.
   *
   * @example
   * ```ts
   * dbg.on('breakpoint', (event) => console.log(event.location));
   * dbg.on('output', (event) => console.log(event.data));
   * ```
   */
  on<K extends keyof SdkEventMap>(event: K, handler: SdkEventMap[K]): this;
  on(event: string, handler: (...args: unknown[]) => void): this;
  on(event: string, handler: (...args: unknown[]) => void): this {
    this._events.on(event, handler);
    return this;
  }

  /**
   * Unsubscribe from a debug event.
   */
  off<K extends keyof SdkEventMap>(event: K, handler: SdkEventMap[K]): this;
  off(event: string, handler: (...args: unknown[]) => void): this;
  off(event: string, handler: (...args: unknown[]) => void): this {
    this._events.off(event, handler);
    return this;
  }

  /**
   * Subscribe to a one-time debug event.
   */
  once<K extends keyof SdkEventMap>(event: K, handler: SdkEventMap[K]): this;
  once(event: string, handler: (...args: unknown[]) => void): this;
  once(event: string, handler: (...args: unknown[]) => void): this {
    this._events.once(event, handler);
    return this;
  }

  /**
   * Access the underlying event emitter for advanced use.
   */
  get events(): DebuggerEventEmitter {
    return this._events;
  }

  // ─── Execution Control ───

  /**
   * Continue execution of the target.
   * @param threadId - Specific thread to continue (defaults to active thread)
   * @returns Auto-context with current state
   */
  async continue(threadId?: string): Promise<AutoContext> {
    const client = this.requireClient();
    const tid = await this.resolveThreadId(threadId);
    await client.resume(tid);
    this._state = "running";
    return this.buildAutoContext(tid);
  }

  /**
   * Pause (suspend) execution of the target.
   * @param threadId - Specific thread to pause (defaults to all)
   * @returns Auto-context with current state
   */
  async pause(threadId?: string): Promise<AutoContext> {
    const client = this.requireClient();
    await client.suspend(threadId);
    this._state = "paused";
    const tid = threadId ?? this.manager.getActiveThread();
    return this.buildAutoContext(tid);
  }

  /**
   * Step into the current line.
   * @param threadId - Specific thread (defaults to active thread)
   * @returns Auto-context with current state
   */
  async stepInto(threadId?: string): Promise<AutoContext> {
    const client = this.requireClient();
    const tid = await this.resolveThreadId(threadId);
    await client.stepInto(tid);
    this._state = "paused";
    return this.buildAutoContext(tid);
  }

  /**
   * Step over the current line.
   * @param threadId - Specific thread (defaults to active thread)
   * @returns Auto-context with current state
   */
  async stepOver(threadId?: string): Promise<AutoContext> {
    const client = this.requireClient();
    const tid = await this.resolveThreadId(threadId);
    await client.stepOver(tid);
    this._state = "paused";
    return this.buildAutoContext(tid);
  }

  /**
   * Step out of the current function.
   * @param threadId - Specific thread (defaults to active thread)
   * @returns Auto-context with current state
   */
  async stepOut(threadId?: string): Promise<AutoContext> {
    const client = this.requireClient();
    const tid = await this.resolveThreadId(threadId);
    await client.stepOut(tid);
    this._state = "paused";
    return this.buildAutoContext(tid);
  }

  // ─── Breakpoint Management ───

  /**
   * Set a breakpoint.
   * @param location - Breakpoint location (e.g. "file.ts:42" or "com.example.App:42")
   * @param options - Optional breakpoint configuration
   * @returns Breakpoint ID
   *
   * @example
   * ```ts
   * const bpId = await dbg.breakpoint('com.example.App:42');
   * const bpId = await dbg.breakpoint('main.go:10', { condition: 'i > 5' });
   * ```
   */
  async breakpoint(
    location: string,
    options?: BreakpointOptions,
  ): Promise<string> {
    const client = this.requireClient();
    return client.setBreakpoint(location, options?.condition, options?.type);
  }

  /**
   * Get all breakpoints.
   */
  async breakpoints(): Promise<BreakpointInfo[]> {
    const client = this.requireClient();
    return client.breakpoints();
  }

  /**
   * Remove a breakpoint by ID.
   * @param id - Breakpoint ID
   */
  async removeBreakpoint(id: string): Promise<void> {
    const client = this.requireClient();
    await client.removeBreakpoint(id);
  }

  /**
   * Clear all breakpoints.
   */
  async clearBreakpoints(): Promise<void> {
    const client = this.requireClient();
    await client.clearBreakpoints();
  }

  // ─── Data Query ───

  /**
   * Get local variables for the current scope.
   * @param threadId - Thread ID (defaults to active thread)
   * @param frameIndex - Stack frame index (defaults to active frame)
   */
  async locals(threadId?: string, frameIndex?: number): Promise<Variable[]> {
    const client = this.requireClient();
    const tid = await this.resolveThreadId(threadId);
    const fi = frameIndex ?? this.manager.getActiveFrameIndex();
    return client.locals(tid, fi);
  }

  /**
   * Evaluate an expression in the debug target.
   * @param expression - Expression to evaluate
   * @param options - Evaluation options
   * @returns Evaluation result
   */
  async evaluate(
    expression: string,
    options?: EvalOptions,
  ): Promise<EvalResult> {
    const client = this.requireExtendedClient();
    const tid = await this.resolveThreadId();
    const frameIndex = this.manager.getActiveFrameIndex();

    if (typeof client.eval !== "function") {
      throw new Error(
        `Expression evaluation is not supported by the '${this._config.protocol}' protocol`,
      );
    }

    return client.eval(expression, tid, frameIndex, options);
  }

  /**
   * Inspect a variable in detail.
   * @param name - Variable name
   * @param options - Inspection options
   * @returns Variable details
   */
  async inspect(
    name: string,
    options?: InspectOptions,
  ): Promise<VariableDetail | undefined> {
    return this.query.variable(name, {
      threadId: options?.threadId,
      frameIndex: options?.frameIndex,
    });
  }

  /**
   * Get all threads.
   */
  async threads(): Promise<ThreadInfo[]> {
    const client = this.requireClient();
    return client.threads();
  }

  /**
   * Get stack frames for a thread.
   * @param threadId - Thread ID (defaults to active thread)
   */
  async stack(threadId?: string): Promise<StackFrame[]> {
    const client = this.requireClient();
    const tid = await this.resolveThreadId(threadId);
    return client.stack(tid);
  }

  // ─── Query Module ───

  /**
   * Access the query module for rich data inspection.
   *
   * Provides methods like:
   * - `query.variable(name)` — get variable details
   * - `query.findVariable(pattern)` — search variables
   * - `query.thread(id)` — get thread info
   * - `query.stack(id, filter)` — filtered stack frames
   * - `query.sourceContext()` — source context
   * - `query.breakpoints(filter)` — filtered breakpoints
   * - `query.metadata()` — target metadata
   */
  get query(): QueryModule {
    if (!this._query) {
      this._query = createQuery(
        () => this.manager.getCurrentClient(),
        () => this.manager.getActiveThread(),
        () => this.manager.getActiveFrameIndex(),
      );
    }
    return this._query;
  }

  /**
   * Access the assert module for debugger automation testing.
   *
   * Provides timeout-based assertions:
   * - `assert.hitBreakpoint(id)` — wait for breakpoint hit
   * - `assert.variable(name, value)` — assert variable value
   * - `assert.paused()` — assert paused state
   * - `assert.topFrame(method)` — assert top stack frame
   *
   * @see createAssert for detailed API
   */
  get assert(): AssertModule {
    if (!this._assert) {
      this._assert = createAssert(this);
    }
    return this._assert;
  }

  /**
   * Access the format module for string-based debug data formatting.
   *
   * Provides methods to format variables, stack frames, threads, etc.
   * All methods return strings (no stdout side effects).
   *
   * @example
   * ```ts
   * const output = dbg.format.variables(await dbg.locals());
   * console.log(output);
   * ```
   */
  get format(): FormatModule {
    return createFormat();
  }

  // ─── Session Management ───

  /**
   * Switch the active thread.
   * @param threadId - Thread ID to switch to
   */
  useThread(threadId: string): this {
    this.manager.setActiveThread(threadId);
    return this;
  }

  /**
   * Switch the active stack frame.
   * @param frameIndex - Frame index to switch to
   */
  useFrame(frameIndex: number): this {
    this.manager.setActiveFrameIndex(frameIndex);
    return this;
  }

  /**
   * Get the active thread ID.
   */
  get activeThreadId(): string | undefined {
    return this.manager.getActiveThread();
  }

  /**
   * Get the active frame index.
   */
  get activeFrameIndex(): number {
    return this.manager.getActiveFrameIndex();
  }

  /**
   * Get session info.
   */
  get info(): { id: string | undefined; protocol: string; target: string } {
    const sessionInfo = this.manager.getCurrentSessionInfo();
    if (sessionInfo) {
      return {
        id: sessionInfo.id,
        protocol: sessionInfo.protocol,
        target: sessionInfo.target,
      };
    }
    return {
      id: undefined,
      protocol: this._config.protocol,
      target: `${this._config.host}:${this._config.port}`,
    };
  }

  // ─── Watch Mechanism ───

  /**
   * Watch a variable for changes.
   * The callback is invoked whenever the variable's value changes.
   *
   * @param name - Variable name to watch
   * @param callback - Called with the new value
   * @param options - Watch options (interval, timeout, etc.)
   * @returns A handle to cancel the watch
   *
   * @example
   * ```ts
   * const watch = await dbg.watchVariable('count', (value) => {
   *   console.log('count changed:', value);
   * });
   * // Later: watch.cancel();
   * ```
   */
  async watchVariable(
    name: string,
    callback: (value: unknown) => void,
    options?: WatchOptions,
  ): Promise<WatchHandle> {
    const interval = options?.interval ?? 200;
    const timeout = options?.timeout ?? 30000;
    let active = true;
    let lastValue: unknown = undefined;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (!active) return;
      try {
        const tid = options?.threadId ?? this.manager.getActiveThread();
        const frameIndex = options?.frameIndex ?? this.manager.getActiveFrameIndex();
        if (!tid) return;
        const locals = await this.requireClient().locals(tid, frameIndex);
        const variable = locals.find((v) => v.name === name);
        if (variable) {
          const newValue = variable.value;
          if (!Object.is(newValue, lastValue)) {
            lastValue = newValue;
            callback(newValue);
          }
        }
      } catch {
        // Ignore poll errors
      }
    };

    timer = setInterval(poll, interval);

    // Stop after timeout
    if (timeout > 0) {
      setTimeout(() => {
        if (active) {
          active = false;
          if (timer) clearInterval(timer);
        }
      }, timeout);
    }

    return {
      cancel: () => {
        active = false;
        if (timer) clearInterval(timer);
      },
      get active() {
        return active;
      },
    };
  }

  /**
   * Watch an expression for changes.
   * Requires the protocol to support expression evaluation.
   *
   * @param expr - Expression to evaluate and watch
   * @param callback - Called with the evaluation result
   * @param options - Watch options
   * @returns A handle to cancel the watch
   */
  async watchExpression(
    expr: string,
    callback: (result: EvalResult) => void,
    options?: WatchOptions,
  ): Promise<WatchHandle> {
    const client = this.requireExtendedClient();
    if (typeof client.eval !== "function") {
      throw new Error(
        `Expression evaluation is not supported by the '${this._config.protocol}' protocol`,
      );
    }

    const interval = options?.interval ?? 500;
    const timeout = options?.timeout ?? 30000;
    let active = true;
    let lastResult: string | undefined;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (!active) return;
      try {
        const tid = options?.threadId ?? this.manager.getActiveThread();
        const frameIndex = options?.frameIndex ?? this.manager.getActiveFrameIndex();
        if (!tid) return;
        const result = await client.eval!(expr, tid, frameIndex);
        const serialized = JSON.stringify(result.value);
        if (serialized !== lastResult) {
          lastResult = serialized;
          callback(result);
        }
      } catch {
        // Ignore poll errors
      }
    };

    timer = setInterval(poll, interval);

    if (timeout > 0) {
      setTimeout(() => {
        if (active) {
          active = false;
          if (timer) clearInterval(timer);
        }
      }, timeout);
    }

    return {
      cancel: () => {
        active = false;
        if (timer) clearInterval(timer);
      },
      get active() {
        return active;
      },
    };
  }

  /**
   * Cancel a watch by handle.
   */
  unwatch(handle: WatchHandle): void {
    handle.cancel();
  }
}

