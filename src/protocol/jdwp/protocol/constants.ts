/**
 * JDWP Protocol Constants
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
  ThreadReference: 11,
  ThreadGroupReference: 12,
  ArrayReference: 13,
  ClassLoaderReference: 14,
  EventRequest: 15,
  StackFrame: 16,
  ClassObjectReference: 17,
  ModuleReference: 18,
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
  SetValues: 19,
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
  ForceEarlyReturn: 14,
} as const;

// StackFrame Commands
export const StackFrameCommand = {
  GetValues: 1,
  SetValues: 2,
  ThisObject: 3,
  PopFrames: 4,
} as const;

// ArrayReference Commands
export const ArrayReferenceCommand = {
  Length: 1,
  GetValues: 2,
  SetValues: 3,
} as const;

// ClassLoaderReference Commands
export const ClassLoaderReferenceCommand = {
  VisibleClasses: 1,
} as const;

// StringReference Commands
export const StringReferenceCommand = {
  Value: 1,
} as const;

// ThreadGroupReference Commands
export const ThreadGroupReferenceCommand = {
  Name: 1,
  Parent: 2,
  Children: 3,
} as const;

// ClassObjectReference Commands
export const ClassObjectReferenceCommand = {
  ReflectedType: 1,
} as const;

// ModuleReference Commands
export const ModuleReferenceCommand = {
  Name: 1,
  ClassLoader: 2,
} as const;

// ClassType Commands
export const ClassTypeCommand = {
  Superclass: 1,
  SetValues: 2,
  InvokeMethod: 3,
  NewInstance: 4,
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
  MethodEntry: 40,
  MethodExit: 41,
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
