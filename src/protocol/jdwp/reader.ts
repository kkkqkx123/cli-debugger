/**
 * JDWP Packet Reader
 * Utility for reading data from JDWP reply packets
 */

/**
 * Packet reader for parsing JDWP reply data
 */
export class PacketReader {
  private data: Buffer;
  private pos: number;

  constructor(data: Buffer) {
    this.data = data;
    this.pos = 0;
  }

  /**
   * Get current position
   */
  get position(): number {
    return this.pos;
  }

  /**
   * Get remaining bytes
   */
  get remaining(): number {
    return this.data.length - this.pos;
  }

  /**
   * Check if more data is available
   */
  hasMore(): boolean {
    return this.pos < this.data.length;
  }

  /**
   * Read a single byte
   */
  readByte(): number {
    if (this.pos >= this.data.length) {
      return 0;
    }
    const b = this.data[this.pos] ?? 0;
    this.pos++;
    return b;
  }

  /**
   * Read int32 (4 bytes, big endian)
   */
  readInt(): number {
    if (this.pos + 4 > this.data.length) {
      return 0;
    }
    const val = this.data.readInt32BE(this.pos);
    this.pos += 4;
    return val;
  }

  /**
   * Read uint32 (4 bytes, big endian)
   */
  readUint32(): number {
    if (this.pos + 4 > this.data.length) {
      return 0;
    }
    const val = this.data.readUInt32BE(this.pos);
    this.pos += 4;
    return val;
  }

  /**
   * Read int64 (8 bytes, big endian) as bigint
   */
  readInt64(): bigint {
    if (this.pos + 8 > this.data.length) {
      return BigInt(0);
    }
    const val = this.data.readBigInt64BE(this.pos);
    this.pos += 8;
    return val;
  }

  /**
   * Read uint64 (8 bytes, big endian) as bigint
   */
  readUint64(): bigint {
    if (this.pos + 8 > this.data.length) {
      return BigInt(0);
    }
    const val = this.data.readBigUInt64BE(this.pos);
    this.pos += 8;
    return val;
  }

  /**
   * Read ID (variable size)
   */
  readID(size: number): string {
    if (this.pos + size > this.data.length) {
      return "0";
    }

    let id: bigint;
    if (size === 4) {
      id = BigInt(this.data.readUInt32BE(this.pos));
    } else if (size === 8) {
      id = this.data.readBigUInt64BE(this.pos);
    } else {
      // Generic handling for other sizes
      id = BigInt(0);
      for (let i = 0; i < size; i++) {
        const byte = this.data[this.pos + i] ?? 0;
        id = (id << BigInt(8)) | BigInt(byte);
      }
    }

    this.pos += size;
    return id.toString();
  }

  /**
   * Read string (length-prefixed)
   */
  readString(): string {
    const length = this.readInt();
    if (length < 0 || this.pos + length > this.data.length) {
      return "";
    }
    const str = this.data.subarray(this.pos, this.pos + length).toString("utf8");
    this.pos += length;
    return str;
  }

  /**
   * Read bytes (length-prefixed)
   */
  readBytes(): Buffer {
    const length = this.readInt();
    if (length < 0 || this.pos + length > this.data.length) {
      return Buffer.alloc(0);
    }
    const data = this.data.subarray(this.pos, this.pos + length);
    this.pos += length;
    return data;
  }

  /**
   * Read value based on tag
   */
  readValue(tag: number, idSize: number = 8): unknown {
    switch (tag) {
      case 0x42: // B - byte
        return this.readByte();

      case 0x43: // C - char
        return this.readUint32();

      case 0x44: {
        // D - double
        if (this.pos + 8 > this.data.length) {
          return 0;
        }
        const doubleVal = this.data.readDoubleBE(this.pos);
        this.pos += 8;
        return doubleVal;
      }

      case 0x46: {
        // F - float
        if (this.pos + 4 > this.data.length) {
          return 0;
        }
        const floatVal = this.data.readFloatBE(this.pos);
        this.pos += 4;
        return floatVal;
      }

      case 0x49: // I - int
        return this.readInt();

      case 0x4a: // J - long
        return this.readInt64();

      case 0x4c: {
        // L - object
        const objTag = this.readByte();
        const objId = this.readID(idSize);
        return `${String.fromCharCode(objTag)}:${objId}`;
      }

      case 0x53: {
        // S - short
        if (this.pos + 2 > this.data.length) {
          return 0;
        }
        const shortVal = this.data.readInt16BE(this.pos);
        this.pos += 2;
        return shortVal;
      }

      case 0x5a: // Z - boolean
        return this.readByte() !== 0;

      case 0x56: // V - void
        return null;

      case 0x5b: {
        // [ - array
        const arrayTag = this.readByte();
        const arrayId = this.readID(idSize);
        return `${String.fromCharCode(arrayTag)}:${arrayId}`;
      }

      default:
        return `unknown(${String.fromCharCode(tag)})`;
    }
  }

  /**
   * Read tagged value (tag + value)
   */
  readTaggedValue(idSize: number = 8): { tag: number; value: unknown } {
    const tag = this.readByte();
    const value = this.readValue(tag, idSize);
    return { tag, value };
  }

  /**
   * Read location (for code location)
   */
  readLocation(idSizes: {
    referenceTypeIDSize: number;
    methodIDSize: number;
  }): { typeTag: number; classID: string; methodID: string; codeIndex: bigint } {
    const typeTag = this.readByte();
    const classID = this.readID(idSizes.referenceTypeIDSize);
    const methodID = this.readID(idSizes.methodIDSize);
    const codeIndex = this.readUint64();
    return { typeTag, classID, methodID, codeIndex };
  }

  /**
   * Skip bytes
   */
  skip(count: number): void {
    this.pos += count;
    if (this.pos > this.data.length) {
      this.pos = this.data.length;
    }
  }

  /**
   * Read remaining data as buffer
   */
  readRemaining(): Buffer {
    const data = this.data.subarray(this.pos);
    this.pos = this.data.length;
    return data;
  }
}

/**
 * Create a packet reader
 */
export function createReader(data: Buffer): PacketReader {
  return new PacketReader(data);
}
