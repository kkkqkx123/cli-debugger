/**
 * JDWP Protocol Module
 * Java Debug Wire Protocol implementation
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
} from "./protocol.js";

// Re-export constants
export {
  CommandSet,
  VMCommand,
  ReferenceTypeCommand,
  MethodCommand,
  ThreadCommand,
  StackFrameCommand,
  ObjectReferenceCommand,
  EventRequestCommand,
  EventType,
  SuspendPolicy,
  StepKind,
  ThreadState,
  JDWPError,
  getErrorMessage,
  getThreadStateString,
} from "./protocol.js";

// Re-export client
export { JDWPClient } from "./client.js";

// Re-export codec utilities
export {
  getNextPacketId,
  resetPacketIdCounter,
  encodeCommandPacket,
  createCommandPacket,
  createCommandPacketWithData,
  decodeReplyPacket,
  encodeID,
  encodeString,
  decodeString,
  encodeUint32,
  encodeInt32,
  encodeUint64,
  encodeInt64,
  encodeByte,
  encodeBoolean,
  isPrimitiveTag,
  encodeValue,
} from "./codec.js";

// Re-export reader
export { PacketReader, createReader } from "./reader.js";

// Re-export command modules
export * as vm from "./vm.js";
export * as referenceType from "./reference-type.js";
export * as method from "./method.js";
export * as thread from "./thread.js";
export * as stackFrame from "./stack-frame.js";
export * as objectReference from "./object-reference.js";
export * as event from "./event.js";
