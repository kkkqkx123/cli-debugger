/**
 * StringReference Command Set Implementation
 */

import {
  CommandSet,
  StringReferenceCommand,
  type IDSizes,
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
 * Get string value
 */
export async function getStringValue(
  executor: JDWPCommandExecutor,
  stringID: string,
): Promise<string> {
  const data = encodeID(stringID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.StringReference,
    StringReferenceCommand.Value,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get string value failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readString();
}
