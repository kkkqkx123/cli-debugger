/**
 * Query Module
 *
 * High-level data query API for inspecting debug state.
 * Provides convenience methods beyond the raw DebugProtocol methods.
 */

import type { DebugProtocol } from "../../protocol/base.js";
import type { ExtendedDebugProtocol } from "../../protocol/extended.js";
import type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
} from "../../types/debug.js";
import type { TargetMetadata } from "../../protocol/extended.js";
import { readFileSync } from "node:fs";

// ─── Query Types ─────────────────────────────────────────────────────────────

/** Options for variable/thread/stack queries */
export interface QueryOptions {
  threadId?: string;
  frameIndex?: number;
}

/** Extended variable detail */
export interface VariableDetail extends Variable {
  fields?: Variable[];
  typeInfo?: { name: string; byteSize: number };
}

/** Source context around the current execution point */
export interface SourceContext {
  file: string;
  line: number;
  method: string;
  lines: string[];
  startLine: number;
  threadId: string;
  frameIndex: number;
}

/** Filtering options for stack queries */
export interface StackFilter {
  method?: string | RegExp;
  file?: string | RegExp;
}

/** Filtering options for breakpoint queries */
export interface BreakpointFilter {
  enabled?: boolean;
  location?: string | RegExp;
}

/**
 * Read source context lines from a file.
 *
 * @param filePath - Path to the source file
 * @param line - Current line number (1-based)
 * @param contextLines - Number of lines before and after (default: 5)
 * @returns Array of formatted source lines, or empty array if file cannot be read
 *
 * @example
 * ```ts
 * const lines = readSourceContext("src/main.ts", 42, 3);
 * // Returns: [">   42|   const x = 42;", "    43|   console.log(x);"]
 * ```
 */
export function readSourceContext(
  filePath: string,
  line: number,
  contextLines = 5,
): string[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const start = Math.max(0, line - 1 - contextLines);
    const end = Math.min(lines.length, line - 1 + contextLines);
    const result: string[] = [];
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const marker = lineNum === line ? ">" : " ";
      result.push(`${marker} ${String(lineNum).padStart(4)}| ${lines[i] ?? ""}`);
    }
    return result;
  } catch {
    return [];
  }
}

// ─── Query Module ────────────────────────────────────────────────────────────

/**
 * Create a query module bound to a debugger session.
 *
 * Provides high-level data retrieval with filtering and convenience lookups.
 *
 * @param getClient - Function that returns the current debug protocol client
 * @param getActiveThread - Function that returns the active thread ID
 * @param getActiveFrameIndex - Function that returns the active frame index
 */
