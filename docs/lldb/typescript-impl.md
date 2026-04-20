# TypeScript 实现详细设计

## 概述

本文档详细描述 LLDB 协议的 TypeScript 实现细节。

## 文件结构

```
src/protocol/lldb/
├── index.ts           # 模块导出
├── client.ts          # LLDBClient 实现
├── bridge.ts          # Python 子进程桥接
├── types.ts           # 类型定义
├── protocol.ts        # 通信协议
├── env.ts             # 环境检测
└── scripts/
    └── lldb_bridge.py # Python 桥接脚本
```

## 类型定义 (types.ts)

```typescript
/**
 * LLDB-specific type definitions
 */

import { z } from "zod";

// ==================== Configuration ====================

/** LLDB configuration schema */
export const LLDBConfigSchema = z.object({
  protocol: z.literal("lldb"),
  target: z.string().min(1),
  coreFile: z.string().optional(),
  pythonPath: z.string().optional(),
  attachPid: z.number().int().positive().optional(),
  waitFor: z.boolean().default(false),
  timeout: z.number().int().positive().default(30000),
  launchArgs: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  workingDir: z.string().optional(),
  stopAtEntry: z.boolean().default(false),
});

export type LLDBConfig = z.infer<typeof LLDBConfigSchema>;

// ==================== LLDB Types ====================

/** LLDB thread state */
export type LLDBThreadState =
  | "invalid"
  | "unloaded"
  | "connected"
  | "attaching"
  | "launching"
  | "stopped"
  | "running"
  | "stepping"
  | "crashed"
  | "detached"
  | "resuming"
  | "suspended";

/** LLDB stop reason */
export type LLDBStopReason =
  | "invalid"
  | "none"
  | "trace"
  | "breakpoint"
  | "watchpoint"
  | "signal"
  | "exception"
  | "exec"
  | "planComplete"
  | "threadExiting";

/** LLDB thread info (extended) */
export interface LLDBThreadInfo {
  id: number;
  name: string;
  state: LLDBThreadState;
  stopReason: LLDBStopReason;
  numFrames: number;
}

/** LLDB stack frame (extended) */
export interface LLDBStackFrame {
  id: number;
  location: string;
  file: string | null;
  line: number;
  column: number;
  method: string;
  module: string | null;
  address: number;
  isInlined: boolean;
}

/** LLDB variable kind */
export type LLDBVariableKind = "arg" | "local" | "field" | "result";

/** LLDB variable (extended) */
export interface LLDBVariable {
  name: string;
  type: string;
  value: string;
  kind: LLDBVariableKind;
  isPointer: boolean;
  isArray: boolean;
  isStruct: boolean;
  numChildren: number;
  isNil: boolean;
}

/** LLDB breakpoint (extended) */
export interface LLDBBreakpoint {
  id: string;
  internalId: number;
  locations: string[];
  enabled: boolean;
  hitCount: number;
  ignoreCount: number;
  condition: string | null;
}

/** LLDB event */
export interface LLDBEvent {
  type: string;
  state: LLDBThreadState;
  description: string;
}

// ==================== Bridge Types ====================

/** Bridge request */
export interface BridgeRequest {
  id: number;
  method: string;
  params: unknown;
}

/** Bridge response (success) */
export interface BridgeSuccessResponse {
  id: number;
  result: unknown;
}

/** Bridge response (error) */
export interface BridgeErrorResponse {
  id: number;
  error: {
    code: string;
    message: string;
  };
}

export type BridgeResponse = BridgeSuccessResponse | BridgeErrorResponse;

/** Bridge error codes */
export const BridgeErrorCodes = {
  PARSE_ERROR: "PARSE_ERROR",
  UNKNOWN_METHOD: "UNKNOWN_METHOD",
  INVALID_INPUT: "INVALID_INPUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NO_TARGET: "NO_TARGET",
  NO_PROCESS: "NO_PROCESS",
  TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
  CREATE_TARGET_FAILED: "CREATE_TARGET_FAILED",
  LOAD_CORE_FAILED: "LOAD_CORE_FAILED",
  ATTACH_FAILED: "ATTACH_FAILED",
  LAUNCH_FAILED: "LAUNCH_FAILED",
  THREAD_NOT_FOUND: "THREAD_NOT_FOUND",
  FRAME_NOT_FOUND: "FRAME_NOT_FOUND",
  BREAKPOINT_NOT_FOUND: "BREAKPOINT_NOT_FOUND",
  BREAKPOINT_FAILED: "BREAKPOINT_FAILED",
  VARIABLE_NOT_FOUND: "VARIABLE_NOT_FOUND",
  EVAL_FAILED: "EVAL_FAILED",
} as const;

export type BridgeErrorCode = (typeof BridgeErrorCodes)[keyof typeof BridgeErrorCodes];
```

