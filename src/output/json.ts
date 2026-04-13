import type { Writable } from "node:stream";
import process from "node:process";
import type { Formatter } from "./interface.js";
import type {
  VersionInfo,
  ThreadInfo,
  StackFrame,
  Variable,
  BreakpointInfo,
  DebugEvent,
} from "../types/index.js";

/**
 * JSON output wrapper type
 */
interface JsonOutput {
  type: string;
  data: unknown;
}

/**
 * JSON formatter implementation
 * Provides structured JSON output for programmatic consumption
 */
export class JsonFormatter implements Formatter {
  private writer: Writable = process.stdout;

  setWriter(writer: Writable): void {
    this.writer = writer;
  }

  async formatVersion(info: VersionInfo): Promise<void> {
    this.write({ type: "version", data: info });
  }

  async formatThreads(threads: ThreadInfo[]): Promise<void> {
    this.write({ type: "threads", data: threads });
  }

  async formatStack(frames: StackFrame[]): Promise<void> {
    this.write({ type: "stack", data: frames });
  }

  async formatVariables(variables: Variable[]): Promise<void> {
    this.write({ type: "variables", data: variables });
  }

  async formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void> {
    this.write({ type: "breakpoints", data: breakpoints });
  }

  async formatEvent(event: DebugEvent): Promise<void> {
    this.write({ type: "event", data: event });
  }

  async formatError(error: Error): Promise<void> {
    this.write({
      type: "error",
      data: {
        name: error.name,
        message: error.message,
      },
    });
  }

  async formatVerboseError(error: Error): Promise<void> {
    this.write({
      type: "error",
      data: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  private write(output: JsonOutput): void {
    this.writer.write(JSON.stringify(output, null, 2) + "\n");
  }
}
