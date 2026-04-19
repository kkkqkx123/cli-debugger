/**
 * Delve protocol type definitions
 * Types for Delve debugger JSON-RPC API
 */

// ==================== JSON-RPC Types ====================

/** JSON-RPC 2.0 Request */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

/** JSON-RPC 2.0 Response */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: JsonRpcError;
}

/** JSON-RPC Error */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ==================== Location Types ====================

/** Delve function information */
export interface DlvFunction {
  name: string;
  value: number;
  type: number;
  goType: number;
}

/** Delve source location */
export interface DlvLocation {
  pc: number;
  file: string;
  line: number;
  function: DlvFunction | null;
}

// ==================== Thread/Goroutine Types ====================

/** Delve thread information */
export interface DlvThread {
  id: number;
  pc: number;
  file: string;
  line: number;
  function: DlvFunction | null;
  goroutineID: number;
  breakPoint: DlvBreakpoint | null;
  breakPointInfo: DlvBreakPointInfo | null;
}

/** Delve goroutine information */
export interface DlvGoroutine {
  id: number;
  currentLoc: DlvLocation;
  userCurrentLoc: DlvLocation;
  goStatementLoc: DlvLocation;
  threadId: number;
  systemStack: boolean;
  // Aliases for Delve's JSON field names (capitalized)
  CurrentLoc?: DlvLocation;
  UserCurrentLoc?: DlvLocation;
  GoStatementLoc?: DlvLocation;
  ThreadID?: number;
  SystemStack?: boolean;
}

/** Goroutine list result with pagination */
export interface DlvGoroutinesResult {
  Goroutines: DlvGoroutine[];
  Nextg: number;
  GroupBy: DlvGroupBy | null;
}

/** Goroutine grouping information */
export interface DlvGroupBy {
  Group: string;
  Goroutines: number[];
  Count: number;
}

// ==================== Breakpoint Types ====================

/** Delve breakpoint information */
export interface DlvBreakpoint {
  id: number;
  name: string;
  addr: number;
  file: string;
  line: number;
  functionName: string;
  Cond: string;
  hitCount: number;
  disabled: boolean;
  tracepoint: boolean;
  retrieveGoroutineInfo: boolean;
  stacktrace: number;
  goroutine: boolean;
  variables: string[];
  loadArgs: DlvLoadConfig | null;
  loadLocals: DlvLoadConfig | null;
  userData: unknown;
  /** Command to execute when breakpoint is hit */
  on?: string;
}

/** Breakpoint hit information */
export interface DlvBreakPointInfo {
  Breakpoint: DlvBreakpoint;
  Goroutine: DlvGoroutine | null;
  Stacktrace: DlvStackFrame[] | null;
  Variables: DlvVariable[][] | null;
  Arguments: DlvVariable[][] | null;
}

/** Load configuration for variables */
export interface DlvLoadConfig {
  followPointers: boolean;
  maxVariableRecurse: number;
  maxStringLen: number;
  maxArrayValues: number;
  maxStructFields: number;
}

// ==================== Stack Types ====================

/** Deferred call information */
export interface DlvDeferredCall {
  index: number;
  function: DlvFunction | null;
  location: DlvLocation;
  unreadable: string;
}

/** Delve stack frame */
export interface DlvStackFrame {
  file: string;
  line: number;
  function: DlvFunction | null;
  pc: number;
  goroutineID: number;
  systemStack: boolean;
  /** Deferred calls in this frame */
  defers?: DlvDeferredCall[];
}

/** Stack frame with additional info */
export interface DlvStackFrameInfo {
  address: number;
  file: string;
  line: number;
  function: DlvFunction | null;
  pc: number;
}

// ==================== Variable Types ====================

/** Variable kind enumeration */
export enum VariableKind {
  Invalid = 0,
  Bool = 1,
  Int = 2,
  Float = 3,
  String = 4,
  Array = 5,
  Slice = 6,
  Struct = 7,
  Pointer = 8,
  Interface = 9,
  Map = 10,
  Complex = 11,
  Chan = 12,
  Func = 13,
  UnsafePointer = 14,
}

/** Delve variable information */
export interface DlvVariable {
  name: string;
  addr: number;
  type: string;
  realType: string;
  value: string;
  kind: VariableKind;
  children: DlvVariable[];
  len: number;
  cap: number;
  flags: number;
  onlyAddr: boolean;
  base: number;
  stride: number;
  unreadable: string;
  LocationExpr: string;
  DeclLine: number;
}

