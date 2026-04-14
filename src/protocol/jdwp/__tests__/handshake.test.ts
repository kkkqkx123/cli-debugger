import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performHandshake } from '../handshake.js';
import { ErrorType, ErrorCodes } from '../../errors.js';
import * as net from 'net';
import { EventEmitter } from 'events';

vi.useFakeTimers();

describe('handshake', () => {
  let mockSocket: net.Socket;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    // Create a real EventEmitter to handle events
    eventEmitter = new EventEmitter();

    // Create a mock socket that uses EventEmitter for event handling
    mockSocket = Object.create(net.Socket.prototype) as net.Socket;

    // Mock write method
    mockSocket.write = vi.fn((_data, callback) => {
      callback?.();
      return true;
    });

    // Use EventEmitter's on/off methods
    mockSocket.on = vi.fn((event, listener) => {
      eventEmitter.on(event, listener);
      return mockSocket;
    });

    mockSocket.removeListener = vi.fn((event, listener) => {
      eventEmitter.removeListener(event, listener);
      return mockSocket;
    });

    // Helper to emit events
    (mockSocket as any)._emit = (event: string, ...args: any[]) => {
      eventEmitter.emit(event, ...args);
    };

    mockSocket.destroySoon = vi.fn();
    mockSocket.connect = vi.fn();
    mockSocket.setEncoding = vi.fn();
    mockSocket.pause = vi.fn();
    mockSocket.resume = vi.fn();
    mockSocket.end = vi.fn();
    mockSocket.destroy = vi.fn();
    mockSocket.setTimeout = vi.fn();
    mockSocket.setNoDelay = vi.fn();
    mockSocket.setKeepAlive = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should perform handshake success', async () => {
    const handshakePromise = performHandshake(mockSocket, 5000);
    (mockSocket as any)._emit('data', Buffer.from('JDWP-Handshake', 'utf8'));
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
    (mockSocket as any)._emit('data', Buffer.from('Invalid-Handshake', 'utf8'));
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ProtocolError,
      code: ErrorCodes.HandshakeFailed,
    });
  });

  it('should perform handshake socket error', async () => {
    const err = new Error('Socket error');
    const handshakePromise = performHandshake(mockSocket, 5000);
    (mockSocket as any)._emit('error', err);
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ConnectionError,
      code: ErrorCodes.HandshakeFailed,
      cause: err,
    });
  });

  it('should perform handshake connection closed', async () => {
    const handshakePromise = performHandshake(mockSocket, 5000);
    (mockSocket as any)._emit('close');
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ConnectionError,
      code: ErrorCodes.ConnectionClosed,
      message: 'Connection closed during handshake',
    });
  });

  it('should perform handshake write error', async () => {
    const err = new Error('Write error');
    mockSocket.write = vi.fn((_data, callback) => {
      callback?.(err);
      return true;
    });
    const handshakePromise = performHandshake(mockSocket, 5000);
    await expect(handshakePromise).rejects.toMatchObject({
      type: ErrorType.ConnectionError,
      code: ErrorCodes.HandshakeFailed,
      message: 'Failed to send handshake',
      cause: err,
    });
  });
});
