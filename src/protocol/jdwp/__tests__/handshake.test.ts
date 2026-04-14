import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { performHandshake } from '../handshake.js';
import { ErrorType, ErrorCodes } from '../../errors.js';

vi.useFakeTimers();

describe('handshake', () => {
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = new EventEmitter();
    mockSocket.write = vi.fn((data, callback) => {
      callback?.();
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should perform handshake success', async () => {
    const handshakePromise = performHandshake(mockSocket, 5000);
    mockSocket.emit('data', Buffer.from('JDWP-Handshake', 'utf8'));
    await handshakePromise;
    expect(mockSocket.write).toHaveBeenCalled();
  });

  it('should perform handshake timeout', async () => {
    const handshakePromise = performHandshake(mockSocket, 100);
    vi.advanceTimersByTime(150);
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ConnectionError,
      code: ErrorCodes.ConnectionTimeout,
      message: 'Handshake timeout',
    });
  });

  it('should perform handshake invalid response', async () => {
    const handshakePromise = performHandshake(mockSocket, 5000);
    mockSocket.emit('data', Buffer.from('Invalid-Handshake', 'utf8'));
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ProtocolError,
      code: ErrorCodes.HandshakeFailed,
    });
  });

  it('should perform handshake socket error', async () => {
    const err = new Error('Socket error');
    const handshakePromise = performHandshake(mockSocket, 5000);
    mockSocket.emit('error', err);
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ConnectionError,
      code: ErrorCodes.HandshakeFailed,
      cause: err,
    });
  });

  it('should perform handshake connection closed', async () => {
    const handshakePromise = performHandshake(mockSocket, 5000);
    mockSocket.emit('close');
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ConnectionError,
      code: ErrorCodes.ConnectionClosed,
      message: 'Connection closed during handshake',
    });
  });

  it('should perform handshake write error', async () => {
    const err = new Error('Write error');
    mockSocket.write = vi.fn((data, callback) => {
      callback?.(err);
    });
    const handshakePromise = performHandshake(mockSocket, 5000);
    mockSocket.emit('data', Buffer.from('JDWP-Handshake', 'utf8'));
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ConnectionError,
      code: ErrorCodes.HandshakeFailed,
      message: 'Failed to send handshake response',
      cause: err,
    });
  });
});
