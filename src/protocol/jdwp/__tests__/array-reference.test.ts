import { describe, it, expect, vi } from 'vitest';
import {
  getArrayLength,
  getArrayValues,
  setArrayValues,
} from '../array-reference.js';

describe('array-reference', () => {
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

  describe('getArrayLength', () => {
    it('should get array length success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 5]),
      });
      const length = await getArrayLength(mockExecutor, '1');
      expect(length).toBe(5);
    });
  });

  describe('getArrayValues', () => {
    it('should get array values success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 2]),
        ]),
      });
      const values = await getArrayValues(mockExecutor, '1', 0, 2);
      expect(values).toEqual([1, 2]);
    });
  });

  describe('setArrayValues', () => {
    it('should set array values success', async () => {
      await setArrayValues(mockExecutor, '1', 0, [1, 2, 3]);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });
});
