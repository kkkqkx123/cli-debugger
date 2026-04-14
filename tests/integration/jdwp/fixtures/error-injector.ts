/**
 * Error injector for integration testing
 * Provides utilities to inject various errors for testing error recovery
 */

import type { MockJDWPServer } from "./mock-jdwp-server.js";
import * as net from "node:net";

/**
 * Error types that can be injected
 */
export type ErrorType =
  | "connection-drop"
  | "malformed-packet"
  | "protocol-error"
  | "timeout"
  | "partial-write";

/**
 * Error injector
 */
export class ErrorInjector {
  private server: MockJDWPServer;
  private injectedErrors: Set<ErrorType> = new Set();

  constructor(server: MockJDWPServer) {
    this.server = server;
  }

  /**
   * Inject connection drop
   */
  injectConnectionDrop(): void {
    this.injectedErrors.add("connection-drop");
    this.server.simulateError();
  }

  /**
   * Inject malformed packet response
   */
  injectMalformedPacket(): void {
    this.injectedErrors.add("malformed-packet");
    this.server.setResponseHandler(() => {
      // Return malformed packet
      return Buffer.from([0, 0, 0, 0]); // Invalid length
    });
  }

  /**
   * Inject protocol error
   */
  injectProtocolError(): void {
    this.injectedErrors.add("protocol-error");
    this.server.setResponseHandler((packet) => {
      // Return error response for all commands
      const length = packet.readUInt32BE(0);
      const id = packet.readInt32BE(4);

      // Build error reply
      const reply = Buffer.alloc(11);
      reply.writeUInt32BE(11, 0);
      reply.writeInt32BE(id, 4);
      reply.writeUInt8(0x80, 8); // Reply flag
      reply.writeUInt16BE(500, 9); // Error code

      return reply;
    });
  }

  /**
   * Inject timeout (delay responses)
   */
  injectTimeout(delayMs: number = 5000): void {
    this.injectedErrors.add("timeout");
    // This is handled by setting responseDelay in server options
    // For now, we just mark it as injected
  }

  /**
   * Inject partial write
   */
  injectPartialWrite(): void {
    this.injectedErrors.add("partial-write");
    // This would require modifying the socket write behavior
    // For now, we just mark it as injected
  }

  /**
   * Clear all injected errors
   */
  clearErrors(): void {
    this.injectedErrors.clear();
    // Reset server to default behavior
    this.server.setResponseHandler(null as never);
  }

  /**
   * Check if error is injected
   */
  hasError(type: ErrorType): boolean {
    return this.injectedErrors.has(type);
  }

  /**
   * Get all injected errors
   */
  getInjectedErrors(): ErrorType[] {
    return Array.from(this.injectedErrors);
  }

  /**
   * Create a socket that drops connection after N bytes
   */
  static createDroppingSocket(
    originalSocket: net.Socket,
    dropAfterBytes: number,
  ): net.Socket {
    let bytesWritten = 0;
    const originalWrite = originalSocket.write.bind(originalSocket);

    originalSocket.write = ((data: Buffer | string, ...args: unknown[]) => {
      if (Buffer.isBuffer(data)) {
        bytesWritten += data.length;
        if (bytesWritten >= dropAfterBytes) {
          originalSocket.destroy();
          return false;
        }
      }
      return originalWrite(data, ...args);
    }) as typeof originalSocket.write;

    return originalSocket;
  }

  /**
   * Create a socket that introduces delays
   */
  static createDelayedSocket(
    originalSocket: net.Socket,
    delayMs: number,
  ): net.Socket {
    const originalWrite = originalSocket.write.bind(originalSocket);

    originalSocket.write = ((data: Buffer | string, ...args: unknown[]) => {
      setTimeout(() => {
        originalWrite(data, ...args);
      }, delayMs);
      return true;
    }) as typeof originalSocket.write;

    return originalSocket;
  }
}