export function createQuery(
  getClient: () => DebugProtocol | undefined,
  getActiveThread: () => string | undefined,
  getActiveFrameIndex: () => number,
) {
  /** Get the client or throw */
  function requireClient(): DebugProtocol {
    const client = getClient();
    if (!client) {
      throw new Error("No active debug session");
    }
    return client;
  }

  /** Resolve thread ID: use provided, or active, or first available */
  async function resolveThreadId(threadId?: string): Promise<string> {
    if (threadId) return threadId;
    const active = getActiveThread();
    if (active) return active;
    const threads = await requireClient().threads();
    if (threads.length === 0) {
      throw new Error("No threads available");
    }
    return threads[0]!.id;
  }

  return {
    /**
     * Get detailed information about a variable.
     * Resolves to current scope's variable by name.
     */
    async variable(
      name: string,
      options?: QueryOptions,
    ): Promise<VariableDetail | undefined> {
      const client = requireClient();
      const tid = await resolveThreadId(options?.threadId);
      const frameIndex = options?.frameIndex ?? getActiveFrameIndex();
      const locals = await client.locals(tid, frameIndex);
      const v = locals.find((v) => v.name === name);
      if (!v) return undefined;

      const detail: VariableDetail = { ...v };

      // Try to get fields if supported
      if (!v.isPrimitive && !v.isNull) {
        try {
          const extended = client as ExtendedDebugProtocol;
          if (
            typeof extended.getTypeInfo === "function" &&
            v.type
          ) {
            const typeInfo = await extended.getTypeInfo(v.type, true);
            detail.typeInfo = {
              name: typeInfo.name,
              byteSize: typeInfo.byteSize,
            };
            if (typeInfo.fields.length > 0) {
              detail.fields = typeInfo.fields.map((f) => ({
                name: f.name,
                type: f.typeName,
                value: `<${f.typeName}>`,
                isPrimitive: false,
                isNull: false,
              }));
            }
          }
        } catch {
          // Extended info is optional — ignore errors
        }
      }

      return detail;
    },

    /**
     * Find variables matching a name pattern.
     */
    async findVariable(
      pattern: string,
      options?: QueryOptions,
    ): Promise<VariableDetail[]> {
      const client = requireClient();
      const tid = await resolveThreadId(options?.threadId);
      const frameIndex = options?.frameIndex ?? getActiveFrameIndex();
      const locals = await client.locals(tid, frameIndex);
      const regex = new RegExp(pattern);
      const matched = locals.filter((v) => regex.test(v.name));
      return matched.map((v) => ({ ...v }));
    },

    /**
     * Get a thread by ID, or the active thread if no ID given.
     */
    async thread(id?: string): Promise<ThreadInfo | undefined> {
      const client = requireClient();
      const threads = await client.threads();
      if (id) return threads.find((t) => t.id === id);
      const active = getActiveThread();
      if (active) return threads.find((t) => t.id === active);
      return threads[0];
    },

    /**
     * Find a thread by name (partial match).
     */
    async threadByName(name: string): Promise<ThreadInfo | undefined> {
      const client = requireClient();
      const threads = await client.threads();
      return threads.find((t) => t.name.includes(name));
    },

    /**
     * Get stack frames with optional filtering.
     */
    async stack(
      threadId?: string,
      filter?: StackFilter,
    ): Promise<StackFrame[]> {
      const client = requireClient();
      const tid = await resolveThreadId(threadId);
      const frames = await client.stack(tid);

      if (!filter) return frames;
      return frames.filter((f) => {
        if (filter.method) {
          const methodMatch =
            filter.method instanceof RegExp
              ? filter.method.test(f.method)
              : f.method.includes(filter.method);
          if (!methodMatch) return false;
        }
        if (filter.file) {
          const fileMatch =
            filter.file instanceof RegExp
              ? filter.file.test(f.location)
              : f.location.includes(filter.file);
          if (!fileMatch) return false;
        }
        return true;
      });
    },

    /**
     * Get source context around the current execution point.
     */
    async sourceContext(
      options?: QueryOptions,
    ): Promise<SourceContext | undefined> {
      const client = requireClient();
      const tid = await resolveThreadId(options?.threadId);
      const frameIndex = options?.frameIndex ?? getActiveFrameIndex();
      const frames = await client.stack(tid);
      const top = frames[0];
      if (!top || top.location === "<unknown>") return undefined;

      const lines = readSourceContext(top.location, top.line, 5);

      return {
        file: top.location,
        line: top.line,
        method: top.method,
        lines,
        startLine: Math.max(0, top.line - 5),
        threadId: tid,
        frameIndex,
      };
    },

    /**
     * Get breakpoints, optionally filtered.
     */
    async breakpoints(
      filter?: BreakpointFilter,
    ): Promise<BreakpointInfo[]> {
      const client = requireClient();
      const bps = await client.breakpoints();

      if (!filter) return bps;
      return bps.filter((bp) => {
        if (filter.enabled !== undefined && bp.enabled !== filter.enabled) {
          return false;
        }
        if (filter.location) {
          const locMatch =
            filter.location instanceof RegExp
              ? filter.location.test(bp.location)
              : bp.location.includes(filter.location);
          if (!locMatch) return false;
        }
        return true;
      });
    },

    /**
     * Get target metadata (if supported by the protocol).
     */
    async metadata(): Promise<TargetMetadata | undefined> {
      const client = requireClient();
      const extended = client as ExtendedDebugProtocol;
      if (typeof extended.getTargetMetadata !== "function") {
        return undefined;
      }
      return extended.getTargetMetadata();
    },
  };
}

/** Type of the query module returned by createQuery */
export type QueryModule = ReturnType<typeof createQuery>;