## 通信协议 (protocol.ts)

```typescript
/**
 * LLDB bridge communication protocol
 */

import type { BridgeRequest, BridgeResponse } from "./types.js";

/**
 * Protocol constants
 */
export const PROTOCOL = {
  /** Line delimiter for messages */
  DELIMITER: "\n",
  /** Default timeout in ms */
  DEFAULT_TIMEOUT: 30000,
} as const;

/**
 * Create a bridge request
 */
export function createRequest(id: number, method: string, params: unknown): BridgeRequest {
  return { id, method, params };
}

/**
 * Parse a bridge response
 */
export function parseResponse(line: string): BridgeResponse {
  return JSON.parse(line) as BridgeResponse;
}

/**
 * Serialize a request for sending
 */
export function serializeRequest(request: BridgeRequest): string {
  return JSON.stringify(request) + PROTOCOL.DELIMITER;
}

/**
 * Check if response is an error
 */
export function isErrorResponse(response: BridgeResponse): response is {
  id: number;
  error: { code: string; message: string };
} {
  return "error" in response;
}
```

## Python 子进程桥接 (bridge.ts)

```typescript
/**
 * Python subprocess bridge for LLDB
 */

import { spawn, ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import * as path from "node:path";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";
import type { BridgeRequest, BridgeResponse, BridgeErrorCode } from "./types.js";
import { createRequest, parseResponse, serializeRequest, isErrorResponse, PROTOCOL } from "./protocol.js";

const require = createRequire(import.meta.url);

/**
 * LLDB Python bridge
 * Manages communication with the Python subprocess
 */
export class LLDBBridge {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private buffer = "";
  private scriptPath: string;
  private pythonPath: string;
  private defaultTimeout: number;

  constructor(options: { pythonPath?: string; timeout?: number } = {}) {
    this.pythonPath = options.pythonPath ?? "python3";
    this.defaultTimeout = options.timeout ?? PROTOCOL.DEFAULT_TIMEOUT;
    this.scriptPath = this.resolveScriptPath();
  }

  /**
   * Resolve the path to the Python bridge script
   */
  private resolveScriptPath(): string {
    // Script is located at scripts/lldb_bridge.py relative to this file
    return path.join(__dirname, "scripts", "lldb_bridge.py");
  }

  /**
   * Start the Python bridge process
   */
  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.pythonPath, [this.scriptPath], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
        });

        this.process.on("error", (err) => {
          this.cleanup();
          reject(
            new APIError(
              ErrorType.ConnectionError,
              ErrorCodes.ConnectionFailed,
              `Failed to start Python bridge: ${err.message}`,
              err,
            ),
          );
        });

        this.process.on("exit", (code, signal) => {
          this.cleanup();
          if (code !== 0 && code !== null) {
            // Process exited unexpectedly
            this.rejectAllPending(
              new APIError(
                ErrorType.ConnectionError,
                ErrorCodes.ConnectionClosed,
                `Python bridge exited with code ${code}`,
              ),
            );
          }
        });

        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleData(data);
        });

        this.process.stderr?.on("data", (data: Buffer) => {
          // Log stderr for debugging but don't treat as error
          console.error(`[lldb-bridge] ${data.toString().trim()}`);
        });

        // Give process a moment to start
        setImmediate(resolve);
      } catch (err) {
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionFailed,
            `Failed to spawn Python process: ${err}`,
          ),
        );
      }
    });
  }

  /**
   * Call a method on the Python bridge
   */
  async call<T>(method: string, params: unknown, timeout?: number): Promise<T> {
    if (!this.process || !this.process.stdin) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Bridge process not running",
      );
    }

    const id = ++this.requestId;
    const request: BridgeRequest = createRequest(id, method, params);
    const actualTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionTimeout,
            `Request ${method} timed out after ${actualTimeout}ms`,
          ),
        );
      }, actualTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId,
      });

      const message = serializeRequest(request);
      this.process!.stdin!.write(message);
    });
  }

  /**
   * Handle incoming data from Python stdout
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    this.processBuffer();
  }

  /**
   * Process complete messages in the buffer
   */
  private processBuffer(): void {
    const lines = this.buffer.split(PROTOCOL.DELIMITER);
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const response: BridgeResponse = parseResponse(line);
        this.handleResponse(response);
      } catch (err) {
        console.error(`[lldb-bridge] Failed to parse response: ${line}`);
      }
    }
  }

  /**
   * Handle a parsed response
   */
  private handleResponse(response: BridgeResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);

    if (isErrorResponse(response)) {
      pending.reject(this.convertError(response.error));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Convert bridge error to APIError
   */
  private convertError(error: { code: BridgeErrorCode; message: string }): APIError {
    const errorType = this.mapErrorType(error.code);
    return new APIError(errorType, ErrorCodes.CommandFailed, error.message);
  }

  /**
   * Map bridge error code to error type
   */
  private mapErrorType(code: BridgeErrorCode): ErrorType {
    switch (code) {
      case "NO_TARGET":
      case "NO_PROCESS":
      case "TARGET_NOT_FOUND":
        return ErrorType.ConnectionError;
      case "INVALID_INPUT":
        return ErrorType.InputError;
      case "UNKNOWN_METHOD":
        return ErrorType.ProtocolError;
      default:
        return ErrorType.InternalError;
    }
  }

  /**
   * Stop the bridge process
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    // Send disconnect command first
    try {
      await this.call("disconnect", { keepAlive: true }, 5000);
    } catch {
      // Ignore disconnect errors
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.buffer = "";
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Check if bridge is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
```

