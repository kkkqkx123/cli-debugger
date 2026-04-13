/**
 * JDWP Protocol Constants and Types
 * Based on JDWP Specification
 */

// Packet flags
export const CMD_FLAG = 0x00;
export const REPLY_FLAG = 0x80;

// Command Sets (from JDWP spec)
export const CommandSet = {
  VirtualMachine: 1,
  ReferenceType: 2,
  ClassType: 3,
  ArrayType: 4,
  Method: 5,
  Field: 6,
  ObjectReference: 7,
  StringReference: 8,
  ThreadReference: 10,
  ThreadGroupReference: 11,
  ArrayReference: 12,
  ClassLoaderReference: 13,
  EventRequest: 14,
  StackFrame: 15,
  ClassObjectReference: 16,
  Event: 64,
} as const;

// VirtualMachine Commands
export const VMCommand = {
  Version: 1,
  ClassesBySignature: 2,
  AllClasses: 3,
  AllThreads: 4,
  TopLevelThreadGroups: 5,
  Dispose: 6,
  IDSizes: 7,
  Suspend: 8,
  Resume: 9,
  Exit: 10,
  CreateString: 11,
  Capabilities: 12,
  ClassPaths: 13,
  HoldEvents: 15,
  ReleaseEvents: 16,
  RedefineClasses: 18,
  SetDefaultStratum: 19,
  AllClassesWithGeneric: 20,
} as const;

// ReferenceType Commands
export const ReferenceTypeCommand = {
  Signature: 1,
  ClassLoader: 2,
  Modifiers: 3,
  Fields: 4,
  Methods: 5,
  GetValues: 6,
  SourceFile: 7,
  NestedTypes: 8,
  Status: 9,
  Interfaces: 10,
  ClassObject: 11,
  SourceDebugExtension: 12,
  SignatureWithGeneric: 13,
  FieldsWithGeneric: 14,
  MethodsWithGeneric: 15,
  Instances: 16,
  ClassFileVersion: 17,
  ConstantPool: 18,
} as const;

// Method Commands
export const MethodCommand = {
  LineTable: 1,
  VariableTable: 2,
  Bytecodes: 3,
  IsObsolete: 4,
  VariableTableWithGeneric: 5,
} as const;

// ThreadReference Commands
export const ThreadCommand = {
  Name: 1,
  Suspend: 2,
  Resume: 3,
  Status: 4,
  ThreadGroup: 5,
  Frames: 6,
  FrameCount: 7,
  OwnedMonitors: 8,
  CurrentContendedMonitor: 9,
  Stop: 10,
  Interrupt: 11,
  SuspendCount: 12,
} as const;

// StackFrame Commands
export const StackFrameCommand = {
  GetValues: 1,
  SetValues: 2,
  ThisObject: 3,
  PopFrames: 4,
} as const;

// ObjectReference Commands
export const ObjectReferenceCommand = {
  ReferenceType: 1,
  GetValues: 2,
  SetValues: 3,
  MonitorInfo: 5,
  InvokeMethod: 6,
  DisableCollection: 7,
  EnableCollection: 8,
  IsCollected: 9,
  ReferringObjects: 10,
} as const;

// EventRequest Commands
export const EventRequestCommand = {
  Set: 1,
  Clear: 2,
  ClearAllBreakpoints: 3,
} as const;

// Event Types
export const EventType = {
  SingleStep: 1,
  Breakpoint: 2,
  FramePop: 3,
  Exception: 4,
  UserDefined: 5,
  ThreadStart: 6,
  ThreadDeath: 7,
  ClassPrepare: 8,
  ClassUnload: 9,
  ClassLoad: 10,
  FieldAccess: 11,
  FieldModification: 12,
  VMStart: 13,
  VMDeath: 14,
  VMDisconnected: 15,
} as const;

// Suspend Policy
export const SuspendPolicy = {
  None: 0,
  EventThread: 1,
  All: 2,
} as const;

// Step Kind
export const StepKind = {
  Into: 0,
  Over: 1,
  Out: 2,
} as const;

// Thread States
export const ThreadState = {
  Zombie: 1,
  Running: 2,
  Sleeping: 3,
  Monitor: 4,
  Wait: 5,
  NotStarted: 6,
  Started: 7,
} as const;

// JDWP Error Codes
export const JDWPError = {
  None: 0,
  InvalidThread: 10,
  InvalidMethodID: 13,
  InvalidLocation: 20,
  InvalidFieldID: 21,
  InvalidClass: 22,
  ClassNotPrepared: 23,
  InvalidObject: 24,
  InvalidFrameID: 25,
  OutOfMemory: 112,
  NotImplemented: 99,
  NullObject: 101,
  InvalidTag: 102,
  AlreadyInvoking: 103,
  InvalidIndex: 104,
  InvalidLength: 105,
  InvalidString: 106,
  InvalidClassLoader: 107,
  InvalidArray: 108,
  TransportLoad: 109,
  TransportStart: 110,
  NativeMethod: 111,
  InvalidCount: 113,
  InvalidMonitor: 50,
  NotSuspended: 51,
  InvalidTypestate: 52,
  HierarchyChange: 53,
  DeletedMethod: 54,
  InvalidSlot: 55,
  Duplicate: 56,
  Busy: 11,
  ThreadNotExist: 12,
} as const;

