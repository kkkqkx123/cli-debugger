/**
 * ModuleReference Command Set Implementation
 */

import {
  CommandSet,
  ModuleReferenceCommand,
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
 * Get module name
 */
export async function getModuleName(
  executor: JDWPCommandExecutor,
  moduleID: string,
): Promise<string> {
  const data = encodeID(moduleID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ModuleReference,
    ModuleReferenceCommand.Name,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get module name failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readString();
}

/**
 * Get module class loader
 */
export async function getModuleClassLoader(
  executor: JDWPCommandExecutor,
  moduleID: string,
): Promise<string> {
  const data = encodeID(moduleID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ModuleReference,
    ModuleReferenceCommand.ClassLoader,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get module class loader failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.objectIDSize);
}