## LLDB 客户端 (client.ts)

```typescript
/**
 * LLDB Client Implementation
 * Implements DebugProtocol interface for LLDB debugger
 */

import type { DebugProtocol } from "../base.js";
import type { DebugConfig } from "../../types/config.js";
import type { VersionInfo, Capabilities } from "../../types/metadata.js";
import type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from "../../types/debug.js";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";
import { LLDBBridge } from "./bridge.js";
import type { LLDBConfig, LLDBThreadInfo, LLDBStackFrame, LLDBVariable, LLDBBreakpoint } from "./types.js";

/**
 * LLDB Client
 * Implements DebugProtocol for native debugging via LLDB
 */
export class LLDBClient implements DebugProtocol {
  private config: LLDBConfig;
  private bridge: LLDBBridge;
  private connected = false;
  private breakpointMap = new Map<string, LLDBBreakpoint>();

  constructor(config: DebugConfig) {
    // Validate and cast config
    this.config = this.validateConfig(config);
    this.bridge = new LLDBBridge({
      pythonPath: this.config.pythonPath,
      timeout: this.config.timeout,
    });
  }

  /**
   * Validate LLDB-specific config
   */
  private validateConfig(config: DebugConfig): LLDBConfig {
    if (config.protocol !== "lldb") {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Expected protocol 'lldb', got '${config.protocol}'`,
      );
    }

    if (!("target" in config) || !config.target) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "LLDB requires 'target' configuration",
      );
    }

    return config as LLDBConfig;
  }

  // ==================== Lifecycle ====================

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Start Python bridge
    await this.bridge.start();

    // Connect to target
    const result = await this.bridge.call<{ success: boolean; targetId: string }>(
      "connect",
      {
        target: this.config.target,
        coreFile: this.config.coreFile,
        attachPid: this.config.attachPid,
        waitFor: this.config.waitFor,
      },
    );

    if (!result.success) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionFailed,
        "Failed to connect to LLDB target",
      );
    }

    // Launch if not attaching to existing process
    if (!this.config.coreFile && !this.config.attachPid && !this.config.waitFor) {
      await this.bridge.call("launch", {
        args: this.config.launchArgs ?? [],
        env: this.config.env,
        stopAtEntry: this.config.stopAtEntry,
        workingDir: this.config.workingDir,
      });
    }

    this.connected = true;
  }

  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.breakpointMap.clear();
    await this.bridge.stop();
  }

  isConnected(): boolean {
    return this.connected && this.bridge.isRunning();
  }

  // ==================== Metadata ====================

  protocolName(): string {
    return "lldb";
  }

  supportedLanguages(): string[] {
    return ["c", "cpp", "objc", "swift", "rust"];
  }

  async version(): Promise<VersionInfo> {
    this.ensureConnected();

    const result = await this.bridge.call<{ lldbVersion: string; pythonVersion: string }>(
      "version",
      {},
    );

    return {
      protocolVersion: "1.0",
      runtimeVersion: result.lldbVersion,
      runtimeName: "lldb",
      description: `LLDB ${result.lldbVersion} (Python ${result.pythonVersion})`,
    };
  }

  async capabilities(): Promise<Capabilities> {
    return {
      supportsVersion: true,
      supportsThreads: true,
      supportsStack: true,
      supportsLocals: true,
      supportsBreakpoints: true,
      supportsSuspend: true,
      supportsResume: true,
      supportsStep: true,
      supportsCont: true,
      supportsNext: true,
      supportsFinish: true,
      supportsEvents: true,
      supportsWatchMode: false,
      supportsStreaming: false,
    };
  }

  // ==================== Thread Management ====================

  async threads(): Promise<ThreadInfo[]> {
    this.ensureConnected();

    const lldbThreads = await this.bridge.call<LLDBThreadInfo[]>("threads", {});

    return lldbThreads.map((t) => this.lldbThreadToThreadInfo(t));
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    this.ensureConnected();

    const frames = await this.bridge.call<LLDBStackFrame[]>("stack", {
      threadId: parseInt(threadId, 10),
      depth: 50,
    });

    return frames.map((f) => this.lldbFrameToStackFrame(f));
  }

  async threadState(threadId: string): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<{ state: string }>("threadState", {
      threadId: parseInt(threadId, 10),
    });

    return result.state;
  }

  // ==================== Execution Control ====================

  async suspend(threadId?: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("suspend", { threadId: threadId ? parseInt(threadId, 10) : undefined });
  }

  async resume(threadId?: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("resume", { threadId: threadId ? parseInt(threadId, 10) : undefined });
  }

  async stepInto(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("stepInto", { threadId: parseInt(threadId, 10) });
  }

  async stepOver(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("stepOver", { threadId: parseInt(threadId, 10) });
  }

  async stepOut(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.bridge.call("stepOut", { threadId: parseInt(threadId, 10) });
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(
    location: string,
    condition?: string,
    _type?:
      | "line"
      | "method-entry"
      | "method-exit"
      | "exception"
      | "field-access"
      | "field-modify"
      | "class-load"
      | "class-unload"
      | "thread-start"
      | "thread-death",
  ): Promise<string> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBBreakpoint>("setBreakpoint", {
      location,
      condition,
    });

    this.breakpointMap.set(result.id, result);
    return result.id;
  }

  async removeBreakpoint(id: string): Promise<void> {
    this.ensureConnected();

    await this.bridge.call("removeBreakpoint", { id });
    this.breakpointMap.delete(id);
  }

  async clearBreakpoints(): Promise<void> {
    this.ensureConnected();

    await this.bridge.call("clearBreakpoints", {});
    this.breakpointMap.clear();
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    this.ensureConnected();

    const bps = await this.bridge.call<LLDBBreakpoint[]>("breakpoints", {});

    return bps.map((bp) => ({
      id: bp.id,
      location: bp.locations[0] ?? "<unknown>",
      enabled: bp.enabled,
      hitCount: bp.hitCount,
      condition: bp.condition ?? undefined,
    }));
  }

  // ==================== Variable Inspection ====================

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    this.ensureConnected();

    const vars = await this.bridge.call<LLDBVariable[]>("locals", {
      threadId: parseInt(threadId, 10),
      frameIndex,
    });

    return vars.map((v) => this.lldbVariableToVariable(v));
  }

  async fields(objectId: string): Promise<Variable[]> {
    this.ensureConnected();

    // objectId format: "threadId:frameIndex:varName"
    const parts = objectId.split(":");
    if (parts.length < 3) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "Invalid objectId format. Expected 'threadId:frameIndex:varName'",
      );
    }

    const threadId = parseInt(parts[0]!, 10);
    const frameIndex = parseInt(parts[1]!, 10);
    const varName = parts.slice(2).join(":");

    const fields = await this.bridge.call<LLDBVariable[]>("fields", {
      threadId,
      frameIndex,
      varName,
    });

    return fields.map((v) => this.lldbVariableToVariable(v));
  }

  async setField(objectId: string, fieldId: string, value: unknown): Promise<void> {
    this.ensureConnected();

    // Construct expression to set the field
    const parts = objectId.split(":");
    if (parts.length < 3) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        "Invalid objectId format",
      );
    }

    const threadId = parseInt(parts[0]!, 10);
    const frameIndex = parseInt(parts[1]!, 10);
    const varName = parts.slice(2).join(":");
    const expression = `${varName}.${fieldId} = ${JSON.stringify(value)}`;

    await this.bridge.call("eval", {
      expression,
      threadId,
      frameIndex,
    });
  }

  // ==================== Event Handling ====================

  async waitForEvent(timeout?: number): Promise<DebugEvent | null> {
    this.ensureConnected();

    const event = await this.bridge.call<{ type: string; state: string; description: string } | null>(
      "waitForEvent",
      { timeout: (timeout ?? this.config.timeout) / 1000 }, // Convert to seconds
    );

    if (!event) {
      return null;
    }

    // Get current thread info
    const threads = await this.threads();
    const currentThread = threads.find((t) => t.state === "stopped");

    return {
      type: this.mapEventType(event.type),
      threadId: currentThread?.id ?? "",
      location: currentThread?.name ?? "",
      timestamp: new Date(),
      data: {
        state: event.state,
        description: event.description,
      },
    };
  }

  // ==================== Extended Methods ====================

  /**
   * Evaluate an expression
   */
  async eval(
    expression: string,
    threadId?: string,
    frameIndex?: number,
  ): Promise<Variable> {
    this.ensureConnected();

    const result = await this.bridge.call<LLDBVariable>("eval", {
      expression,
      threadId: threadId ? parseInt(threadId, 10) : undefined,
      frameIndex,
    });

    return this.lldbVariableToVariable(result);
  }

  // ==================== Private Methods ====================

  private ensureConnected(): void {
    if (!this.connected) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected to LLDB",
      );
    }
  }

  private lldbThreadToThreadInfo(t: LLDBThreadInfo): ThreadInfo {
    return {
      id: String(t.id),
      name: t.name,
      state: t.state,
      status: t.stopReason,
      isSuspended: t.state === "stopped" || t.state === "suspended",
      isDaemon: false,
      priority: 0,
      createdAt: new Date(),
    };
  }

  private lldbFrameToStackFrame(f: LLDBStackFrame): StackFrame {
    return {
      id: String(f.id),
      location: f.location,
      method: f.method,
      line: f.line,
      isNative: true, // LLDB is always native
    };
  }

  private lldbVariableToVariable(v: LLDBVariable): Variable {
    return {
      name: v.name,
      type: v.type,
      value: v.value,
      isPrimitive: !v.isPointer && !v.isArray && !v.isStruct && v.numChildren === 0,
      isNull: v.isNil,
    };
  }

  private mapEventType(type: string): DebugEvent["type"] {
    switch (type) {
      case "stopped":
        return "breakpoint";
      case "crashed":
        return "exception";
      case "exited":
        return "terminated";
      default:
        return "breakpoint";
    }
  }
}
```

## 环境检测 (env.ts)

```typescript
/**
 * LLDB environment detection
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface LLDBEnvironment {
  available: boolean;
  pythonPath?: string;
  pythonVersion?: string;
  lldbVersion?: string;
  error?: string;
}

/**
 * Check if LLDB environment is available
 */