// Error messages map
const ErrorMessages: Record<number, string> = {
  [JDWPError.None]: "error-free",
  [JDWPError.InvalidThread]: "Invalid thread ID",
  [JDWPError.InvalidMethodID]: "Invalid Method ID",
  [JDWPError.InvalidLocation]: "void",
  [JDWPError.InvalidFieldID]: "Invalid Field ID",
  [JDWPError.InvalidClass]: "void class",
  [JDWPError.ClassNotPrepared]: "Class not ready",
  [JDWPError.InvalidObject]: "null object",
  [JDWPError.InvalidFrameID]: "Invalid Frame ID",
  [JDWPError.OutOfMemory]: "lack of memory",
  [JDWPError.NotImplemented]: "unrealized",
  [JDWPError.NullObject]: "empty object",
  [JDWPError.InvalidTag]: "Invalid labels",
  [JDWPError.AlreadyInvoking]: "Already in call",
  [JDWPError.InvalidIndex]: "Invalid Index",
  [JDWPError.InvalidLength]: "Invalid length",
  [JDWPError.InvalidString]: "Invalid String",
  [JDWPError.InvalidCount]: "invalid count",
  [JDWPError.NotSuspended]: "Thread not hung",
  [JDWPError.Busy]: "VM is busy.",
  [JDWPError.ThreadNotExist]: "Thread does not exist",
};

/**
 * Get error message for JDWP error code
 */
export function getErrorMessage(errorCode: number): string {
  return ErrorMessages[errorCode] ?? `Unknown error (${errorCode})`;
}

/**
 * Get thread state string
 */
export function getThreadStateString(state: number): string {
  switch (state) {
    case ThreadState.Zombie:
      return "zombie";
    case ThreadState.Running:
      return "running";
    case ThreadState.Sleeping:
      return "sleeping";
    case ThreadState.Monitor:
      return "waiting-for-monitor";
    case ThreadState.Wait:
      return "waiting";
    case ThreadState.NotStarted:
      return "not-started";
    case ThreadState.Started:
      return "started";
    default:
      return `unknown(${state})`;
  }
}

/**
 * Command packet structure
 */
export interface CommandPacket {
  id: number;
  flags: number;
  commandSet: number;
  command: number;
  data: Buffer;
}

/**
 * Reply packet structure
 */
export interface ReplyPacket {
  id: number;
  flags: number;
  errorCode: number;
  message: string;
  data: Buffer;
}

/**
 * ID sizes information
 */
export interface IDSizes {
  fieldIDSize: number;
  methodIDSize: number;
  objectIDSize: number;
  referenceTypeIDSize: number;
  frameIDSize: number;
}

/**
 * Class information
 */
export interface ClassInfo {
  tag: number;
  refID: string;
  status: number;
}

/**
 * Field information
 */
export interface FieldInfo {
  fieldID: string;
  name: string;
  signature: string;
  modifiers: number;
}

/**
 * Method information
 */
export interface MethodInfo {
  methodID: string;
  name: string;
  signature: string;
  modifiers: number;
}

/**
 * Line location information
 */
export interface LineLocation {
  lineCodeIndex: bigint;
  lineNumber: number;
}

/**
 * Variable information (from method)
 */
export interface VariableInfo {
  slot: number;
  name: string;
  signature: string;
  codeIndex: bigint;
}

/**
 * Stack frame information
 */
export interface StackFrameInfo {
  frameID: string;
  location: string;
  method: string;
}

/**
 * Breakpoint info (internal)
 */
export interface InternalBreakpointInfo {
  id: string;
  requestID: number;
  location: string;
  enabled: boolean;
  hitCount: number;
}

/**
 * Monitor information
 */
export interface MonitorInfo {
  owner: string;
  entryCount: number;
  waiters: string[];
  waitersCount: number;
}

/**
 * VM Capabilities information
 */
export interface VMCapabilitiesInfo {
  canWatchFieldModification: boolean;
  canWatchFieldAccess: boolean;
  canGetBytecodes: boolean;
  canGetSyntheticAttribute: boolean;
  canGetOwnedMonitorInfo: boolean;
  canGetCurrentContendedMonitor: boolean;
  canGetMonitorInfo: boolean;
  canRedefineClasses: boolean;
  canAddMethod: boolean;
  canUnrestrictedlyRedefineClasses: boolean;
  canPopFrames: boolean;
  canUseInstanceFilters: boolean;
  canGetSourceDebugExtension: boolean;
  canRequestVMDeathEvent: boolean;
  canSetDefaultStratum: boolean;
  canGetInstanceInfo: boolean;
  canRequestMonitorEvents: boolean;
  canGetMonitorFrameInfo: boolean;
  canGetConstantPool: boolean;
  canSetNativeMethodPrefix: boolean;
  canRedefineClassesWhenMismatched: boolean;
}

/**
 * Class paths information
 */
export interface ClassPathsInfo {
  classpath: string[];
  bootClasspath: string[];
}

/**
 * Class definition for redefinition
 */
export interface ClassDef {
  refTypeID: string;
  classBytes: Buffer;
}
