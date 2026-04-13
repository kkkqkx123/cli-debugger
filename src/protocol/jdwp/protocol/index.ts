/**
 * JDWP Protocol Module
 * Re-exports all protocol constants, types, and utilities
 */

// Re-export types
export type {
  IDSizes,
  ClassInfo,
  FieldInfo,
  MethodInfo,
  LineLocation,
  VariableInfo,
  StackFrameInfo,
  InternalBreakpointInfo,
  MonitorInfo,
  VMCapabilitiesInfo,
  ClassPathsInfo,
  ClassDef,
  CommandPacket,
  ReplyPacket,
} from "./types.js";

// Re-export constants
export {
  CMD_FLAG,
  REPLY_FLAG,
  CommandSet,
  VMCommand,
  ReferenceTypeCommand,
  MethodCommand,
  ThreadCommand,
  StackFrameCommand,
  ArrayReferenceCommand,
  ClassLoaderReferenceCommand,
  StringReferenceCommand,
  ThreadGroupReferenceCommand,
  ClassObjectReferenceCommand,
  ModuleReferenceCommand,
  ClassTypeCommand,
  ObjectReferenceCommand,
  EventRequestCommand,
  EventType,
  SuspendPolicy,
  StepKind,
  ThreadState,
  JDWPError,
} from "./constants.js";

// Re-export utils
export { getErrorMessage, getThreadStateString } from "./utils.js";
