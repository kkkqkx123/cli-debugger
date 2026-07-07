/**
 * Auto-context formatter
 *
 * Handles formatting of debug context for both JSON and text output modes.
 * Supports the auto-context pattern where every command returns full context.
 */

import type { AutoContext } from "../session/manager.js";
import type { OutputMode } from "../session/manager.js";

// ─── Truncation Strategy ────────────────────────────────────────────────────

/** Maximum number of output lines to display */
const MAX_OUTPUT_LINES = 200;

/** Maximum length of a single value string */
const MAX_VALUE_LENGTH = 500;

/** Maximum number of items in an array preview */
const MAX_ARRAY_PREVIEW = 10;

/**
 * Truncate a string value to a maximum length
 */
function truncateValue(val: string, maxLen = MAX_VALUE_LENGTH): string {
  if (val.length <= maxLen) return val;
  return val.slice(0, maxLen) + `... [truncated, ${val.length} chars total]`;
}

/**
 * Truncate an array of output lines to a maximum count
 */
function truncateLines(lines: string[], maxLines = MAX_OUTPUT_LINES): string[] {
  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, maxLines / 2);
  const tail = lines.slice(lines.length - maxLines / 2);
  const omitted = lines.length - maxLines;
  return [...head, `... [${omitted} lines omitted]`, ...tail];
}

/**
 * Truncate variable values for display
 */
function truncateVariables(vars: Array<{ name: string; type: string; value: unknown; isNull: boolean; isPrimitive?: boolean }>): Array<{ name: string; type: string; value: unknown; isNull: boolean; isPrimitive?: boolean }> {
  return vars.map((v) => {
    if (v.isNull) return v;
    // Truncate long string values
    if (typeof v.value === "string" && v.value.length > MAX_VALUE_LENGTH) {
      return { ...v, value: truncateValue(v.value) };
    }
    // Truncate array previews
    if (Array.isArray(v.value) && v.value.length > MAX_ARRAY_PREVIEW) {
      const items = v.value.slice(0, MAX_ARRAY_PREVIEW);
      return { ...v, value: [...items, `... [${v.value.length - MAX_ARRAY_PREVIEW} more items]`] };
    }
    return v;
  });
}

/** Formatted output writer */
export function writeContext(ctx: AutoContext, mode: OutputMode): void {
  if (mode === "json") {
    writeJsonContext(ctx);
  } else {
    writeTextContext(ctx);
  }
}

