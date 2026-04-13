/**
 * ThreadGroupReference Command Set Implementation
 */

import {
  CommandSet,
  ThreadGroupReferenceCommand,
  type IDSizes,
} from "./protocol/index.js";
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
 * Get thread group name
 */
export async function getThreadGroupName(
  executor: JDWPCommandExecutor,
  threadGroupID: string,
): Promise<string> {
  const data = encodeID(threadGroupID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadGroupReference,
    ThreadGroupReferenceCommand.Name,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get thread group name failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readString();
}

/**
 * Get parent thread group
 */
export async function getParentThreadGroup(
  executor: JDWPCommandExecutor,
  threadGroupID: string,
): Promise<string> {
  const data = encodeID(threadGroupID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadGroupReference,
    ThreadGroupReferenceCommand.Parent,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get parent thread group failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  return reader.readID(executor.idSizes.objectIDSize);
}

/**
 * Get thread group children (child groups and child threads)
 */
export async function getThreadGroupChildren(
  executor: JDWPCommandExecutor,
  threadGroupID: string,
): Promise<{
  childGroups: string[];
  childThreads: string[];
}> {
  const data = encodeID(threadGroupID, executor.idSizes.objectIDSize);
  const packet = createCommandPacketWithData(
    CommandSet.ThreadGroupReference,
    ThreadGroupReferenceCommand.Children,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get thread group children failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const childGroupCount = reader.readInt();

  const childGroups: string[] = [];
  for (let i = 0; i < childGroupCount; i++) {
    childGroups.push(reader.readID(executor.idSizes.objectIDSize));
  }

  const childThreadCount = reader.readInt();

  const childThreads: string[] = [];
  for (let i = 0; i < childThreadCount; i++) {
    childThreads.push(reader.readID(executor.idSizes.objectIDSize));
  }

  return {
    childGroups,
    childThreads,
  };
}
