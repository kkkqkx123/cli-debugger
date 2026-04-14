import { describe, it, expect } from 'vitest';
import { PacketReader, createReader } from '../reader.js';

describe('reader', () => {
  const data = Buffer.from([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10,
  ]);

  describe('PacketReader', () => {
    it('should create reader', () => {
      const reader = new PacketReader(data);
      expect(reader.position).toBe(0);
      expect(reader.remaining).toBe(16);
      expect(reader.hasMore()).toBe(true);
    });

    it('should read position', () => {
      const reader = new PacketReader(data);
      expect(reader.position).toBe(0);
    });

    it('should read remaining', () => {
      const reader = new PacketReader(data);
      expect(reader.remaining).toBe(16);
    });

    it('should check has more', () => {
      const reader = new PacketReader(data);
      expect(reader.hasMore()).toBe(true);
      reader.skip(16);
      expect(reader.hasMore()).toBe(false);
    });

    it('should read byte', () => {
      const reader = new PacketReader(data);
      expect(reader.readByte()).toBe(0x01);
      expect(reader.readByte()).toBe(0x02);
    });

    it('should read byte at end', () => {
      const reader = new PacketReader(data);
      reader.skip(16);
      expect(reader.readByte()).toBe(0);
    });

    it('should read int', () => {
      const reader = new PacketReader(data);
      expect(reader.readInt()).toBe(0x01020304);
    });

    it('should read int at end', () => {
      const reader = new PacketReader(data);
      reader.skip(13);
      expect(reader.readInt()).toBe(0);
    });

    it('should read uint32', () => {
      const reader = new PacketReader(data);
      expect(reader.readUint32()).toBe(0x01020304);
    });

    it('should read uint32 at end', () => {
      const reader = new PacketReader(data);
      reader.skip(13);
      expect(reader.readUint32()).toBe(0);
    });

    it('should read int64', () => {
      const reader = new PacketReader(data);
      expect(reader.readInt64()).toBe(0x0102030405060708n);
    });

    it('should read int64 at end', () => {
      const reader = new PacketReader(data);
      reader.skip(9);
      expect(reader.readInt64()).toBe(0n);
    });

    it('should read uint64', () => {
      const reader = new PacketReader(data);
      expect(reader.readUint64()).toBe(0x0102030405060708n);
    });

    it('should read uint64 at end', () => {
      const reader = new PacketReader(data);
      reader.skip(9);
      expect(reader.readUint64()).toBe(0n);
    });

    it('should read id 4bytes', () => {
      const reader = new PacketReader(data);
      expect(reader.readID(4)).toBe('16909060');
    });

    it('should read id 8bytes', () => {
      const reader = new PacketReader(data);
      expect(reader.readID(8)).toBe('72623859790382856');
    });

    it('should read id custom', () => {
      const reader = new PacketReader(data);
      expect(reader.readID(5)).toBe('4328719365');
    });

    it('should read id at end', () => {
      const reader = new PacketReader(data);
      reader.skip(16);
      expect(reader.readID(4)).toBe('0');
    });

    it('should read string success', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('hello', 'utf8'),
          Buffer.from([1, 2, 3]),
        ]),
      );
      expect(reader.readString()).toBe('hello');
    });

    it('should read string invalid length', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0xff, 0xff, 0xff, 0xff]),
          Buffer.from('hello', 'utf8'),
        ]),
      );
      expect(reader.readString()).toBe('');
    });

    it('should read string insufficient data', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('hel', 'utf8'),
        ]),
      );
      expect(reader.readString()).toBe('');
    });

    it('should read bytes success', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from([1, 2, 3, 4, 5]),
          Buffer.from([6, 7, 8]),
        ]),
      );
      expect(reader.readBytes()).toEqual(Buffer.from([1, 2, 3, 4, 5]));
    });

    it('should read bytes invalid length', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0xff, 0xff, 0xff, 0xff]),
          Buffer.from([1, 2, 3, 4, 5]),
        ]),
      );
      expect(reader.readBytes()).toEqual(Buffer.alloc(0));
    });

    it('should read bytes insufficient data', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from([1, 2, 3]),
        ]),
      );
      expect(reader.readBytes()).toEqual(Buffer.alloc(0));
    });

    it('should read value byte', () => {
      const reader = new PacketReader(Buffer.from([0x12]));
      expect(reader.readValue(0x42)).toBe(0x12);
    });

    it('should read value char', () => {
      const reader = new PacketReader(Buffer.from([0x01, 0x02, 0x03, 0x04]));
      expect(reader.readValue(0x43)).toBe(16909060);
    });

    it('should read value double', () => {
      const reader = new PacketReader(Buffer.from([0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18]));
      const value = reader.readValue(0x44);
      expect(typeof value).toBe('number');
    });

    it('should read value float', () => {
      const reader = new PacketReader(Buffer.from([0x40, 0x49, 0x0f, 0xdb]));
      const value = reader.readValue(0x46);
      expect(typeof value).toBe('number');
    });

    it('should read value int', () => {
      const reader = new PacketReader(Buffer.from([0x01, 0x02, 0x03, 0x04]));
      expect(reader.readValue(0x49)).toBe(0x01020304);
    });

    it('should read value long', () => {
      const reader = new PacketReader(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      expect(reader.readValue(0x4a)).toBe(0x0102030405060708n);
    });

    it('should read value object', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
        ]),
      );
      expect(reader.readValue(0x4c, 8)).toBe('L:1');
    });

    it('should read value short', () => {
      const reader = new PacketReader(Buffer.from([0x01, 0x02]));
      expect(reader.readValue(0x53)).toBe(0x0102);
    });

    it('should read value boolean', () => {
      const reader = new PacketReader(Buffer.from([0x01]));
      expect(reader.readValue(0x5a, 8)).toBe(true);
      expect(reader.readValue(0x5a, 8)).toBe(false);
    });

    it('should read value void', () => {
      const reader = new PacketReader(Buffer.alloc(0));
      expect(reader.readValue(0x56, 8)).toBeNull();
    });

    it('should read value array', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0x5b]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
        ]),
      );
      expect(reader.readValue(0x5b, 8)).toBe('[:1');
    });

    it('should read value unknown', () => {
      const reader = new PacketReader(Buffer.alloc(0));
      expect(reader.readValue(0x01, 8)).toBe('unknown(\u0001)');
    });

    it('should read tagged value', () => {
      const reader = new PacketReader(Buffer.from([0x49, 0x01, 0x02, 0x03, 0x04]));
      expect(reader.readTaggedValue(8)).toEqual({
        tag: 0x49,
        value: 0x01020304,
      });
    });

    it('should read location', () => {
      const reader = new PacketReader(
        Buffer.concat([
          Buffer.from([0x01]),
          Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
          Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
          Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
        ]),
      );
      expect(reader.readLocation({
        referenceTypeIDSize: 8,
        methodIDSize: 8,
      })).toEqual({
        typeTag: 0x01,
        classID: '72623859790382856',
        methodID: '72623859790382856',
        codeIndex: 72623859790382856n,
      });
    });

    it('should skip bytes', () => {
      const reader = new PacketReader(data);
      reader.skip(5);
      expect(reader.position).toBe(5);
    });

    it('should read remaining', () => {
      const reader = new PacketReader(data);
      reader.skip(5);
      expect(reader.readRemaining()).toEqual(Buffer.from([0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]));
    });
  });

  describe('createReader', () => {
    it('should create reader', () => {
      const reader = createReader(data);
      expect(reader).toBeInstanceOf(PacketReader);
    });
  });
});
