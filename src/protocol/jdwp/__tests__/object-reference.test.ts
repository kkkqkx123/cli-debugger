import { describe, it, expect, vi } from 'vitest';
import {
  getReferenceType,
  getInstanceFieldValues,
  setInstanceFieldValues,
  setInstanceFieldValue,
  getMonitorInfo,
  invokeInstanceMethod,
  disableCollection,
  enableCollection,
  isCollected,
  getReferringObjects,
} from '../object-reference.js';

describe('object-reference', () => {
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

  describe('getReferenceType', () => {
    it('should get reference type success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
        ]),
      });
      const refType = await getReferenceType(mockExecutor, '1');
      expect(refType).toEqual({
        tag: 0x4c,
        refTypeID: '1',
      });
    });
  });

  describe('getInstanceFieldValues', () => {
    it('should get instance field values success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 123]),
        ]),
      });
      const values = await getInstanceFieldValues(mockExecutor, '1', ['1']);
      expect(values).toEqual([123]);
    });
  });

  describe('setInstanceFieldValues', () => {
    it('should set instance field values success', async () => {
      await setInstanceFieldValues(
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

  describe('setInstanceFieldValue', () => {
    it('should set instance field value success', async () => {
      await setInstanceFieldValue(mockExecutor, '1', '1', 123);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('getMonitorInfo', () => {
    it('should get monitor info success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
        ]),
      });
      const monitorInfo = await getMonitorInfo(mockExecutor, '1');
      expect(monitorInfo).toEqual({
        owner: '1',
        entryCount: 1,
        waitersCount: 1,
        waiters: ['2'],
      });
    });
  });

  describe('invokeInstanceMethod', () => {
    it('should invoke instance method success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 123]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
        ]),
      });
      const result = await invokeInstanceMethod(mockExecutor, '1', '1', '1', [], 0);
      expect(result).toEqual({
        returnValue: 123,
        exception: '0',
      });
    });
  });

  describe('disableCollection', () => {
    it('should disable collection success', async () => {
      await disableCollection(mockExecutor, '1');
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('enableCollection', () => {
    it('should enable collection success', async () => {
      await enableCollection(mockExecutor, '1');
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('isCollected', () => {
    it('should check is collected success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([1]),
      });
      const collected = await isCollected(mockExecutor, '1');
      expect(collected).toBe(true);
    });
  });

  describe('getReferringObjects', () => {
    it('should get referring objects success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
        ]),
      });
      const referringObjects = await getReferringObjects(mockExecutor, '1', 10);
      expect(referringObjects).toEqual(['1']);
    });
  });
});
