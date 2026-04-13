/**
 * EventRequest Command Set Implementation
 */

import {
  CommandSet,
  EventRequestCommand,
  EventType,
  SuspendPolicy,
  type IDSizes,
} from "./protocol.js";
import {
  createCommandPacket,
  createCommandPacketWithData,
  encodeID,
  encodeUint32,
  encodeUint64,
  encodeString,
} from "./codec.js";
import { PacketReader } from "./reader.js";
import type { DebugEvent } from "../../types/debug.js";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";

/**
 * JDWP Client interface for command execution
 */
export interface JDWPCommandExecutor {
  sendPacket(packet: Buffer): Promise<void>;
  readReply(): Promise<{ errorCode: number; message: string; data: Buffer }>;
  idSizes: IDSizes;
}

/**
 * Set breakpoint request
 */
export async function setBreakpointRequest(
  executor: JDWPCommandExecutor,
  classID: string,
  methodID: string,
  codeIndex: bigint,
  suspendPolicy: number = SuspendPolicy.EventThread,
): Promise<number> {
  const parts: Buffer[] = [
    // Event type
    Buffer.from([EventType.Breakpoint]),
    // Suspend policy
    Buffer.from([suspendPolicy]),
    // Number of filters (1 filter: LocationOnly)
    encodeUint32(1),
    // Filter type: LocationOnly (7)
    Buffer.from([7]),
    // Class ID
    encodeID(classID, executor.idSizes.referenceTypeIDSize),
    // Method ID
    encodeID(methodID, executor.idSizes.methodIDSize),
    // Code index
    encodeUint64(codeIndex),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set breakpoint request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Clear breakpoint request
 */
export async function clearBreakpointRequest(
  executor: JDWPCommandExecutor,
  requestID: number,
): Promise<void> {
  const data = Buffer.concat([
    Buffer.from([EventType.Breakpoint]),
    encodeUint32(requestID),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Clear,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Clear breakpoint request failed: ${reply.message}`,
    );
  }
}

/**
 * Clear all breakpoints
 */
export async function clearAllBreakpoints(
  executor: JDWPCommandExecutor,
): Promise<void> {
  const packet = createCommandPacket(
    CommandSet.EventRequest,
    EventRequestCommand.ClearAllBreakpoints,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Clear all breakpoints failed: ${reply.message}`,
    );
  }
}

/**
 * Set step request (single step)
 */
export async function setStepRequest(
  executor: JDWPCommandExecutor,
  threadID: string,
  stepKind: number,
  suspendPolicy: number = SuspendPolicy.All,
): Promise<number> {
  const parts: Buffer[] = [
    // Event type
    Buffer.from([EventType.SingleStep]),
    // Suspend policy
    Buffer.from([suspendPolicy]),
    // Number of filters (1 filter: Step)
    encodeUint32(1),
    // Filter type: Step (1)
    Buffer.from([1]),
    // Thread ID
    encodeID(threadID, executor.idSizes.objectIDSize),
    // Step kind
    encodeUint32(stepKind),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set step request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Set class prepare event request
 */
export async function setClassPrepareRequest(
  executor: JDWPCommandExecutor,
  suspendPolicy: number = SuspendPolicy.None,
): Promise<number> {
  const data = Buffer.concat([
    Buffer.from([EventType.ClassPrepare]),
    Buffer.from([suspendPolicy]),
    encodeUint32(0), // No filters
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set class prepare request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Set thread start event request
 */
export async function setThreadStartRequest(
  executor: JDWPCommandExecutor,
  suspendPolicy: number = SuspendPolicy.None,
): Promise<number> {
  const data = Buffer.concat([
    Buffer.from([EventType.ThreadStart]),
    Buffer.from([suspendPolicy]),
    encodeUint32(0), // No filters
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set thread start request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Set thread death event request
 */
export async function setThreadDeathRequest(
  executor: JDWPCommandExecutor,
  suspendPolicy: number = SuspendPolicy.None,
): Promise<number> {
  const data = Buffer.concat([
    Buffer.from([EventType.ThreadDeath]),
    Buffer.from([suspendPolicy]),
    encodeUint32(0), // No filters
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set thread death request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Parse event from composite event packet
 */
export function parseEvent(
  data: Buffer,
  idSizes: IDSizes,
): DebugEvent | null {
  const reader = new PacketReader(data);

  // Read suspend policy
  const suspendPolicy = reader.readByte();

  // Read number of events
  const eventCount = reader.readInt();
  if (eventCount === 0) {
    return null;
  }

  // Read first event
  const eventKind = reader.readByte();
  const requestID = reader.readUint32();
  const threadID = reader.readID(idSizes.objectIDSize);

  // Determine event type
  let eventType: string;
  const location = "";

  switch (eventKind) {
    case EventType.Breakpoint:
      eventType = "breakpoint";
      // Read location for breakpoint
      reader.readByte(); // type tag
      reader.readID(idSizes.referenceTypeIDSize); // classID
      reader.readID(idSizes.methodIDSize); // methodID
      reader.readUint64(); // codeIndex
      break;

    case EventType.SingleStep:
      eventType = "step";
      // Read location for step
      reader.readByte(); // type tag
      reader.readID(idSizes.referenceTypeIDSize); // classID
      reader.readID(idSizes.methodIDSize); // methodID
      reader.readUint64(); // codeIndex
      break;

    case EventType.Exception:
      eventType = "exception";
      // Read exception data
      reader.readByte(); // type tag
      reader.readID(idSizes.objectIDSize); // exception object ID
      reader.readByte(); // catch type tag
      reader.readID(idSizes.referenceTypeIDSize); // catch location class ID
      reader.readID(idSizes.methodIDSize); // catch location method ID
      reader.readUint64(); // catch location code index
      break;

    case EventType.ThreadStart:
      eventType = "thread_start";
      break;

    case EventType.ThreadDeath:
      eventType = "thread_death";
      break;

    case EventType.ClassPrepare:
      eventType = "class_prepare";
      break;

    case EventType.ClassUnload:
      eventType = "class_unload";
      // Read class unload data
      reader.readString(); // class signature
      break;

    case EventType.ClassLoad:
      eventType = "class_load";
      // Read class load data
      reader.readByte(); // type tag
      reader.readID(idSizes.referenceTypeIDSize); // class type ID
      reader.readString(); // class signature
      reader.readInt(); // class status
      break;

    case EventType.FieldAccess:
      eventType = "field_access";
      // Read field access data
      reader.readByte(); // type tag
      reader.readID(idSizes.objectIDSize); // object ID
      reader.readByte(); // field type tag
      reader.readID(idSizes.referenceTypeIDSize); // field declaring class ID
      reader.readID(idSizes.fieldIDSize); // field ID
      break;

    case EventType.FieldModification:
      eventType = "field_modification";
      // Read field modification data
      reader.readByte(); // type tag
      reader.readID(idSizes.objectIDSize); // object ID
      reader.readByte(); // field type tag
      reader.readID(idSizes.referenceTypeIDSize); // field declaring class ID
      reader.readID(idSizes.fieldIDSize); // field ID
      // Read and discard the tagged value (we just need to consume the bytes)
      reader.readTaggedValue(idSizes.objectIDSize);
      break;

    case EventType.VMStart:
      eventType = "vm_start";
      break;

    case EventType.VMDeath:
      eventType = "vm_death";
      break;

    case EventType.MethodEntry:
      eventType = "method_entry";
      // Read location for method entry
      reader.readByte(); // type tag
      reader.readID(idSizes.referenceTypeIDSize); // classID
      reader.readID(idSizes.methodIDSize); // methodID
      reader.readUint64(); // codeIndex
      break;

    case EventType.MethodExit:
      eventType = "method_exit";
      // Read location for method exit
      reader.readByte(); // type tag
      reader.readID(idSizes.referenceTypeIDSize); // classID
      reader.readID(idSizes.methodIDSize); // methodID
      reader.readUint64(); // codeIndex
      break;

    default:
      eventType = `unknown(${eventKind})`;
  }

  return {
    type: eventType,
    threadId: threadID,
    location,
    timestamp: new Date(),
    data: {
      eventKind,
      requestID,
      suspendPolicy,
    },
  };
}

/**
 * Set method entry/exit request
 */
export async function setMethodRequest(
  executor: JDWPCommandExecutor,
  eventType: number,
  classID: string,
  methodID: string,
  suspendPolicy: number = SuspendPolicy.EventThread,
): Promise<number> {
  const parts: Buffer[] = [
    // Event type
    Buffer.from([eventType]),
    // Suspend policy
    Buffer.from([suspendPolicy]),
    // Number of filters (1 filter: LocationOnly)
    encodeUint32(1),
    // Filter type: LocationOnly (7)
    Buffer.from([7]),
    // Class ID
    encodeID(classID, executor.idSizes.referenceTypeIDSize),
    // Method ID
    encodeID(methodID, executor.idSizes.methodIDSize),
    // Code index (0 for method entry/exit)
    encodeUint64(BigInt(0)),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set method request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Set exception breakpoint request
 * @param executor - JDWP command executor
 * @param exceptionRefTypeID - Exception class referenceTypeID (null for all exceptions)
 * @param caught - Whether to catch caught exceptions
 * @param uncaught - Whether to catch uncaught exceptions
 * @param suspendPolicy - Suspend policy for this event
 * @returns requestID for this event request
 */
export async function setExceptionRequest(
  executor: JDWPCommandExecutor,
  exceptionRefTypeID: string | null,
  caught: boolean,
  uncaught: boolean,
  suspendPolicy: number = SuspendPolicy.All,
): Promise<number> {
  const parts: Buffer[] = [
    // Event type: Exception (4)
    Buffer.from([EventType.Exception]),
    // Suspend policy
    Buffer.from([suspendPolicy]),
    // Number of filters (1 filter: ExceptionOnly)
    encodeUint32(1),
    // Filter type: ExceptionOnly (8)
    Buffer.from([8]),
    // Exception reference type ID (0 for all exceptions)
    exceptionRefTypeID
      ? encodeID(exceptionRefTypeID, executor.idSizes.referenceTypeIDSize)
      : encodeID("0", executor.idSizes.referenceTypeIDSize),
    // Caught flag
    Buffer.from([caught ? 1 : 0]),
    // Uncaught flag
    Buffer.from([uncaught ? 1 : 0]),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set exception request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Set field access/modify breakpoint request
 * @param executor - JDWP command executor
 * @param eventType - EventType.FieldAccess (11) or EventType.FieldModification (12)
 * @param declaring - Declaring class referenceTypeID
 * @param fieldID - Field ID
 * @param suspendPolicy - Suspend policy for this event
 * @returns requestID for this event request
 */
export async function setFieldRequest(
  executor: JDWPCommandExecutor,
  eventType: number,
  declaring: string,
  fieldID: string,
  suspendPolicy: number = SuspendPolicy.EventThread,
): Promise<number> {
  const parts: Buffer[] = [
    // Event type: FieldAccess (11) or FieldModification (12)
    Buffer.from([eventType]),
    // Suspend policy
    Buffer.from([suspendPolicy]),
    // Number of filters (1 filter: FieldOnly)
    encodeUint32(1),
    // Filter type: FieldOnly (9)
    Buffer.from([9]),
    // Declaring class ID
    encodeID(declaring, executor.idSizes.referenceTypeIDSize),
    // Field ID
    encodeID(fieldID, executor.idSizes.fieldIDSize),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set field request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Set class load/unload breakpoint request
 * @param executor - JDWP command executor
 * @param eventType - EventType.ClassLoad (10) or EventType.ClassUnload (9)
 * @param classPattern - Class name pattern (supports wildcards like "com.example.*")
 * @param suspendPolicy - Suspend policy for this event
 * @returns requestID for this event request
 */
export async function setClassRequest(
  executor: JDWPCommandExecutor,
  eventType: number,
  classPattern: string,
  suspendPolicy: number = SuspendPolicy.EventThread,
): Promise<number> {
  const parts: Buffer[] = [
    // Event type: ClassLoad (10) or ClassUnload (9)
    Buffer.from([eventType]),
    // Suspend policy
    Buffer.from([suspendPolicy]),
    // Number of filters (1 filter: ClassMatch)
    encodeUint32(1),
    // Filter type: ClassMatch (2)
    Buffer.from([2]),
    // Class pattern (UTF-8 string with length prefix)
    encodeString(classPattern),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set class request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}

/**
 * Set thread start/death breakpoint request
 * @param executor - JDWP command executor
 * @param eventType - EventType.ThreadStart (6) or EventType.ThreadDeath (7)
 * @param threadID - Thread ID
 * @param suspendPolicy - Suspend policy for this event
 * @returns requestID for this event request
 */
export async function setThreadRequest(
  executor: JDWPCommandExecutor,
  eventType: number,
  threadID: string,
  suspendPolicy: number = SuspendPolicy.EventThread,
): Promise<number> {
  const parts: Buffer[] = [
    // Event type: ThreadStart (6) or ThreadDeath (7)
    Buffer.from([eventType]),
    // Suspend policy
    Buffer.from([suspendPolicy]),
    // Number of filters (1 filter: ThreadOnly)
    encodeUint32(1),
    // Filter type: ThreadOnly (4)
    Buffer.from([4]),
    // Thread ID
    encodeID(threadID, executor.idSizes.objectIDSize),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.EventRequest,
    EventRequestCommand.Set,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set thread request failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readUint32();
}
