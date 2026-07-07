/**
 * Format Module
 *
 * String-based formatting utilities for debug data.
 * Unlike the CLI formatter (which writes to stdout), this module
 * returns formatted strings that can be used programmatically.
 *
 * @example
 * ```ts
 * import { createFormat } from '@cli-debugger/sdk/format';
 *
 * const format = createFormat();
 * console.log(format.variables(locals));
 * console.log(format.table(['Name', 'Value'], [['count', '42']]));
 * ```
 */

import type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from "../../types/debug.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Options for formatting */
export interface FormatOptions {
  /** Whether to enable ANSI colors (default: false) */
  color?: boolean;
  /** Whether to truncate long values (default: true) */
  truncate?: boolean;
  /** Maximum length of a single value string (default: 500) */
  maxValueLength?: number;
  /** Maximum number of items in an array preview (default: 10) */
  maxArrayPreview?: number;
  /** Indentation level (default: 0) */
  indent?: number;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

const MAX_VALUE_LENGTH = 500;

function truncateValue(val: string, maxLen = MAX_VALUE_LENGTH): string {
  if (val.length <= maxLen) return val;
  return val.slice(0, maxLen) + `... [truncated, ${val.length} chars total]`;
}

function formatVariableValue(v: Variable, options: FormatOptions): string {
  if (v.isNull) return options.color ? "\x1b[31mnull\x1b[0m" : "null";
  let val = String(v.value);
  if (options.truncate !== false) {
    val = truncateValue(val, options.maxValueLength ?? MAX_VALUE_LENGTH);
  }
  return val;
}

function indent(text: string, level: number): string {
  if (level === 0) return text;
  const prefix = "  ".repeat(level);
  return text
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");
}

// ─── Format Module ───────────────────────────────────────────────────────────

export type FormatModule = ReturnType<typeof createFormat>;

/**
 * Create a format utility object.
 *
 * All methods return strings (unlike the CLI formatter which writes to stdout).
 */
export function createFormat() {
  const defaultOptions: FormatOptions = {};

  return {
    /**
     * Format a single variable as a string.
     * @example `"int count = 42"`
     */
    variable(v: Variable, options?: FormatOptions): string {
      const opts = { ...defaultOptions, ...options };
      const val = formatVariableValue(v, opts);
      const typeStr = opts.color ? `\x1b[90m${v.type}\x1b[0m` : v.type;
      return `${typeStr} ${v.name} = ${val}`;
    },

    /**
     * Format a list of variables as a formatted block.
     * @example
     * ```
     * int count = 42
     * string name = "hello"
     * ```
     */
    variables(vars: Variable[], options?: FormatOptions): string {
      const opts = { ...defaultOptions, ...options };
      if (vars.length === 0) return options?.color ? "\x1b[90m(no variables)\x1b[0m" : "(no variables)";

      const lines = vars.map((v) => this.variable(v, opts));
      return indent(lines.join("\n"), opts.indent ?? 0);
    },

    /**
     * Format stack frames.
     * @example
     * ```
     * -> #0 App.main at App.java:42
     *    #1 App.run at App.java:10
     * ```
     */
    stack(frames: StackFrame[], options?: FormatOptions): string {
      const opts = { ...defaultOptions, ...options };
      if (frames.length === 0) return options?.color ? "\x1b[90m(empty stack)\x1b[0m" : "(empty stack)";

      const lines = frames.map((f, i) => {
        const marker = i === 0
          ? (opts.color ? " \x1b[33m->\x1b[0m" : " ->")
          : "   ";
        const native = f.isNative ? " [native]" : "";
        return `${marker} #${i} ${f.method} at ${f.location}:${f.line}${native}`;
      });
      return indent(lines.join("\n"), opts.indent ?? 0);
    },

    /**
     * Format a thread list.
     * @example
     * ```
     * * 1: main [SUSPENDED]
     *   2: worker [RUNNING]
     * ```
     */
    threads(threads: ThreadInfo[], options?: FormatOptions): string {
      const opts = { ...defaultOptions, ...options };
      if (threads.length === 0) return options?.color ? "\x1b[90m(no threads)\x1b[0m" : "(no threads)";

      // Use first thread as active marker if no context
      const activeId = threads[0]?.id;
      const lines = threads.map((t) => {
        const marker = t.id === activeId
          ? (opts.color ? " \x1b[33m*\x1b[0m" : " *")
          : "  ";
        const status = t.isSuspended
          ? (opts.color ? "\x1b[31mSUSPENDED\x1b[0m" : "SUSPENDED")
          : "RUNNING";
        return `${marker} ${t.id}: ${t.name} [${status}]`;
      });
      return indent(lines.join("\n"), opts.indent ?? 0);
    },

    /**
     * Format a breakpoint list.
     * @example
     * ```
     * bp-1: App.java:42 enabled (hits: 3)
     * bp-2: App.java:50 disabled (hits: 0)
     * ```
     */
    breakpoints(bps: BreakpointInfo[], options?: FormatOptions): string {
      const opts = { ...defaultOptions, ...options };
      if (bps.length === 0) return options?.color ? "\x1b[90m(no breakpoints)\x1b[0m" : "(no breakpoints)";

      const lines = bps.map((bp) => {
        const status = bp.enabled
          ? (opts.color ? "\x1b[32menabled\x1b[0m" : "enabled")
          : (opts.color ? "\x1b[31mdisabled\x1b[0m" : "disabled");
        const cond = bp.condition ? ` condition: "${bp.condition}"` : "";
        return `${bp.id}: ${bp.location} ${status} (hits: ${bp.hitCount})${cond}`;
      });
      return indent(lines.join("\n"), opts.indent ?? 0);
    },

    /**
     * Format a debug event as a string.
     */
    event(event: DebugEvent): string {
      const ts = event.timestamp instanceof Date
        ? event.timestamp.toISOString()
        : String(event.timestamp);
      return `[${ts}] ${event.type} thread=${event.threadId} location=${event.location}`;
    },

    /**
     * Format data as a JSON string.
     * @param data - Any JSON-serializable data
     * @param pretty - Whether to pretty-print with indentation (default: false)
     */
    json(data: unknown, pretty?: boolean): string {
      return JSON.stringify(data, null, pretty ? 2 : undefined);
    },

    /**
     * Format a table from headers and rows.
     * @example
     * ```
     * Name   | Type  | Value
     * -------+-------+------
     * count  | int   | 42
     * name   | string| hello
     * ```
     */
    table(headers: string[], rows: string[][], options?: FormatOptions): string {
      const opts = { ...defaultOptions, ...options };

      if (headers.length === 0) return "";

      // Calculate column widths
      const widths = headers.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)),
      );

