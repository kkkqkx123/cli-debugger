/**
 * ClassLoaderReference Command Set Implementation
 */

import {
  CommandSet,
  ClassLoaderReferenceCommand,
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
 * Get visible classes for a class loader
 */
export async function getVisibleClasses(
  executor: JDWPCommandExecutor,
  classLoaderID: string,
): Promise<{
  classes: Array<{
    refTypeID: string;
    typeTag: number;
    status: number;
  }>;
}> {
  const data = encodeID(classLoaderID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ClassLoaderReference,
    ClassLoaderReferenceCommand.VisibleClasses,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get visible classes failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const classesCount = reader.readInt();

  const classes: Array<{
    refTypeID: string;
    typeTag: number;
    status: number;
  }> = [];

  for (let i = 0; i < classesCount; i++) {
    const typeTag = reader.readByte();
    const refTypeID = reader.readID(executor.idSizes.referenceTypeIDSize);
    const status = reader.readInt();

    classes.push({
      refTypeID,
      typeTag,
      status,
    });
  }

  return {
    classes,
  };
}
