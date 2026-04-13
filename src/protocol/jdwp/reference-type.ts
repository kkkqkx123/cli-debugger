/**
 * ReferenceType Command Set Implementation
 */

import {
  CommandSet,
  ReferenceTypeCommand,
  type IDSizes,
  type FieldInfo,
  type MethodInfo,
} from "./protocol/index.js";
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
 * Get class signature
 */
export async function getSignature(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<string> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.Signature,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get signature failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readString();
}

/**
 * Get class fields
 */
export async function getFields(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<FieldInfo[]> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.Fields,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get fields failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const declared = reader.readInt();

  const fields: FieldInfo[] = [];
  for (let i = 0; i < declared; i++) {
    const fieldID = reader.readID(executor.idSizes.fieldIDSize);
    const name = reader.readString();
    const signature = reader.readString();
    const modifiers = reader.readInt();

    fields.push({ fieldID, name, signature, modifiers });
  }

  return fields;
}

/**
 * Get class methods
 */
export async function getMethods(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<MethodInfo[]> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.Methods,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get methods failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const declared = reader.readInt();

  const methods: MethodInfo[] = [];
  for (let i = 0; i < declared; i++) {
    const methodID = reader.readID(executor.idSizes.methodIDSize);
    const name = reader.readString();
    const signature = reader.readString();
    const modifiers = reader.readInt();

    methods.push({ methodID, name, signature, modifiers });
  }

  return methods;
}

/**
 * Get source file name
 */
export async function getSourceFile(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<string> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.SourceFile,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get source file failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readString();
}

/**
 * Get static field values
 */
export async function getStaticFieldValues(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  fieldIDs: string[],
): Promise<unknown[]> {
  const parts: Buffer[] = [
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeUint32(fieldIDs.length),
  ];

  for (const fieldID of fieldIDs) {
    parts.push(encodeID(fieldID, executor.idSizes.fieldIDSize));
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.GetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get static field values failed: ${reply.message}`,
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
 * Get static field values with tags
 */
export async function getValuesWithTags(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  fieldIDs: string[],
): Promise<{ tags: number[]; values: unknown[] }> {
  const parts: Buffer[] = [
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeUint32(fieldIDs.length),
  ];

  for (const fieldID of fieldIDs) {
    parts.push(encodeID(fieldID, executor.idSizes.fieldIDSize));
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.GetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get static field values failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const tags: number[] = [];
  const values: unknown[] = [];

  for (let i = 0; i < fieldIDs.length; i++) {
    const { tag, value } = reader.readTaggedValue(executor.idSizes.objectIDSize);
    tags.push(tag);
    values.push(value);
  }

  return { tags, values };
}

/**
 * Set static field value
 */
export async function setStaticFieldValue(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  fieldID: string,
  value: unknown,
): Promise<void> {
  const parts: Buffer[] = [
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeUint32(1),
    encodeID(fieldID, executor.idSizes.fieldIDSize),
    encodeValue(value, executor.idSizes.objectIDSize),
  ];

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.SetValues,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Set static field value failed: ${reply.message}`,
    );
  }
}

/**
 * Get class status
 */
export async function getStatus(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<number> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.Status,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get class status failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readInt();
}

/**
 * Get implemented interfaces
 */
export async function getInterfaces(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<string[]> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.Interfaces,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get interfaces failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const count = reader.readInt();

  const interfaces: string[] = [];
  for (let i = 0; i < count; i++) {
    interfaces.push(reader.readID(executor.idSizes.referenceTypeIDSize));
  }

  return interfaces;
}

/**
 * Get class object
 */
export async function getClassObject(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<string> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.ClassObject,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get class object failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.objectIDSize);
}

/**
 * Get class instances
 */
export async function getInstances(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  maxInstances: number,
): Promise<string[]> {
  const data = Buffer.concat([
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeUint32(maxInstances),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.Instances,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get instances failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const count = reader.readInt();

  const instances: string[] = [];
  for (let i = 0; i < count; i++) {
    instances.push(reader.readID(executor.idSizes.objectIDSize));
  }

  return instances;
}

/**
 * Get class file version
 */
export async function getClassFileVersion(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<{ majorVersion: number; minorVersion: number }> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.ClassFileVersion,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get class file version failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return {
    majorVersion: reader.readInt(),
    minorVersion: reader.readInt(),
  };
}

/**
 * Get class loader
 */
export async function getClassLoader(
  executor: JDWPCommandExecutor,
  refTypeID: string,
): Promise<string> {
  const data = encodeID(refTypeID, executor.idSizes.referenceTypeIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ReferenceType,
    ReferenceTypeCommand.ClassLoader,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get class loader failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.objectIDSize);
}
