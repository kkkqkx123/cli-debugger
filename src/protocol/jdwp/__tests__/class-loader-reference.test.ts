import { describe, it, expect, vi } from 'vitest';
import { getVisibleClasses } from '../class-loader-reference.js';

describe('class-loader-reference', () => {
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

  describe('getVisibleClasses', () => {
    it('should get visible classes success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
        ]),
      });
      const result = await getVisibleClasses(mockExecutor, '1');
      expect(result).toEqual({
        classes: [
          {
            refTypeID: '1',
            typeTag: 0x4c,
            status: 1,
          },
        ],
      });
    });
  });
});