export async function checkLLDBEnvironment(
  pythonPath = "python3",
): Promise<LLDBEnvironment> {
  try {
    // Check Python version
    const { stdout: pythonVersion } = await execAsync(`${pythonPath} --version`);
    const versionMatch = pythonVersion.match(/Python (\d+\.\d+)/);

    if (!versionMatch) {
      return {
        available: false,
        pythonPath,
        error: "Failed to parse Python version",
      };
    }

    const majorMinor = versionMatch[1]!;
    const [major, minor] = majorMinor.split(".").map(Number);

    if (major < 3 || (major === 3 && minor < 10)) {
      return {
        available: false,
        pythonPath,
        pythonVersion: majorMinor,
        error: `Python 3.10+ required, found ${majorMinor}`,
      };
    }

    // Check if lldb module is available
    const checkScript = `
import sys
try:
    import lldb
    print(lldb.SBDebugger.Create().GetVersionString())
except ImportError as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`;

    const { stdout: lldbOutput } = await execAsync(`${pythonPath} -c "${checkScript}"`);

    if (lldbOutput.startsWith("ERROR:")) {
      return {
        available: false,
        pythonPath,
        pythonVersion: majorMinor,
        error: "lldb Python module not found",
      };
    }

    return {
      available: true,
      pythonPath,
      pythonVersion: majorMinor,
      lldbVersion: lldbOutput.trim(),
    };
  } catch (err) {
    return {
      available: false,
      pythonPath,
      error: `Environment check failed: ${err}`,
    };
  }
}
```

## 模块导出 (index.ts)

```typescript
/**
 * LLDB protocol module exports
 */

export { LLDBClient } from "./client.js";
export { LLDBBridge } from "./bridge.js";
export { checkLLDBEnvironment } from "./env.js";
export type {
  LLDBConfig,
  LLDBThreadInfo,
  LLDBStackFrame,
  LLDBVariable,
  LLDBBreakpoint,
  LLDBEvent,
  BridgeRequest,
  BridgeResponse,
  BridgeErrorCode,
} from "./types.js";
```

## 协议注册

在 `src/protocol/index.ts` 中添加：

```typescript
// LLDB protocol implementation
import { LLDBClient } from "./lldb/client.js";
export { LLDBClient } from "./lldb/client.js";
export * as lldb from "./lldb/index.js";

// Auto-register LLDB protocol
registerProtocol("lldb", (config) => new LLDBClient(config));
```
