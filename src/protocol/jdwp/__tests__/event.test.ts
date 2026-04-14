import { describe, it, expect, vi } from 'vitest';
import {
  setBreakpointRequest,
  clearBreakpointRequest,
  clearAllBreakpoints,
  setStepRequest,
  setClassPrepareRequest,
  setThreadStartRequest,
  setThreadDeathRequest,
  parseEvent,
} from '../event.js';
import { EventType } from '../protocol/index.js';

describe('event', () => {
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

  describe('setBreakpointRequest', () => {
    it('should set breakpoint request success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1]),
      });
      const requestID = await setBreakpointRequest(mockExecutor, '1', '1', 0n);
      expect(requestID).toBe(1);
    });
  });

  describe('clearBreakpointRequest', () => {
    it('should clear breakpoint request success', async () => {
      await clearBreakpointRequest(mockExecutor, 1);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('clearAllBreakpoints', () => {
    it('should clear all breakpoints success', async () => {
      await clearAllBreakpoints(mockExecutor);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('setStepRequest', () => {
    it('should set step request success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1]),
      });
      const requestID = await setStepRequest(mockExecutor, '1', 1);
      expect(requestID).toBe(1);
    });
  });

  describe('setClassPrepareRequest', () => {
    it('should set class prepare request success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1]),
      });
      const requestID = await setClassPrepareRequest(mockExecutor);
      expect(requestID).toBe(1);
    });
  });

  describe('setThreadStartRequest', () => {
    it('should set thread start request success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1]),
      });
      const requestID = await setThreadStartRequest(mockExecutor);
      expect(requestID).toBe(1);
    });
  });

  describe('setThreadDeathRequest', () => {
    it('should set thread death request success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1]),
      });
      const requestID = await setThreadDeathRequest(mockExecutor);
      expect(requestID).toBe(1);
    });
  });

  describe('parseEvent', () => {
    it('should parse event no events', () => {
      const data = Buffer.concat([
        Buffer.from([0]),
        Buffer.from([0, 0, 0, 0]),
      ]);
      const event = parseEvent(data, mockExecutor.idSizes);
      expect(event).toBeNull();
    });

    it('should parse event breakpoint', () => {
      const data = Buffer.concat([
        Buffer.from([0]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([EventType.Breakpoint]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      ]);
      const event = parseEvent(data, mockExecutor.idSizes);
      expect(event).not.toBeNull();
      expect(event?.type).toBe('breakpoint');
      expect(event?.threadId).toBe('1');
    });

    it('should parse event step', () => {
      const data = Buffer.concat([
        Buffer.from([0]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([EventType.SingleStep]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      ]);
      const event = parseEvent(data, mockExecutor.idSizes);
      expect(event).not.toBeNull();
      expect(event?.type).toBe('step');
      expect(event?.threadId).toBe('1');
    });

    it('should parse event thread start', () => {
      const data = Buffer.concat([
        Buffer.from([0]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([EventType.ThreadStart]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      ]);
      const event = parseEvent(data, mockExecutor.idSizes);
      expect(event).not.toBeNull();
      expect(event?.type).toBe('thread_start');
      expect(event?.threadId).toBe('1');
    });

    it('should parse event thread death', () => {
      const data = Buffer.concat([
        Buffer.from([0]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([EventType.ThreadDeath]),
        Buffer.from([0, 0, 0, 1]),
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      ]);
      const event = parseEvent(data, mockExecutor.idSizes);
      expect(event).not.toBeNull();
      expect(event?.type).toBe('thread_death');
      expect(event?.threadId).toBe('1');
    });
  });
});
