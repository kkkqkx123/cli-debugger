import { describe, it, expect, vi } from 'vitest';
import { getReflectedType } from '../class-object-reference.js';

describe('class-object-reference', () => {
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

  describe('getReflectedType', () => {
    it('should get reflected type success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const refTypeID = await getReflectedType(mockExecutor, '1');
      expect(refTypeID).toBe('1');
    });
  });
});
