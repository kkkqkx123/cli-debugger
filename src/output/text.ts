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
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

/**
 * Text formatter implementation
 * Provides human-readable text output with optional color support
 */
export class TextFormatter implements Formatter {
  private writer: Writable = process.stdout;
  private useColor: boolean;

  constructor(options?: { color?: boolean }) {
    this.useColor = options?.color ?? true;
  }

  setWriter(writer: Writable): void {
    this.writer = writer;
  }

  async formatVersion(info: VersionInfo): Promise<void> {
    this.write(`Protocol: ${info.protocolVersion}\n`);
    this.write(`Runtime: ${info.runtimeName} ${info.runtimeVersion}\n`);
    this.write(`Description: ${info.description}\n`);
  }

  async formatThreads(threads: ThreadInfo[]): Promise<void> {
    if (threads.length === 0) {
      this.write('No threads found\n');
      return;
    }

    for (const thread of threads) {
      const status = thread.isSuspended
        ? this.colorize(colors.yellow, '[SUSPENDED]')
        : this.colorize(colors.green, '[RUNNING]');
      this.write(
        `Thread ${thread.id}: ${thread.name} ${status} (state: ${thread.state})\n`
      );
    }
  }

  async formatStack(frames: StackFrame[]): Promise<void> {
    if (frames.length === 0) {
      this.write('No stack frames\n');
      return;
    }

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (frame) {
        const native = frame.isNative ? this.colorize(colors.gray, '[native]') : '';
        this.write(
          `  #${i} ${frame.method} at ${frame.location}:${frame.line} ${native}\n`
        );
      }
    }
  }

  async formatVariables(variables: Variable[]): Promise<void> {
    if (variables.length === 0) {
      this.write('No variables\n');
      return;
    }

    for (const v of variables) {
      const type = this.colorize(colors.gray, v.type);
      const value = v.isNull
        ? this.colorize(colors.red, 'null')
        : String(v.value);
      this.write(`  ${v.name}: ${type} = ${value}\n`);
    }
  }

  async formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void> {
    if (breakpoints.length === 0) {
      this.write('No breakpoints\n');
      return;
    }

    for (const bp of breakpoints) {
      const status = bp.enabled
        ? this.colorize(colors.green, '[enabled]')
        : this.colorize(colors.red, '[disabled]');
      this.write(
        `Breakpoint ${bp.id}: ${bp.location} ${status} (hits: ${bp.hitCount})\n`
      );
    }
  }

  async formatEvent(event: DebugEvent): Promise<void> {
    this.write(
      `Event: ${event.type} at ${event.location} (thread: ${event.threadId})\n`
    );
  }

  async formatError(error: Error): Promise<void> {
    this.write(this.colorize(colors.red, `Error: ${error.message}\n`));
  }

  async formatVerboseError(error: Error): Promise<void> {
    await this.formatError(error);
    if (error.stack) {
      this.write(this.colorize(colors.gray, error.stack) + '\n');
    }
  }

  private write(text: string): void {
    this.writer.write(text);
  }

  private colorize(color: (text: string) => string, text: string): string {
    return this.useColor ? color(text) : text;
  }
}
