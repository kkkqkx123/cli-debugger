/**
 * @cli-debugger/sdk — Public API Entry Point
 *
 * The SDK provides a programmatic debugging API with:
 * - Debugger main class (chainable, event-driven)
 * - Query module (rich data inspection)
 * - Config builder (fluent configuration)
 * - Presets (pre-built configurations)
 * - Event system (subscription-based event handling)
 *
 * @example
 * ```ts
 * import { Debugger, Presets } from '@cli-debugger/sdk';
 *
 * const dbg = await Debugger.connect(Presets.jdwp(5005));
 * await dbg.breakpoint('com.example.App:42');
 * await dbg.continue();
 *
 * dbg.on('breakpoint', (event) => {
 *   console.log('Breakpoint hit at', event.location);
 * });
 * ```
 */

// ─── Main Class ───

export { Debugger } from "./debugger.js";
export type { WatchOptions, WatchHandle, BreakpointOptions, InspectOptions } from "./debugger.js";

// ─── Events ───

export { DebuggerEventEmitter } from "./events.js";
export type {
  BreakpointEvent,
  OutputEvent,
  ThreadEvent,
  StateEvent,
  ErrorEvent,
  SdkEventMap,
} from "./events.js";

// ─── Config ───

export { ConfigBuilder, Presets, detectProtocol } from "./config/index.js";
export type { DebugConfig } from "../types/config.js";

// ─── Query ───

export { createQuery } from "./query/index.js";
export type {
  QueryModule,
  QueryOptions,
  VariableDetail,
  SourceContext,
  StackFilter,
  BreakpointFilter,
} from "./query/index.js";

// ─── Assert ───

export { createAssert, AssertionError } from "./assert/index.js";
export type { AssertModule, AssertOptions, EvalAssertOptions, TopFrameOptions } from "./assert/index.js";

// ─── Format ───

export { createFormat } from "./format/index.js";
export type { FormatModule, FormatOptions } from "./format/index.js";

// ─── Re-exported Core Types ───

export type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from "../types/debug.js";

export type { EvalOptions, EvalResult } from "../protocol/extended.js";

export type { AutoContext } from "../session/manager.js";