import type { Writable } from 'node:stream';
import process from 'node:process';
import type { Formatter } from './interface.js';
import type {
  VersionInfo,
  ThreadInfo,
  StackFrame,
  Variable,
  BreakpointInfo,
  DebugEvent,
} from '../types/index.js';

/**
 * Simple color functions (fallback when chalk is not available)
 */
const colors = {
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

/**
 * Table formatter implementation
 * Provides tabular output with column alignment
 */
export class TableFormatter implements Formatter {
  private writer: Writable = process.stdout;
  private useColor: boolean;

  constructor(options?: { color?: boolean }) {
    this.useColor = options?.color ?? true;
  }

  setWriter(writer: Writable): void {
    this.writer = writer;
  }

  async formatVersion(info: VersionInfo): Promise<void> {
    this.writeTable(
      ['Property', 'Value'],
      [
        ['Protocol', info.protocolVersion],
        ['Runtime', `${info.runtimeName} ${info.runtimeVersion}`],
        ['Description', info.description],
      ]
    );
  }

  async formatThreads(threads: ThreadInfo[]): Promise<void> {
    if (threads.length === 0) {
      this.write('No threads found\n');
      return;
    }

    const rows = threads.map((t) => [
      String(t.id),
      t.name,
      t.state,
      t.isSuspended ? 'Yes' : 'No',
      String(t.priority),
    ]);

    this.writeTable(['ID', 'Name', 'State', 'Suspended', 'Priority'], rows);
  }

  async formatStack(frames: StackFrame[]): Promise<void> {
    if (frames.length === 0) {
      this.write('No stack frames\n');
      return;
    }

    const rows = frames.map((f, i) => [
      String(i),
      f.method,
      f.location,
      String(f.line),
      f.isNative ? 'Yes' : 'No',
    ]);

    this.writeTable(['#', 'Method', 'Location', 'Line', 'Native'], rows);
  }

  async formatVariables(variables: Variable[]): Promise<void> {
    if (variables.length === 0) {
      this.write('No variables\n');
      return;
    }

    const rows = variables.map((v) => [
      v.name,
      v.type,
      v.isNull ? 'null' : String(v.value),
      v.isPrimitive ? 'Yes' : 'No',
    ]);

    this.writeTable(['Name', 'Type', 'Value', 'Primitive'], rows);
  }

  async formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void> {
    if (breakpoints.length === 0) {
      this.write('No breakpoints\n');
      return;
    }

    const rows = breakpoints.map((bp) => [
      String(bp.id),
      bp.location,
      bp.enabled ? 'Yes' : 'No',
      String(bp.hitCount),
      bp.condition || '-',
    ]);

    this.writeTable(['ID', 'Location', 'Enabled', 'Hits', 'Condition'], rows);
  }

  async formatEvent(event: DebugEvent): Promise<void> {
    this.writeTable(
      ['Property', 'Value'],
      [
        ['Type', event.type],
        ['Location', event.location],
        ['Thread ID', String(event.threadId)],
      ]
    );
  }

  async formatError(error: Error): Promise<void> {
    this.writeTable(
      ['Property', 'Value'],
      [
        ['Name', error.name],
        ['Message', error.message],
      ]
    );
  }

  async formatVerboseError(error: Error): Promise<void> {
    const rows: string[][] = [
      ['Name', error.name],
      ['Message', error.message],
    ];

    if (error.stack) {
      rows.push(['Stack', error.stack]);
    }

    this.writeTable(['Property', 'Value'], rows);
  }

  private write(text: string): void {
    this.writer.write(text);
  }

  private writeTable(headers: string[], rows: string[][]): void {
    // Calculate column widths
    const widths = headers.map(
      (h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0))
    );

    // Write header
    const headerLine = headers
      .map((h, i) => h.padEnd(widths[i] ?? 0))
      .join(' | ');
    this.write(this.colorize(colors.bold, headerLine) + '\n');

    // Write separator
    const separator = widths.map((w) => '-'.repeat(w ?? 0)).join('-+-');
    this.write(separator + '\n');

    // Write rows
    for (const row of rows) {
      const line = row
        .map((cell, i) => cell.padEnd(widths[i] ?? 0))
        .join(' | ');
      this.write(line + '\n');
    }
  }

  private colorize(color: (text: string) => string, text: string): string {
    return this.useColor ? color(text) : text;
  }
}
