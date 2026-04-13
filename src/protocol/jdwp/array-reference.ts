/**
 * ArrayReference Command Set Implementation
 */

import {
  CommandSet,
  ArrayReferenceCommand,
  type IDSizes,
} from "./protocol.js";
import {
  createCommandPacketWithData,
  encodeID,
  encodeUint32,
  encodeValue,
} from "./codec.js";
import { PacketReader } from "./reader.js";
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
 * Get array length
 */
export async function getArrayLength(
  executor: JDWPCommandExecutor,
  arrayID: string,
): Promise<number> {
  const data = encodeID(arrayID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ArrayReference,
    ArrayReferenceCommand.Length,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get array length failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readInt();
}

/**
 * Get array values
 */
export async function getArrayValues(
  executor: JDWPCommandExecutor,
  arrayID: string,
  startIndex: number,
  length: number,
): Promise<unknown[]> {
  const data = Buffer.concat([
    encodeID(arrayID, executor.idSizes.objectIDSize),
    encodeUint32(startIndex),
    encodeUint32(length),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.ArrayReference,
    ArrayReferenceCommand.GetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get array values failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const values: unknown[] = [];

  for (let i = 0; i < length; i++) {
    const { value } = reader.readTaggedValue(executor.idSizes.objectIDSize);
    values.push(value);
  }

  return values;
}

/**
 * Set array values
 */
export async function setArrayValues(
  executor: JDWPCommandExecutor,
  arrayID: string,
  startIndex: number,
  values: unknown[],
): Promise<void> {
  const parts: Buffer[] = [
    encodeID(arrayID, executor.idSizes.objectIDSize),
    encodeUint32(startIndex),
    encodeUint32(values.length),
  ];

  for (const value of values) {
    parts.push(encodeValue(value, executor.idSizes.objectIDSize));
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ArrayReference,
    ArrayReferenceCommand.SetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set array values failed: ${reply.message}`,
    );
  }
}
