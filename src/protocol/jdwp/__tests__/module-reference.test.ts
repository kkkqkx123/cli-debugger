import { describe, it, expect, vi } from 'vitest';
import {
  getModuleName,
  getModuleClassLoader,
} from '../module-reference.js';
import { ErrorType, ErrorCodes } from '../../errors.js';

describe('module-reference', () => {
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

  describe('getModuleName', () => {
    it('should get module name success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('java.', 'utf8'),
        ]),
      });
      const name = await getModuleName(mockExecutor, '1');
      expect(name).toBe('java.');
    });
  });

  describe('getModuleClassLoader', () => {
    it('should get module class loader success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const classLoader = await getModuleClassLoader(mockExecutor, '1');
      expect(classLoader).toBe('1');
    });
  });
});
