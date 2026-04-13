/**
 * ObjectReference Command Set Implementation
 */

import {
  CommandSet,
  ObjectReferenceCommand,
  type IDSizes,
  type MonitorInfo,
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
 * Get object reference type
 */
export async function getReferenceType(
  executor: JDWPCommandExecutor,
  objectID: string,
): Promise<{ tag: number; refTypeID: string }> {
  const data = encodeID(objectID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.ReferenceType,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get reference type failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const tag = reader.readByte();
  const refTypeID = reader.readID(executor.idSizes.referenceTypeIDSize);

  return { tag, refTypeID };
}

/**
 * Get instance field values
 */
export async function getInstanceFieldValues(
  executor: JDWPCommandExecutor,
  objectID: string,
  fieldIDs: string[],
): Promise<unknown[]> {
  const parts: Buffer[] = [
    encodeID(objectID, executor.idSizes.objectIDSize),
    encodeUint32(fieldIDs.length),
  ];

  for (const fieldID of fieldIDs) {
    parts.push(encodeID(fieldID, executor.idSizes.fieldIDSize));
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.GetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get instance field values failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const values: unknown[] = [];

  for (let i = 0; i < fieldIDs.length; i++) {
    const { value } = reader.readTaggedValue(executor.idSizes.objectIDSize);
    values.push(value);
  }

  return values;
}

/**
 * Set instance field values
 */
export async function setInstanceFieldValues(
  executor: JDWPCommandExecutor,
  objectID: string,
  fieldValues: Map<string, unknown>,
): Promise<void> {
  const parts: Buffer[] = [
    encodeID(objectID, executor.idSizes.objectIDSize),
    encodeUint32(fieldValues.size),
  ];

  for (const [fieldID, value] of fieldValues) {
    parts.push(encodeID(fieldID, executor.idSizes.fieldIDSize));
    parts.push(encodeValue(value, executor.idSizes.objectIDSize));
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.SetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set instance field values failed: ${reply.message}`,
    );
  }
}

/**
 * Get object monitor info
 */
export async function getMonitorInfo(
  executor: JDWPCommandExecutor,
  objectID: string,
): Promise<MonitorInfo> {
  const data = encodeID(objectID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.MonitorInfo,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get monitor info failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const owner = reader.readID(executor.idSizes.objectIDSize);
  const entryCount = reader.readInt();
  const waitersCount = reader.readInt();

  const waiters: string[] = [];
  for (let i = 0; i < waitersCount; i++) {
    waiters.push(reader.readID(executor.idSizes.objectIDSize));
  }

  return { owner, entryCount, waiters, waitersCount };
}

/**
 * Invoke instance method
 */
export async function invokeInstanceMethod(
  executor: JDWPCommandExecutor,
  objectID: string,
  threadID: string,
  methodID: string,
  args: unknown[],
  options: number,
): Promise<{ returnValue: unknown; exception: string }> {
  const parts: Buffer[] = [
    encodeID(objectID, executor.idSizes.objectIDSize),
    encodeID(threadID, executor.idSizes.objectIDSize),
    encodeID(methodID, executor.idSizes.methodIDSize),
    encodeUint32(args.length),
  ];

  for (const arg of args) {
    parts.push(encodeValue(arg, executor.idSizes.objectIDSize));
  }

  parts.push(encodeUint32(options));

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.InvokeMethod,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Invoke instance method failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const { value: returnValue } = reader.readTaggedValue(
    executor.idSizes.objectIDSize,
  );
  const exception = reader.readID(executor.idSizes.objectIDSize);

  return { returnValue, exception };
}

/**
 * Disable object garbage collection
 */
export async function disableCollection(
  executor: JDWPCommandExecutor,
  objectID: string,
): Promise<void> {
  const data = encodeID(objectID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.DisableCollection,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Disable collection failed: ${reply.message}`,
    );
  }
}

/**
 * Enable object garbage collection
 */
export async function enableCollection(
  executor: JDWPCommandExecutor,
  objectID: string,
): Promise<void> {
  const data = encodeID(objectID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.EnableCollection,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Enable collection failed: ${reply.message}`,
    );
  }
}

/**
 * Check if object is collected
 */
export async function isCollected(
  executor: JDWPCommandExecutor,
  objectID: string,
): Promise<boolean> {
  const data = encodeID(objectID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.IsCollected,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Check if collected failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readByte() !== 0;
}

/**
 * Get referring objects
 */
export async function getReferringObjects(
  executor: JDWPCommandExecutor,
  objectID: string,
  maxReferrers: number,
): Promise<string[]> {
  const data = Buffer.concat([
    encodeID(objectID, executor.idSizes.objectIDSize),
    encodeUint32(maxReferrers),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.ObjectReference,
    ObjectReferenceCommand.ReferringObjects,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get referring objects failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const count = reader.readInt();

  const referringObjects: string[] = [];
  for (let i = 0; i < count; i++) {
    referringObjects.push(reader.readID(executor.idSizes.objectIDSize));
  }

  return referringObjects;
}
