import { describe, it, expect, vi } from 'vitest';
import {
  getThreadName,
  getThreadStatus,
  getThreadState,
  suspendThread,
  resumeThread,
  getThreadFrames,
  getThreadFrameCount,
  getThreadStack,
  getThreadGroup,
  getOwnedMonitors,
  getCurrentContendedMonitor,
  stopThread,
  interruptThread,
  getSuspendCount,
  forceEarlyReturn,
} from '../thread.js';

describe('thread', () => {
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

  describe('getThreadName', () => {
    it('should get thread name success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 4]),
          Buffer.from('main', 'utf8'),
        ]),
      });
      const name = await getThreadName(mockExecutor, '1');
      expect(name).toBe('main');
    });
  });

  describe('getThreadStatus', () => {
    it('should get thread status success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1, 0, 0, 0, 1]),
      });
      const status = await getThreadStatus(mockExecutor, '1');
      expect(status).toEqual({
        threadStatus: 1,
        suspendStatus: 1,
      });
    });
  });

  describe('getThreadState', () => {
    it('should get thread state success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 4, 0, 0, 0, 1]),
      });
      const state = await getThreadState(mockExecutor, '1');
      expect(state).toBe('waiting-for-monitor');
    });
  });

  describe('suspendThread', () => {
    it('should suspend thread success', async () => {
      await suspendThread(mockExecutor, '1');
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('resumeThread', () => {
    it('should resume thread success', async () => {
      await resumeThread(mockExecutor, '1');
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('getThreadFrames', () => {
    it('should get thread frames success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        ]),
      });
      const frames = await getThreadFrames(mockExecutor, '1', 0, 1);
      expect(frames).toEqual([
        {
          frameID: '1',
          location: '1',
          method: '1',
        },
      ]);
    });
  });

  describe('getThreadFrameCount', () => {
    it('should get thread frame count success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 5]),
      });
      const count = await getThreadFrameCount(mockExecutor, '1');
      expect(count).toBe(5);
    });
  });

  describe('getThreadStack', () => {
    it('should get thread stack success', async () => {
      mockExecutor.readReply
        .mockResolvedValueOnce({
          errorCode: 0,
          message: '',
          data: Buffer.from([0, 0, 0, 1]),
        })
        .mockResolvedValueOnce({
          errorCode: 0,
          message: '',
          data: Buffer.concat([
            Buffer.from([0, 0, 0, 1]),
            Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
            Buffer.from([0x4c]),
            Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
            Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
            Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
          ]),
        });
      const stack = await getThreadStack(mockExecutor, '1');
      expect(stack).toEqual([
        {
          id: '1',
          location: '1',
          method: '1',
          line: 0,
          isNative: false,
        },
      ]);
    });

    it('should get thread stack empty', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0]),
      });
      const stack = await getThreadStack(mockExecutor, '1');
      expect(stack).toEqual([]);
    });
  });

  describe('getThreadGroup', () => {
    it('should get thread group success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const group = await getThreadGroup(mockExecutor, '1');
      expect(group).toBe('1');
    });
  });

  describe('getOwnedMonitors', () => {
    it('should get owned monitors success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 2]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
        ]),
      });
      const monitors = await getOwnedMonitors(mockExecutor, '1');
      expect(monitors).toEqual(['1', '2']);
    });
  });

  describe('getCurrentContendedMonitor', () => {
    it('should get current contended monitor success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const monitor = await getCurrentContendedMonitor(mockExecutor, '1');
      expect(monitor).toBe('1');
    });
  });

  describe('stopThread', () => {
    it('should stop thread success', async () => {
      await stopThread(mockExecutor, '1', '2');
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('interruptThread', () => {
    it('should interrupt thread success', async () => {
      await interruptThread(mockExecutor, '1');
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('getSuspendCount', () => {
    it('should get suspend count success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1]),
      });
      const count = await getSuspendCount(mockExecutor, '1');
      expect(count).toBe(1);
    });
  });

  describe('forceEarlyReturn', () => {
    it('should force early return success', async () => {
      await forceEarlyReturn(mockExecutor, '1', '2', 123);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });
});