// ==================== Debugger State Types ====================

/** Debugger state */
export interface DlvDebuggerState {
  running: boolean;
  recording: boolean;
  recordingManuallyStarted: boolean;
  currentThread: DlvThread | null;
  currentGoroutine: DlvGoroutine | null;
  SelectedGoroutine: DlvGoroutine | null;
  exited: boolean;
  exitStatus: number;
  when: string;
}

/** Command result with state */
export interface DlvCommandResult {
  State: DlvDebuggerState;
}

// ==================== Version Types ====================

/** Delve version information */
export interface DlvVersion {
  DelveVersion: string;
  APIVersion: string;
}

// ==================== Command Types ====================

/** Execution command names */
export type DlvCommandName =
  | "continue"
  | "next"
  | "step"
  | "stepout"
  | "halt"
  | "switchGoroutine"
  | "switchThread"
  | "rewind"
  | "call"
  | "nextInstruction"
  | "stepInstruction";

/** Command request parameters */
export interface DlvCommandParams {
  name: DlvCommandName;
  goroutineID?: number;
  threadID?: number;
  expr?: string;
  unsafeCall?: boolean;
}

// ==================== API Parameter Types ====================

/** Create breakpoint parameters */
export interface DlvCreateBreakpointParams {
  id?: number;
  name?: string;
  addr?: number;
  file?: string;
  line?: number;
  functionName?: string;
  Cond?: string;
  tracepoint?: boolean;
}

/** List goroutines parameters */
export interface DlvListGoroutinesParams {
  start?: number;
  count?: number;
  labels?: Record<string, string>;
  filter?: DlvGoroutineFilter;
  groupBy?: DlvGroupByType;
  groupByArg?: string;
}

/** Goroutine filter */
export interface DlvGoroutineFilter {
  kind: DlvFilterKind;
  arg: string | number | boolean;
}

/** Filter kind */
export type DlvFilterKind =
  | "none"
  | "userloc"
  | "curloc"
  | "goloc"
  | "startloc"
  | "label"
  | "running"
  | "user";

/** Group by type */
export type DlvGroupByType =
  | "userloc"
  | "curloc"
  | "goloc"
  | "startloc"
  | "running"
  | "user"
  | "label";

/** Stacktrace parameters */
export interface DlvStacktraceParams {
  id?: number;
  goroutineID?: number;
  depth?: number;
  full?: boolean;
  defers?: boolean;
  opts?: DlvStacktraceOptions;
}

/** Stacktrace options */
export interface DlvStacktraceOptions {
  goroutineID: number;
  frame: number;
}

/** Eval parameters */
export interface DlvEvalParams {
  expr: string;
  scope?: DlvEvalScope;
  cfg?: DlvLoadConfig;
}

/** Eval scope */
export interface DlvEvalScope {
  goroutineID: number;
  frame: number;
  deferredCall: number;
}

/** List variables parameters */
export interface DlvListVarsParams {
  scope: DlvEvalScope;
  cfg?: DlvLoadConfig;
}

// ==================== Checkpoint Types ====================

/** Checkpoint information */
export interface DlvCheckpoint {
  ID: number;
  When: string;
  Position: DlvLocation;
}

// ==================== Library Types ====================

/** Dynamic library information */
export interface DlvLibrary {
  path: string;
  address: number;
  loaded: boolean;
}

// ==================== Display Types ====================

/** Display expression (auto-print on each stop) */
export interface DlvDisplay {
  id: number;
  expr: string;
}

// ==================== Helper Functions ====================

/**
 * Check if variable is primitive type
 */
export function isPrimitiveKind(kind: VariableKind): boolean {
  return (
    kind === VariableKind.Bool ||
    kind === VariableKind.Int ||
    kind === VariableKind.Float ||
    kind === VariableKind.String ||
    kind === VariableKind.Complex
  );
}

/**
 * Check if variable is composite type
 */
export function isCompositeKind(kind: VariableKind): boolean {
  return (
    kind === VariableKind.Array ||
    kind === VariableKind.Slice ||
    kind === VariableKind.Struct ||
    kind === VariableKind.Map ||
    kind === VariableKind.Interface
  );
}

/**
 * Get default load config
 */
export function getDefaultLoadConfig(): DlvLoadConfig {
  return {
    followPointers: true,
    maxVariableRecurse: 1,
    maxStringLen: 64,
    maxArrayValues: 64,
    maxStructFields: -1,
  };
}
