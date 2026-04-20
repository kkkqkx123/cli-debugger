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

// ==================== Extended Types ====================

/** Register information */
export interface LLDBRegister {
  name: string;
  value: string;
  type?: string;
  size?: number;
}

/** Register set */
export interface LLDBRegisterSet {
  name: string;
  registers: LLDBRegister[];
}

/** Process exit information */
export interface LLDBExitInfo {
  status: number | null;
  description: string | null;
  state: string;
}

/** Expression evaluation options */
export interface LLDBEvalOptions {
  timeout?: number; // milliseconds
  unwindOnError?: boolean;
  ignoreBreakpoints?: boolean;
}

/** Target information */
export interface LLDBTargetInfo {
  executable: string | null;
  triple: string;
  numModules: number;
  numBreakpoints: number;
  byteOrder: string;
}

// ==================== P2 Feature Types ====================

/** LLDB breakpoint location (P2) */
export interface LLDBBreakpointLocation {
  id: number;
  address: number;
  file: string | null;
  line: number;
  column: number;
  enabled: boolean;
  resolved: boolean;
}

/** Target metadata (P2) */
export interface LLDBTargetMetadata {
  executable: string;
  triple: string;
  numModules: number;
  numSections: number;
  numSymbols: number;
}

/** Module info (P2) */
export interface LLDBModuleInfo {
  name: string;
  file: string;
  uuid: string;
  numSections: number;
  numSymbols: number;
}

/** Symbol info (P2) */
export interface LLDBSymbolInfo {
  name: string;
  type: "code" | "data" | "debug" | "other";
  address: number;
  size: number;
  module: string | null;
}

/** Type info (P2) */
export interface LLDBTypeInfo {
  name: string;
  basicType: string;
  byteSize: number;
  isPointer: boolean;
  isReference: boolean;
  isArray: boolean;
  isStruct: boolean;
  isTypedef: boolean;
  numChildren: number;
}

/** Thread batch info (P2) */
export interface LLDBThreadBatchInfo {
  addresses: number[];
  modules: string[];
  symbols: string[];
  files: string[];
  lines: number[];
  functions: string[];
}

/** Process I/O result (P2) */
export interface LLDBProcessIOResult {
  bytesRead: number;
  data: string; // Base64 encoded
}

/** Regex breakpoint options (P2) */
export interface LLDBRegexBreakpointOptions {
  pattern: string;
  file?: string;
  condition?: string;
  ignoreCount?: number;
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

export type BridgeErrorCode =
  (typeof BridgeErrorCodes)[keyof typeof BridgeErrorCodes];

/** P2 Bridge error codes */
export const P2BridgeErrorCodes = {
  MODULE_NOT_FOUND: "MODULE_NOT_FOUND",
  SYMBOL_NOT_FOUND: "SYMBOL_NOT_FOUND",
  TYPE_NOT_FOUND: "TYPE_NOT_FOUND",
  IO_ERROR: "IO_ERROR",
  REGEX_INVALID: "REGEX_INVALID",
} as const;

export type P2BridgeErrorCode =
  (typeof P2BridgeErrorCodes)[keyof typeof P2BridgeErrorCodes];
