/**
 * SDK Event System
 *
 * Provides event-driven debugging with auto-polling.
 * Wraps the low-level waitForEvent() into a subscription-based model.
 */

import { EventEmitter } from "node:events";
import type { DebugProtocol } from "../protocol/base.js";
import type { DebugEvent } from "../types/debug.js";

// ─── Event Types ─────────────────────────────────────────────────────────────

/** Breakpoint hit event */
export interface BreakpointEvent {
  type: "breakpoint";
  id: string;
  location: string;
  threadId: string;
  timestamp: Date;
}

/** Program output event */
export interface OutputEvent {
  type: "output";
  threadId: string;
  data: string[];
  stream: "stdout" | "stderr";
}

/** Thread lifecycle event */
export interface ThreadEvent {
  type: "thread";
  threadId: string;
  action: "started" | "stopped" | "suspended" | "resumed";
}

/** State change event */
export interface StateEvent {
  type: "state";
  previous: string;
  current: string;
}

/** Error event */
export interface ErrorEvent {
  type: "error";
  code: number;
  message: string;
  context?: Record<string, unknown>;
}

/** Event map for type-safe handlers */
export interface SdkEventMap {
  breakpoint: (event: BreakpointEvent) => void;
  output: (event: OutputEvent) => void;
  thread: (event: ThreadEvent) => void;
  error: (event: ErrorEvent) => void;
  state: (event: StateEvent) => void;
}

// ─── Event Emitter ───────────────────────────────────────────────────────────

/**
 * Debugger event emitter with auto-polling support.
 *
 * Wraps the low-level DebugProtocol.waitForEvent() and dispatches
 * events to registered handlers via the Node.js EventEmitter pattern.
 */
export class DebuggerEventEmitter extends EventEmitter {
  private polling = false;
  private stopped = false;

  /**
   * Start polling the protocol client for events.
   * Events are dispatched to registered handlers automatically.
   */
  startPolling(client: DebugProtocol): void {
    if (this.polling) return;
    this.polling = true;
    this.stopped = false;
    this.pollLoop(client);
  }

  /**
   * Stop polling for events.
   */
  stopPolling(): void {
    this.stopped = true;
    this.polling = false;
  }

  /**
   * Whether the emitter is currently polling.
   */
  isPolling(): boolean {
    return this.polling;
  }

  private async pollLoop(client: DebugProtocol): Promise<void> {
    while (!this.stopped) {
      try {
        const event = await client.waitForEvent(200);
        if (event) {
          this.dispatch(event);
        }
      } catch {
        // Timeout is normal — continue polling
      }
    }
  }

  private dispatch(raw: DebugEvent): void {
    // Emit type-specific event
    this.emit(raw.type, raw);
    // Emit wildcard event
    this.emit("*", raw);
  }

  // ─── Type-safe event registration ───

  /** Register a handler for a specific event type */
  override on<K extends keyof SdkEventMap>(event: K, handler: SdkEventMap[K]): this;
  /** Register a handler for any event type */
  override on(event: string | symbol, handler: (...args: unknown[]) => void): this;
  override on(event: string | symbol, handler: (...args: unknown[]) => void): this {
    return super.on(event, handler);
  }

  /** Remove a handler */
  override off<K extends keyof SdkEventMap>(event: K, handler: SdkEventMap[K]): this;
  override off(event: string | symbol, handler: (...args: unknown[]) => void): this;
  override off(event: string | symbol, handler: (...args: unknown[]) => void): this {
    return super.off(event, handler);
  }

  /** Register a one-time handler */
  override once<K extends keyof SdkEventMap>(event: K, handler: SdkEventMap[K]): this;
  override once(event: string | symbol, handler: (...args: unknown[]) => void): this;
  override once(event: string | symbol, handler: (...args: unknown[]) => void): this {
    return super.once(event, handler);
  }
}