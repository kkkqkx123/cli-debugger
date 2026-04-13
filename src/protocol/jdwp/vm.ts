/**
 * VirtualMachine Command Set Implementation
 */

import {
  CommandSet,
  VMCommand,
  type IDSizes,
  type ClassInfo,
  type VMCapabilitiesInfo,
  type ClassPathsInfo,
  type ClassDef,
} from "./protocol.js";
import {
  createCommandPacket,
  createCommandPacketWithData,
  encodeString,
  encodeID,
  encodeUint32,
} from "./codec.js";
import { PacketReader } from "./reader.js";
import type { VersionInfo, Capabilities } from "../../types/metadata.js";
import type { ThreadInfo } from "../../types/debug.js";
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
 * Get JVM version information
 */
export async function getVersion(
  executor: JDWPCommandExecutor,
): Promise<VersionInfo> {
  const packet = createCommandPacket(CommandSet.VirtualMachine, VMCommand.Version);
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get version failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const description = reader.readString();
  const jdwpMajor = reader.readInt();
  const jdwpMinor = reader.readInt();
  const vmVersion = reader.readString();
  const vmName = reader.readString();

  return {
    protocolVersion: `${jdwpMajor}.${jdwpMinor}`,
    runtimeVersion: vmVersion,
    runtimeName: vmName,
    description,
  };
}

/**
 * Get ID sizes (internal, called during connection)
 */
export async function getIDSizes(
  executor: JDWPCommandExecutor,
): Promise<IDSizes> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.IDSizes,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get ID sizes failed: ${reply.message}`,
    );
  }

  if (reply.data.length < 20) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.DecodeError,
      "IDSizes response too short",
    );
  }

  const reader = new PacketReader(reply.data);
  return {
    fieldIDSize: reader.readInt(),
    methodIDSize: reader.readInt(),
    objectIDSize: reader.readInt(),
    referenceTypeIDSize: reader.readInt(),
    frameIDSize: reader.readInt(),
  };
}

/**
 * Get all loaded classes
 */
export async function getAllClasses(
  executor: JDWPCommandExecutor,
): Promise<ClassInfo[]> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.AllClasses,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get all classes failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const classCount = reader.readInt();

  const classes: ClassInfo[] = [];
  for (let i = 0; i < classCount; i++) {
    const tag = reader.readByte();
    const refID = reader.readID(executor.idSizes.referenceTypeIDSize);
    const status = reader.readInt();

    classes.push({ tag, refID, status });
  }

  return classes;
}

/**
 * Get all thread IDs
 */
export async function getAllThreads(
  executor: JDWPCommandExecutor,
): Promise<string[]> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.AllThreads,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get all threads failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const threadCount = reader.readInt();

  const threads: string[] = [];
  for (let i = 0; i < threadCount; i++) {
    const threadID = reader.readID(executor.idSizes.objectIDSize);
    threads.push(threadID);
  }

  return threads;
}

/**
 * Find class by name (signature)
 */
export async function classByName(
  executor: JDWPCommandExecutor,
  className: string,
): Promise<ClassInfo | null> {
  const data = encodeString(className);
  const packet = createCommandPacketWithData(
    CommandSet.VirtualMachine,
    VMCommand.ClassesBySignature,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Find class failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const count = reader.readInt();
  if (count === 0) {
    return null;
  }

  const tag = reader.readByte();
  const refID = reader.readID(executor.idSizes.referenceTypeIDSize);
  const status = reader.readInt();

  return { tag, refID, status };
}

/**
 * Suspend the entire VM
 */
export async function suspendVM(
  executor: JDWPCommandExecutor,
): Promise<void> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.Suspend,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Suspend VM failed: ${reply.message}`,
    );
  }
}

/**
 * Resume the entire VM
 */
export async function resumeVM(executor: JDWPCommandExecutor): Promise<void> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.Resume,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Resume VM failed: ${reply.message}`,
    );
  }
}

/**
 * Dispose (close debugging session)
 */
export async function dispose(
  executor: JDWPCommandExecutor,
): Promise<void> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.Dispose,
  );
  await executor.sendPacket(packet);
}

/**
 * Exit VM with exit code
 */
export async function exit(
  executor: JDWPCommandExecutor,
  exitCode: number,
): Promise<void> {
  const data = encodeUint32(exitCode);
  const packet = createCommandPacketWithData(
    CommandSet.VirtualMachine,
    VMCommand.Exit,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Exit VM failed: ${reply.message}`,
    );
  }
}

/**
 * Create string in VM
 */
