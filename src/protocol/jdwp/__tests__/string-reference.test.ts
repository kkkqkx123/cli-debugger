import { describe, it, expect, vi } from 'vitest';
import { getStringValue } from '../string-reference.js';
import { ErrorType, ErrorCodes } from '../../errors.js';

describe('string-reference', () => {
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

  describe('getStringValue', () => {
    it('should get string value success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('hello', 'utf8'),
        ]),
      });
      const value = await getStringValue(mockExecutor, '1');
      expect(value).toBe('hello');
    });
  });
});
