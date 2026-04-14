import { describe, it, expect, vi } from 'vitest';
import {
  getThreadGroupName,
  getParentThreadGroup,
  getThreadGroupChildren,
} from '../thread-group-reference.js';

describe('thread-group-reference', () => {
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

  describe('getThreadGroupName', () => {
    it('should get thread group name success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 4]),
          Buffer.from('main', 'utf8'),
        ]),
      });
      const name = await getThreadGroupName(mockExecutor, '1');
      expect(name).toBe('main');
    });
  });

  describe('getParentThreadGroup', () => {
    it('should get parent thread group success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const parent = await getParentThreadGroup(mockExecutor, '1');
      expect(parent).toBe('1');
    });
  });

  describe('getThreadGroupChildren', () => {
    it('should get thread group children success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
        ]),
      });
      const children = await getThreadGroupChildren(mockExecutor, '1');
      expect(children).toEqual({
        childGroups: ['1'],
        childThreads: ['2'],
      });
    });
  });
});
