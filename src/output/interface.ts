import type { Writable } from 'node:stream';
import type {
  VersionInfo,
  ThreadInfo,
  StackFrame,
  Variable,
  BreakpointInfo,
  DebugEvent,
} from '../types/index.js';

/**
 * Output formatter interface
 * Defines the contract for all output formatters
 */
export interface Formatter {
  /**
   * Format version information
   */
  formatVersion(info: VersionInfo): Promise<void>;

  /**
   * Format thread list
   */
  formatThreads(threads: ThreadInfo[]): Promise<void>;

  /**
   * Format call stack
   */
  formatStack(frames: StackFrame[]): Promise<void>;

  /**
   * Format variable list
   */
  formatVariables(variables: Variable[]): Promise<void>;

  /**
   * Format breakpoint list
   */
  formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void>;

  /**
   * Format debug event
   */
  formatEvent(event: DebugEvent): Promise<void>;

  /**
   * Format error
   */
  formatError(error: Error): Promise<void>;

  /**
   * Format verbose error (with stack trace)
   */
  formatVerboseError(error: Error): Promise<void>;

  /**
   * Set output stream
   */
  setWriter(writer: Writable): void;
}

/**
 * Formatter type
 */
export type FormatterType = 'text' | 'json' | 'table';

/**
 * Formatter factory options
 */
export interface FormatterOptions {
  type: FormatterType;
  color?: boolean;
  writer?: Writable;
}
