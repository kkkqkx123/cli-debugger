import { describe, it, expect, vi } from 'vitest';
import {
  getStackFrameValues,
  setStackFrameValues,
  getThisObject,
  popFrames,
} from '../stack-frame.js';

describe('stack-frame', () => {
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

  describe('getStackFrameValues', () => {
    it('should get stack frame values success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 123]),
        ]),
      });
      const values = await getStackFrameValues(mockExecutor, '1', '1', 1);
      expect(values).toEqual([
        {
          name: 'var_0',
          type: 'I',
          value: 123,
          isPrimitive: true,
          isNull: false,
        },
      ]);
    });
  });

  describe('setStackFrameValues', () => {
    it('should set stack frame values success', async () => {
      await setStackFrameValues(
        mockExecutor,
        '1',
        '1',
        new Map([
          [0, 123],
          [1, 456],
        ]),
      );
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('getThisObject', () => {
    it('should get this object success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
        ]),
      });
      const obj = await getThisObject(mockExecutor, '1', '1');
      expect(obj).toEqual({
        tag: 0x4c,
        objectID: '1',
      });
    });
  });

  describe('popFrames', () => {
    it('should pop frames success', async () => {
      await popFrames(mockExecutor, '1', '1');
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });
});
