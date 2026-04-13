/**
 * ClassType Command Set Implementation
 */

import {
  CommandSet,
  ClassTypeCommand,
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
 * Get superclass
 */
export async function getSuperclass(
  executor: JDWPCommandExecutor,
  classID: string,
): Promise<string> {
  const data = encodeID(classID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ClassType,
    ClassTypeCommand.Superclass,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get superclass failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.referenceTypeIDSize);
}

/**
 * Set static field values
 */
export async function setStaticFieldValues(
  executor: JDWPCommandExecutor,
  classID: string,
  fieldValues: Map<string, unknown>,
): Promise<void> {
  const parts: Buffer[] = [
    encodeID(classID, executor.idSizes.referenceTypeIDSize),
    encodeUint32(fieldValues.size),
  ];

  for (const [fieldID, value] of fieldValues) {
    parts.push(encodeID(fieldID, executor.idSizes.fieldIDSize));
    parts.push(encodeValue(value, executor.idSizes.objectIDSize));
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ClassType,
    ClassTypeCommand.SetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set static field values failed: ${reply.message}`,
    );
  }
}

/**
 * Invoke static method
 */
export async function invokeStaticMethod(
  executor: JDWPCommandExecutor,
  classID: string,
  threadID: string,
  methodID: string,
  args: unknown[],
  options: number,
): Promise<{ returnValue: unknown; exception: string }> {
  const parts: Buffer[] = [
    encodeID(classID, executor.idSizes.referenceTypeIDSize),
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
    CommandSet.ClassType,
    ClassTypeCommand.InvokeMethod,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Invoke static method failed: ${reply.message}`,
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
 * Create new instance
 */
export async function newInstance(
  executor: JDWPCommandExecutor,
  classID: string,
  threadID: string,
  methodID: string,
  args: unknown[],
  options: number,
): Promise<{ newInstance: string; exception: string }> {
  const parts: Buffer[] = [
    encodeID(classID, executor.idSizes.referenceTypeIDSize),
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
    CommandSet.ClassType,
    ClassTypeCommand.NewInstance,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Create new instance failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  reader.readByte(); // tag
  const newInstance = reader.readID(executor.idSizes.objectIDSize);
  const exception = reader.readID(executor.idSizes.objectIDSize);

  return { newInstance, exception };
}
