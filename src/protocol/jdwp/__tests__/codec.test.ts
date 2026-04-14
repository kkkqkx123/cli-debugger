import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNextPacketId,
  resetPacketIdCounter,
  encodeCommandPacket,
  createCommandPacket,
  createCommandPacketWithData,
  decodeReplyPacket,
  encodeID,
  encodeString,
  decodeString,
  encodeUint32,
  encodeInt32,
  encodeUint64,
  encodeInt64,
  encodeByte,
  encodeBoolean,
  isPrimitiveTag,
  encodeValue,
} from '../codec.js';

describe('codec', () => {
  beforeEach(() => {
    resetPacketIdCounter();
  });

  describe('getNextPacketId', () => {
    it('should get next packet id', () => {
      expect(getNextPacketId()).toBe(1);
      expect(getNextPacketId()).toBe(2);
      expect(getNextPacketId()).toBe(3);
    });
  });

  describe('resetPacketIdCounter', () => {
    it('should reset packet id counter', () => {
      getNextPacketId();
      getNextPacketId();
      resetPacketIdCounter();
      expect(getNextPacketId()).toBe(1);
    });
  });

  describe('encodeCommandPacket', () => {
    it('should encode command packet', () => {
      const packet = encodeCommandPacket(1, 0x01, 0x02);
      expect(packet.length).toBe(11);
      expect(packet.readUInt32BE(0)).toBe(11);
      expect(packet.readUInt32BE(4)).toBe(1);
      expect(packet[8]).toBe(0);
      expect(packet[9]).toBe(0x01);
      expect(packet[10]).toBe(0x02);
    });

    it('should encode command packet with data', () => {
      const data = Buffer.from([0x01, 0x02, 0x03]);
      const packet = encodeCommandPacket(1, 0x01, 0x02, data);
      expect(packet.length).toBe(14);
      expect(packet.readUInt32BE(0)).toBe(14);
      expect(packet.subarray(11)).toEqual(data);
    });
  });

  describe('createCommandPacket', () => {
    it('should create command packet without data', () => {
      const packet = createCommandPacket(0x01, 0x02);
      expect(packet.length).toBe(11);
      expect(packet.readUInt32BE(4)).toBe(1);
      expect(packet[8]).toBe(0);
      expect(packet[9]).toBe(0x01);
      expect(packet[10]).toBe(0x02);
    });
  });

  describe('createCommandPacketWithData', () => {
    it('should create command packet with data', () => {
      const data = Buffer.from([0x01, 0x02, 0x03]);
      const packet = createCommandPacketWithData(0x01, 0x02, data);
      expect(packet.length).toBe(14);
      expect(packet.readUInt32BE(4)).toBe(1);
      expect(packet.subarray(11)).toEqual(data);
    });
  });

  describe('decodeReplyPacket', () => {
    it('should decode reply packet success', () => {
      const data = Buffer.from([0, 0, 0, 1, 0x80, 0, 0, 0, 0, 0, 0]);
      const packet = decodeReplyPacket(data);
      expect(packet).toEqual({
        id: 1,
        flags: 0x80,
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0]),
      });
    });

    it('should decode reply packet too short', () => {
      const data = Buffer.from([0, 0, 0, 1, 0x80]);
      expect(() => decodeReplyPacket(data)).toThrow('Packet too short');
    });

    it('should decode reply packet invalid flag', () => {
      const data = Buffer.from([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
      expect(() => decodeReplyPacket(data)).toThrow('Invalid reply packet flag');
    });
  });

  describe('encodeID', () => {
    it('should encode id', () => {
      const id = encodeID('123', 8);
      expect(id.length).toBe(8);
      expect(id).toEqual(Buffer.from([0, 0, 0, 0, 0, 0, 0, 123]));
    });
  });

  describe('encodeString', () => {
    it('should encode string', () => {
      const str = encodeString('hello');
      expect(str).toEqual(
        Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('hello', 'utf8'),
        ]),
      );
    });
  });

  describe('decodeString', () => {
    it('should decode string success', () => {
      const data = Buffer.concat([
        Buffer.from([0, 0, 0, 5]),
        Buffer.from('hello', 'utf8'),
        Buffer.from([1, 2, 3]),
      ]);
      const result = decodeString(data);
      expect(result.value).toBe('hello');
      expect(result.remaining).toEqual(Buffer.from([1, 2, 3]));
    });

    it('should decode string too short', () => {
      const data = Buffer.from([0, 0, 0]);
      expect(() => decodeString(data)).toThrow('String data too short');
    });

    it('should decode string insufficient data', () => {
      const data = Buffer.from([0, 0, 0, 5, 1, 2, 3]);
      expect(() => decodeString(data)).toThrow(
        'Insufficient data for string',
      );
    });
  });

  describe('encodeUint32', () => {
    it('should encode uint32', () => {
      const buf = encodeUint32(0x12345678);
      expect(buf).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78]));
    });
  });

  describe('encodeInt32', () => {
    it('should encode int32', () => {
      const buf = encodeInt32(0x12345678);
      expect(buf).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78]));
    });
  });

  describe('encodeUint64', () => {
    it('should encode uint64', () => {
      const buf = encodeUint64(0x1234567890n);
      expect(buf).toEqual(
        Buffer.from([0, 0, 0, 0x12, 0x34, 0x56, 0x78, 0x90]),
      );
    });
  });

  describe('encodeInt64', () => {
    it('should encode int64', () => {
      const buf = encodeInt64(0x1234567890n);
      expect(buf).toEqual(
        Buffer.from([0, 0, 0, 0x12, 0x34, 0x56, 0x78, 0x90]),
      );
    });
  });

  describe('encodeByte', () => {
    it('should encode byte', () => {
      const buf = encodeByte(0x12);
      expect(buf).toEqual(Buffer.from([0x12]));
    });
  });

  describe('encodeBoolean', () => {
    it('should encode boolean', () => {
      expect(encodeBoolean(true)).toEqual(Buffer.from([1]));
      expect(encodeBoolean(false)).toEqual(Buffer.from([0]));
    });
  });

  describe('isPrimitiveTag', () => {
    it('should judge byte type', () => {
      expect(isPrimitiveTag(0x42)).toBe(true);
    });

    it('should judge char type', () => {
      expect(isPrimitiveTag(0x43)).toBe(true);
    });

    it('should judge double type', () => {
      expect(isPrimitiveTag(0x44)).toBe(true);
    });

    it('should judge float type', () => {
      expect(isPrimitiveTag(0x46)).toBe(true);
    });

    it('should judge int type', () => {
      expect(isPrimitiveTag(0x49)).toBe(true);
    });

    it('should judge long type', () => {
      expect(isPrimitiveTag(0x4a)).toBe(true);
    });

    it('should judge short type', () => {
      expect(isPrimitiveTag(0x53)).toBe(true);
    });

    it('should judge boolean type', () => {
      expect(isPrimitiveTag(0x5a)).toBe(true);
    });

    it('should judge object type', () => {
      expect(isPrimitiveTag(0x4c)).toBe(false);
    });
  });

  describe('encodeValue', () => {
    it('should encode value null', () => {
      const val = encodeValue(null, 8);
      expect(val).toEqual(Buffer.concat([Buffer.from([0x4c]), Buffer.alloc(8)]));
    });

    it('should encode value boolean', () => {
      const val = encodeValue(true, 8);
      expect(val).toEqual(Buffer.from([0x5a, 1]));
    });

    it('should encode value integer', () => {
      const val = encodeValue(123, 8);
      expect(val).toEqual(
        Buffer.concat([Buffer.from([0x49]), Buffer.from([0, 0, 0, 123])]),
      );
    });

    it('should encode value float', () => {
      const val = encodeValue(1.23, 8);
      expect(val.length).toBe(5);
      expect(val[0]).toBe(0x46);
    });

    it('should encode value bigint', () => {
      const val = encodeValue(123n, 8);
      expect(val).toEqual(
        Buffer.concat([
          Buffer.from([0x4a]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 123]),
        ]),
      );
    });

    it('should encode value string', () => {
      const val = encodeValue('123', 8);
      expect(val).toEqual(
        Buffer.concat([
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 123]),
        ]),
      );
    });

    it('should encode value unknown', () => {
      const val = encodeValue({}, 8);
      expect(val).toEqual(
        Buffer.concat([Buffer.from([0x4c]), Buffer.alloc(8)]),
      );
    });
  });
});
