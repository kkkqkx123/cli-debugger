/**
 * ThreadReference Command Set Implementation
 */

import {
  CommandSet,
  ThreadCommand,
  type IDSizes,
  type StackFrameInfo,
  getThreadStateString,
} from "./protocol.js";
import {
  createCommandPacketWithData,
  encodeID,
  encodeUint32,
  encodeValue,
} from "./codec.js";
import { PacketReader } from "./reader.js";
import type { StackFrame } from "../../types/debug.js";
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
 * Get thread name
 */
export async function getThreadName(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<string> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.Name,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get thread name failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readString();
}

/**
 * Get thread status
 */
export async function getThreadStatus(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<{ threadStatus: number; suspendStatus: number }> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.Status,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get thread status failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return {
    threadStatus: reader.readInt(),
    suspendStatus: reader.readInt(),
  };
}

/**
 * Get thread state as string
 */
export async function getThreadState(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<string> {
  const { threadStatus } = await getThreadStatus(executor, threadID);
  return getThreadStateString(threadStatus);
}

/**
 * Suspend thread
 */
export async function suspendThread(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<void> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.Suspend,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Suspend thread failed: ${reply.message}`,
    );
  }
}

/**
 * Resume thread
 */
export async function resumeThread(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<void> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.Resume,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Resume thread failed: ${reply.message}`,
    );
  }
}

/**
 * Get thread frames
 */
export async function getThreadFrames(
  executor: JDWPCommandExecutor,
  threadID: string,
  startFrame: number,
  length: number,
): Promise<StackFrameInfo[]> {
  const data = Buffer.concat([
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeUint32(startFrame),
    encodeUint32(length),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.Frames,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get thread frames failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const frameCount = reader.readInt();

  const frames: StackFrameInfo[] = [];
  for (let i = 0; i < frameCount; i++) {
    const frameID = reader.readID(executor.idSizes.frameIDSize);

    // Read location
    reader.readByte(); // class type tag
    const classID = reader.readID(executor.idSizes.referenceTypeIDSize);
    const methodID = reader.readID(executor.idSizes.methodIDSize);
    reader.readUint64(); // code index

    frames.push({
      frameID,
      location: classID,
      method: methodID,
    });
  }

  return frames;
}

/**
 * Get thread frame count
 */
export async function getThreadFrameCount(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<number> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.FrameCount,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get thread frame count failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readInt();
}

/**
 * Get thread stack frames (full stack trace)
 */
export async function getThreadStack(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<StackFrame[]> {
  const frameCount = await getThreadFrameCount(executor, threadID);
  if (frameCount === 0) {
    return [];
  }

  const frames = await getThreadFrames(executor, threadID, 0, frameCount);

  return frames.map((frame) => ({
    id: frame.frameID,
    location: frame.location,
    method: frame.method,
    line: 0, // Line number needs to be resolved separately
    isNative: false,
  }));
}

/**
 * Get thread group
 */
export async function getThreadGroup(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<string> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.ThreadGroup,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get thread group failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.objectIDSize);
}

/**
 * Get owned monitors
 */
export async function getOwnedMonitors(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<string[]> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.OwnedMonitors,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get owned monitors failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const count = reader.readInt();

  const monitors: string[] = [];
  for (let i = 0; i < count; i++) {
    monitors.push(reader.readID(executor.idSizes.objectIDSize));
  }

  return monitors;
}

/**
 * Get current contended monitor
 */
export async function getCurrentContendedMonitor(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<string> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.CurrentContendedMonitor,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get current contended monitor failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.objectIDSize);
}

/**
 * Stop thread (throw exception)
 */
export async function stopThread(
  executor: JDWPCommandExecutor,
  threadID: string,
  exceptionID: string,
): Promise<void> {
  const data = Buffer.concat([
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeID(exceptionID, executor.idSizes.objectIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.Stop,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Stop thread failed: ${reply.message}`,
    );
  }
}

/**
 * Interrupt thread
 */
export async function interruptThread(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<void> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.Interrupt,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Interrupt thread failed: ${reply.message}`,
    );
  }
}

/**
 * Get suspend count
 */
export async function getSuspendCount(
  executor: JDWPCommandExecutor,
  threadID: string,
): Promise<number> {
  const data = encodeID(threadID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.SuspendCount,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get suspend count failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readInt();
}

/**
 * Force early return from method
 */
export async function forceEarlyReturn(
  executor: JDWPCommandExecutor,
  threadID: string,
  frameID: string,
  value: unknown,
): Promise<void> {
  const parts: Buffer[] = [
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeID(frameID, executor.idSizes.frameIDSize),
    encodeValue(value, executor.idSizes.objectIDSize),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadReference,
    ThreadCommand.ForceEarlyReturn,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Force early return failed: ${reply.message}`,
    );
  }
}