      const result: string[] = [];

      // Header
      const headerLine = headers
        .map((h, i) => h.padEnd(widths[i] ?? 0))
        .join(" | ");
      result.push(opts.color ? `\x1b[1m${headerLine}\x1b[0m` : headerLine);

      // Separator
      const separator = widths.map((w) => "-".repeat(w ?? 0)).join("-+-");
      result.push(separator);

      // Rows (with truncation)
      const maxRows = 500;
      const displayRows = rows.length > maxRows
        ? [...rows.slice(0, maxRows / 2), [`... [${rows.length - maxRows} rows omitted]`], ...rows.slice(rows.length - maxRows / 2)]
        : rows;

      for (const row of displayRows) {
        const line = row
          .map((cell, i) => cell.padEnd(widths[i] ?? 0))
          .join(" | ");
        result.push(line);
      }

      return indent(result.join("\n"), opts.indent ?? 0);
    },

    /**
     * Format any value as a text string (using a simple toString).
     */
    text(data: unknown): string {
      if (data === null) return "null";
      if (data === undefined) return "undefined";
      if (typeof data === "string") return data;
      if (typeof data === "object") {
        try {
          return JSON.stringify(data, null, 2);
        } catch {
          return String(data);
        }
      }
      return String(data);
    },
  } as const;
}