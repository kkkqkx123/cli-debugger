/**
 * JDWP Protocol Types
 * Based on JDWP Specification
 */

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
