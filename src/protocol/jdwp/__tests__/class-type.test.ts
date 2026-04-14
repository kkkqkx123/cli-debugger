import { describe, it, expect, vi } from 'vitest';
import {
  getSuperclass,
  setStaticFieldValues,
  invokeStaticMethod,
  newInstance,
} from '../class-type.js';
import { ErrorType, ErrorCodes } from '../../errors.js';

describe('class-type', () => {
  const mockExecutor = {
    sendPacket: vi.fn().mockResolvedValue(undefined),
    readReply: vi.fn().mockResolvedValue({
      errorCode: 0,
      message: '',
      data: Buffer.alloc(0),
    }),
    idSizes: {
      fieldIDSize: 8,
      methodIDSize: 8,
      objectIDSize: 8,
      referenceTypeIDSize: 8,
      frameIDSize: 8,
    },
  };

  describe('getSuperclass', () => {
    it('should get superclass success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const superclass = await getSuperclass(mockExecutor, '1');
      expect(superclass).toBe('1');
    });
  });

  describe('setStaticFieldValues', () => {
    it('should set static field values success', async () => {
      await setStaticFieldValues(
        mockExecutor,
        '1',
        new Map([
          ['1', 123],
          ['2', 456],
        ]),
      );
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('invokeStaticMethod', () => {
    it('should invoke static method success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 123]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
        ]),
      });
      const result = await invokeStaticMethod(mockExecutor, '1', '1', '1', [], 0);
      expect(result).toEqual({
        returnValue: 123,
        exception: '0',
      });
    });
  });

  describe('newInstance', () => {
    it('should create new instance success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
        ]),
      });
      const result = await newInstance(mockExecutor, '1', '1', '1', [], 0);
      expect(result).toEqual({
        newInstance: '1',
        exception: '0',
      });
    });
  });
});
