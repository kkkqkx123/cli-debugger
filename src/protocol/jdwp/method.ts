/**
 * Method Command Set Implementation
 */

import {
  CommandSet,
  MethodCommand,
  type IDSizes,
  type LineLocation,
  type VariableInfo,
} from "./protocol.js";
import { createCommandPacketWithData, encodeID } from "./codec.js";
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
 * Get method line table
 */
export async function getLineTable(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  methodID: string,
): Promise<LineLocation[]> {
  const data = Buffer.concat([
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeID(methodID, executor.idSizes.methodIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.Method,
    MethodCommand.LineTable,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get line table failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  reader.readInt64(); // start
  reader.readInt64(); // end
  const lines = reader.readInt();

  const lineLocations: LineLocation[] = [];
  for (let i = 0; i < lines; i++) {
    lineLocations.push({
      lineCodeIndex: reader.readInt64(),
      lineNumber: reader.readInt(),
    });
  }

  return lineLocations;
}

/**
 * Get method variable table
 */
export async function getVariableTable(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  methodID: string,
): Promise<VariableInfo[]> {
  const data = Buffer.concat([
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeID(methodID, executor.idSizes.methodIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.Method,
    MethodCommand.VariableTable,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get variable table failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  reader.readInt(); // argCount
  const slots = reader.readInt();

  const variableInfos: VariableInfo[] = [];
  for (let i = 0; i < slots; i++) {
    const codeIndex = reader.readInt64();
    const name = reader.readString();
    const signature = reader.readString();
    const slot = reader.readInt();
    reader.readInt(); // length

    variableInfos.push({
      slot,
      name,
      signature,
      codeIndex,
    });
  }

  return variableInfos;
}

/**
 * Get method bytecodes
 */
export async function getBytecodes(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  methodID: string,
): Promise<Buffer> {
  const data = Buffer.concat([
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeID(methodID, executor.idSizes.methodIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.Method,
    MethodCommand.Bytecodes,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get bytecodes failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readBytes();
}

/**
 * Check if method is obsolete
 */
export async function isObsolete(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  methodID: string,
): Promise<boolean> {
  const data = Buffer.concat([
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeID(methodID, executor.idSizes.methodIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.Method,
    MethodCommand.IsObsolete,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Check obsolete failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readByte() !== 0;
}

/**
 * Get method variable table with generic signature
 */
export async function getVariableTableWithGeneric(
  executor: JDWPCommandExecutor,
  refTypeID: string,
  methodID: string,
): Promise<VariableInfo[]> {
  const data = Buffer.concat([
    encodeID(refTypeID, executor.idSizes.referenceTypeIDSize),
    encodeID(methodID, executor.idSizes.methodIDSize),
  ]);

  const packet = createCommandPacketWithData(
    CommandSet.Method,
    MethodCommand.VariableTableWithGeneric,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get variable table with generic failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  reader.readInt(); // argCount
  const slots = reader.readInt();

  const variableInfos: VariableInfo[] = [];
  for (let i = 0; i < slots; i++) {
    const codeIndex = reader.readInt64();
    const name = reader.readString();
    const signature = reader.readString();
    reader.readString(); // genericSignature
    const slot = reader.readInt();
    reader.readInt(); // length

    variableInfos.push({
      slot,
      name,
      signature,
      codeIndex,
    });
  }

  return variableInfos;
}
