/**
 * ClassObjectReference Command Set Implementation
 */

import {
  CommandSet,
  ClassObjectReferenceCommand,
  type IDSizes,
} from "./protocol.js";
import {
  createCommandPacketWithData,
  encodeID,
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
 * Get reflected type for a class object
 */
export async function getReflectedType(
  executor: JDWPCommandExecutor,
  classObjectID: string,
): Promise<string> {
  const data = encodeID(classObjectID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ClassObjectReference,
    ClassObjectReferenceCommand.ReflectedType,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get reflected type failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.referenceTypeIDSize);
}
