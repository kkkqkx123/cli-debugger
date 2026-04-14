/**
 * JDWP Packet Encoder/Decoder
 */

import {
  CMD_FLAG,
  REPLY_FLAG,
  type ReplyPacket,
  getErrorMessage,
} from "./protocol/index.js";

// Packet ID counter (global)
let packetIdCounter = 1;

/**
 * Get next packet ID
 */
export function getNextPacketId(): number {
  const id = packetIdCounter;
  packetIdCounter++;
  if (packetIdCounter === 0) {
    packetIdCounter = 1;
  }
  return id;
}

/**
 * Reset packet ID counter (for testing)
 */
export function resetPacketIdCounter(): void {
  packetIdCounter = 1;
}

/**
 * Encode command packet
 */
export function encodeCommandPacket(
  id: number,
  commandSet: number,
  command: number,
  data: Buffer = Buffer.alloc(0),
): Buffer {
  // Total length = 4 (length) + 4 (id) + 1 (flag) + 1 (command set) + 1 (command) + data length
  const length = 11 + data.length;
  const packet = Buffer.alloc(length);

  // Write length (big endian)
  packet.writeUInt32BE(length, 0);

  // Write ID (big endian)
  packet.writeUInt32BE(id, 4);

  // Write flag
  packet[8] = CMD_FLAG;

  // Write command set and command
  packet[9] = commandSet;
  packet[10] = command;

  // Write data
  if (data.length > 0) {
    data.copy(packet, 11);
  }

  return packet;
}

/**
 * Create command packet (using global counter)
 */
export function createCommandPacket(
  commandSet: number,
  command: number,
): Buffer {
  const id = getNextPacketId();
  return encodeCommandPacket(id, commandSet, command);
}

/**
 * Create command packet with data
 */
export function createCommandPacketWithData(
  commandSet: number,
  command: number,
  data: Buffer,
): Buffer {
  const id = getNextPacketId();
  return encodeCommandPacket(id, commandSet, command, data);
}

/**
 * Decode reply packet
 */
export function decodeReplyPacket(data: Buffer): ReplyPacket {
  if (data.length < 7) {
    throw new Error("Packet too short");
  }

  // Read ID
  const id = data.readUInt32BE(0);

  // Read flag
  const flags = data[4];

  // Check flag
  if (flags !== REPLY_FLAG) {
    throw new Error("Invalid reply packet flag");
  }

  // Read error code
  const errorCode = data.readUInt16BE(5);

  // Get error message
  const message = errorCode !== 0 ? getErrorMessage(errorCode) : "";

  // Read data section
  const packetData = data.length > 7 ? data.subarray(7) : Buffer.alloc(0);

  return {
    id,
    flags,
    errorCode,
    message,
    data: packetData,
  };
}

/**
 * Encode ID (convert string ID to bytes)
 */
export function encodeID(id: string, size: number): Buffer {
  const idVal = BigInt(id);
  const buf = Buffer.alloc(size);

  for (let i = 0; i < size; i++) {
    const shift = BigInt((size - 1 - i) * 8);
    buf[i] = Number((idVal >> shift) & BigInt(0xff));
  }

  return buf;
}

/**
 * Encode string (length-prefixed)
 */
export function encodeString(str: string): Buffer {
  const strBuf = Buffer.from(str, "utf8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

/**
 * Decode string (length-prefixed)
 */
export function decodeString(data: Buffer): { value: string; remaining: Buffer } {
  if (data.length < 4) {
    throw new Error("String data too short");
  }

  const length = data.readUInt32BE(0);
  if (data.length < 4 + length) {
    throw new Error("Insufficient data for string");
  }

  const value = data.subarray(4, 4 + length).toString("utf8");
  const remaining = data.subarray(4 + length);

  return { value, remaining };
}

/**
 * Encode uint32
 */
export function encodeUint32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
}

/**
 * Encode int32
 */
export function encodeInt32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(value, 0);
  return buf;
}

/**
 * Encode uint64 (as bigint)
 */
export function encodeUint64(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(value), 0);
  return buf;
}

/**
 * Encode int64 (as bigint)
 */
export function encodeInt64(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(value), 0);
  return buf;
}

/**
 * Encode byte
 */
export function encodeByte(value: number): Buffer {
  return Buffer.from([value & 0xff]);
}

/**
 * Encode boolean
 */
export function encodeBoolean(value: boolean): Buffer {
  return Buffer.from([value ? 1 : 0]);
}

/**
 * Check if tag is primitive type
 */
export function isPrimitiveTag(tag: number): boolean {
  return (
    tag === 0x42 || // B - byte
    tag === 0x43 || // C - char
    tag === 0x44 || // D - double
    tag === 0x46 || // F - float
    tag === 0x49 || // I - int
    tag === 0x4a || // J - long
    tag === 0x53 || // S - short
    tag === 0x5a // Z - boolean
  );
}

/**
 * Encode value with tag
 */
export function encodeValue(value: unknown, idSize: number): Buffer {
  if (value === null || value === undefined) {
    // Null object reference
    return Buffer.concat([Buffer.from([0x4c]), Buffer.alloc(idSize)]);
  }

  if (typeof value === "boolean") {
    return Buffer.concat([Buffer.from([0x5a]), encodeBoolean(value)]);
  }

  if (typeof value === "number") {
    // Default to int
    if (Number.isInteger(value)) {
      return Buffer.concat([Buffer.from([0x49]), encodeInt32(value)]);
    }
    // Float
    const buf = Buffer.alloc(5);
    buf[0] = 0x46;
    buf.writeFloatBE(value, 1);
    return buf;
  }

  if (typeof value === "bigint") {
    return Buffer.concat([Buffer.from([0x4a]), encodeInt64(value)]);
  }

  if (typeof value === "string") {
    // Object reference (string ID)
    return Buffer.concat([
      Buffer.from([0x4c]),
      encodeID(value, idSize),
    ]);
  }

  // Unknown type, treat as null object
  return Buffer.concat([Buffer.from([0x4c]), Buffer.alloc(idSize)]);
}