function writeJsonContext(ctx: AutoContext): void {
  const output: Record<string, unknown> = {};

  if (ctx.thread) {
    output["thread"] = ctx.thread;
  }
  if (ctx.location) {
    output["location"] = ctx.location;
  }
  if (ctx.sourceContext) {
    output["sourceContext"] = truncateLines(ctx.sourceContext);
  }
  if (ctx.locals) {
    output["locals"] = truncateVariables(ctx.locals);
  }
  if (ctx.stack) {
    output["stack"] = ctx.stack;
  }
  if (ctx.output && ctx.output.length > 0) {
    output["output"] = truncateLines(ctx.output);
  }
  if (ctx.threads) {
    output["threads"] = ctx.threads;
  }
  if (ctx.breakpoints) {
    output["breakpoints"] = ctx.breakpoints;
  }

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

function writeTextContext(ctx: AutoContext): void {
  const out = (text: string) => process.stdout.write(text);

  // Thread info
  if (ctx.thread) {
    const t = ctx.thread;
    const status = t.isSuspended ? "SUSPENDED" : "RUNNING";
    out(`\x1b[1mThread:\x1b[0m ${t.id} - ${t.name} [${status}]\n`);
  }

  // Location
  if (ctx.location) {
    const loc = ctx.location;
    out(`\x1b[1mLocation:\x1b[0m ${loc.file}:${loc.line} (${loc.method})\n`);
  }

  // Source context
  if (ctx.sourceContext && ctx.sourceContext.length > 0) {
    out(`\x1b[1mSource:\x1b[0m\n`);
    const lines = truncateLines(ctx.sourceContext);
    for (const line of lines) {
      out(`  ${line}\n`);
    }
    if (lines.length > ctx.sourceContext.length) {
      // Truncation occurred - a summary line was appended
    }
  }

  // Locals
  if (ctx.locals && ctx.locals.length > 0) {
    out(`\x1b[1mVariables:\x1b[0m\n`);
    const truncated = truncateVariables(ctx.locals);
    for (const v of truncated) {
      const val = v.isNull ? "\x1b[31mnull\x1b[0m" : truncateValue(String(v.value));
      out(`  \x1b[90m${v.type}\x1b[0m ${v.name} = ${val}\n`);
    }
  } else if (ctx.locals) {
    out(`\x1b[1mVariables:\x1b[0m (none)\n`);
  }

  // Stack
  if (ctx.stack && ctx.stack.length > 0) {
    out(`\x1b[1mStack:\x1b[0m\n`);
    for (let i = 0; i < ctx.stack.length; i++) {
      const f = ctx.stack[i];
      if (f) {
        const marker = i === 0 ? " \x1b[33m->\x1b[0m" : "   ";
        out(`${marker} #${i} ${f.method} at ${f.location}:${f.line}\n`);
      }
    }
  } else if (ctx.stack) {
    out(`\x1b[1mStack:\x1b[0m (empty)\n`);
  }

  // Output
  if (ctx.output && ctx.output.length > 0) {
    out(`\x1b[1mOutput:\x1b[0m\n`);
    const outputLines = truncateLines(ctx.output);
    for (const line of outputLines) {
      out(`  ${line}\n`);
    }
  }

  // Threads
  if (ctx.threads && ctx.threads.length > 0) {
    out(`\x1b[1mThreads:\x1b[0m\n`);
    for (const t of ctx.threads) {
      const marker = ctx.thread && t.id === ctx.thread.id ? " \x1b[33m*\x1b[0m" : "  ";
      const status = t.isSuspended ? "SUSPENDED" : "RUNNING";
      out(`${marker} ${t.id}: ${t.name} [${status}]\n`);
    }
  }

  // Breakpoints
  if (ctx.breakpoints && ctx.breakpoints.length > 0) {
    out(`\x1b[1mBreakpoints:\x1b[0m\n`);
    for (const bp of ctx.breakpoints) {
      const status = bp.enabled ? "\x1b[32menabled\x1b[0m" : "\x1b[31mdisabled\x1b[0m";
      out(`  ${bp.id}: ${bp.location} ${status} (hits: ${bp.hitCount})\n`);
    }
  }
}

/** Write a simple message */
export function writeMessage(msg: string, mode: OutputMode): void {
  if (mode === "json") {
    process.stdout.write(JSON.stringify({ message: msg }) + "\n");
  } else {
    process.stdout.write(msg + "\n");
  }
}

/** Write an error message */
export function writeError(msg: string, mode: OutputMode): void {
  if (mode === "json") {
    process.stdout.write(
      JSON.stringify({ type: "error", message: msg }) + "\n",
    );
  } else {
    process.stdout.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
  }
}

/** Write success message */
export function writeSuccess(msg: string, mode: OutputMode): void {
  if (mode === "json") {
    process.stdout.write(
      JSON.stringify({ type: "success", message: msg }) + "\n",
    );
  } else {
    process.stdout.write(`\x1b[32m${msg}\x1b[0m\n`);
  }
}

/** Write a result value */
export function writeResult(key: string, value: unknown, mode: OutputMode): void {
  if (mode === "json") {
    process.stdout.write(JSON.stringify({ [key]: value }) + "\n");
  } else {
    process.stdout.write(`\x1b[1m${key}:\x1b[0m ${String(value)}\n`);
  }
}

/** Write a table */
export function writeTable(
  headers: string[],
  rows: string[][],
  mode: OutputMode,
): void {
  if (mode === "json") {
    const data = rows.map((row) =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
    );
    process.stdout.write(JSON.stringify(data) + "\n");
    return;
  }

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)),
  );

  // Header
  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i] ?? 0))
    .join(" | ");
  process.stdout.write(`\x1b[1m${headerLine}\x1b[0m\n`);

  // Separator
  const separator = widths.map((w) => "-".repeat(w ?? 0)).join("-+-");
  process.stdout.write(separator + "\n");

  // Rows
  for (const row of rows) {
    const line = row
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join(" | ");
    process.stdout.write(line + "\n");
  }
}