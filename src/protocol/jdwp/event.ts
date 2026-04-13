/**
 * EventRequest Command Set Implementation
 */

import {
  CommandSet,
  EventRequestCommand,
  EventType,
  SuspendPolicy,
  StepKind,
  type IDSizes,
} from "./protocol.js";
import {
  createCommandPacket,
  createCommandPacketWithData,
  encodeID,
  encodeUint32,
  encodeUint64,
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
  let location = "";

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
      break;

    case EventType.VMStart:
      eventType = "vm_start";
      break;

    case EventType.VMDeath:
      eventType = "vm_death";
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