export async function createString(
  executor: JDWPCommandExecutor,
  str: string,
): Promise<string> {
  const data = encodeString(str);
  const packet = createCommandPacketWithData(
    CommandSet.VirtualMachine,
    VMCommand.CreateString,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Create string failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  const tag = reader.readByte();
  const stringID = reader.readID(executor.idSizes.objectIDSize);

  return `${String.fromCharCode(tag)}:${stringID}`;
}

/**
 * Get VM capabilities
 */
export async function getCapabilities(
  executor: JDWPCommandExecutor,
): Promise<Capabilities> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.Capabilities,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get capabilities failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);

  return {
    supportsVersion: true,
    supportsThreads: true,
    supportsStack: true,
    supportsLocals: true,
    supportsBreakpoints: true,
    supportsSuspend: true,
    supportsResume: true,
    supportsStep: true,
    supportsCont: true,
    supportsNext: true,
    supportsFinish: true,
    supportsEvents: true,
    supportsWatchMode: true,
    supportsStreaming: true,
  };
}

/**
 * Get detailed VM capabilities
 */
export async function getCapabilitiesInfo(
  executor: JDWPCommandExecutor,
): Promise<VMCapabilitiesInfo> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.Capabilities,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get VM capabilities failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);

  return {
    canWatchFieldModification: reader.readByte() !== 0,
    canWatchFieldAccess: reader.readByte() !== 0,
    canGetBytecodes: reader.readByte() !== 0,
    canGetSyntheticAttribute: reader.readByte() !== 0,
    canGetOwnedMonitorInfo: reader.readByte() !== 0,
    canGetCurrentContendedMonitor: reader.readByte() !== 0,
    canGetMonitorInfo: reader.readByte() !== 0,
    canRedefineClasses: reader.readByte() !== 0,
    canAddMethod: reader.readByte() !== 0,
    canUnrestrictedlyRedefineClasses: reader.readByte() !== 0,
    canPopFrames: reader.readByte() !== 0,
    canUseInstanceFilters: reader.readByte() !== 0,
    canGetSourceDebugExtension: reader.readByte() !== 0,
    canRequestVMDeathEvent: reader.readByte() !== 0,
    canSetDefaultStratum: reader.readByte() !== 0,
    canGetInstanceInfo: reader.readByte() !== 0,
    canRequestMonitorEvents: reader.readByte() !== 0,
    canGetMonitorFrameInfo: reader.readByte() !== 0,
    canGetConstantPool: reader.readByte() !== 0,
    canSetNativeMethodPrefix: reader.readByte() !== 0,
    canRedefineClassesWhenMismatched: reader.readByte() !== 0,
  };
}

/**
 * Get class paths
 */
export async function getClassPaths(
  executor: JDWPCommandExecutor,
): Promise<ClassPathsInfo> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.ClassPaths,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Get class paths failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);

  const classpathCount = reader.readInt();
  const classpath: string[] = [];
  for (let i = 0; i < classpathCount; i++) {
    classpath.push(reader.readString());
  }

  const bootClasspathCount = reader.readInt();
  const bootClasspath: string[] = [];
  for (let i = 0; i < bootClasspathCount; i++) {
    bootClasspath.push(reader.readString());
  }

  return { classpath, bootClasspath };
}

/**
 * Hold events
 */
export async function holdEvents(
  executor: JDWPCommandExecutor,
): Promise<void> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.HoldEvents,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Hold events failed: ${reply.message}`,
    );
  }
}

/**
 * Release events
 */
export async function releaseEvents(
  executor: JDWPCommandExecutor,
): Promise<void> {
  const packet = createCommandPacket(
    CommandSet.VirtualMachine,
    VMCommand.ReleaseEvents,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Release events failed: ${reply.message}`,
    );
  }
}

/**
 * Redefine classes
 */
export async function redefineClasses(
  executor: JDWPCommandExecutor,
  classes: ClassDef[],
): Promise<void> {
  const parts: Buffer[] = [];

  // Class count
  parts.push(encodeUint32(classes.length));

  for (const cls of classes) {
    // Reference type ID
    parts.push(encodeID(cls.refTypeID, executor.idSizes.referenceTypeIDSize));
    // Class bytes length and data
    parts.push(encodeUint32(cls.classBytes.length));
    parts.push(cls.classBytes);
  }

  const data = Buffer.concat(parts);
  const packet = createCommandPacketWithData(
    CommandSet.VirtualMachine,
    VMCommand.RedefineClasses,
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `Redefine classes failed: ${reply.message}`,
    );
  }
}
