/**
 * StackFrame Command Set Implementation
 */

import {
  CommandSet,
  StackFrameCommand,
  type IDSizes,
} from "./protocol/index.js";
import {
  createCommandPacketWithData,
  encodeID,
  encodeUint32,
  isPrimitiveTag,
} from "./codec.js";
import { PacketReader } from "./reader.js";
import type { Variable } from "../../types/debug.js";
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
 * Get stack frame values (local variables)
 */
export async function getStackFrameValues(
  executor: JDWPCommandExecutor,
  threadID: string,
  frameID: string,
  slots: number,
): Promise<Variable[]> {
  const data = Buffer.concat([
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeID(frameID, executor.idSizes.frameIDSize),
    encodeUint32(slots),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.StackFrame,
    StackFrameCommand.GetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get stack frame values failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const valueCount = reader.readInt();

  const variables: Variable[] = [];
  for (let i = 0; i < valueCount; i++) {
    const { tag, value } = reader.readTaggedValue(executor.idSizes.objectIDSize);

    variables.push({
      name: `var_${i}`,
      type: String.fromCharCode(tag),
      value,
      isPrimitive: isPrimitiveTag(tag),
      isNull: value === null || value === undefined,
    });
  }

  return variables;
}

/**
 * Set stack frame values
 */
export async function setStackFrameValues(
  executor: JDWPCommandExecutor,
  threadID: string,
  frameID: string,
  values: Map<number, unknown>,
): Promise<void> {
  const parts: Buffer[] = [
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeID(frameID, executor.idSizes.frameIDSize),
    encodeUint32(values.size),
  ];

  for (const [slot, value] of values) {
    parts.push(encodeUint32(slot));
    parts.push(encodeID(String(value), executor.idSizes.objectIDSize));
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.StackFrame,
    StackFrameCommand.SetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set stack frame values failed: ${reply.message}`,
    );
  }
}

/**
 * Get this object from stack frame
 */
export async function getThisObject(
  executor: JDWPCommandExecutor,
  threadID: string,
  frameID: string,
): Promise<{ tag: number; objectID: string }> {
  const data = Buffer.concat([
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeID(frameID, executor.idSizes.frameIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.StackFrame,
    StackFrameCommand.ThisObject,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get this object failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const tag = reader.readByte();
  const objectID = reader.readID(executor.idSizes.objectIDSize);

  return { tag, objectID };
}

/**
 * Pop frames
 */
export async function popFrames(
  executor: JDWPCommandExecutor,
  threadID: string,
  frameID: string,
): Promise<void> {
  const data = Buffer.concat([
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeID(frameID, executor.idSizes.frameIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.StackFrame,
    StackFrameCommand.PopFrames,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Pop frames failed: ${reply.message}`,
    );
  }
}
