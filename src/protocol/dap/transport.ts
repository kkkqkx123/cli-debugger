/**
 * DAP (Debug Adapter Protocol) Transport Layer
 *
 * Implements the DAP wire protocol over TCP:
 *   Content-Length: {length}\r\n\r\n{json-body}
 */

import * as net from "node:net";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";

/** DAP message types */
export interface DAPRequest {
  seq: number;
  type: "request";
  command: string;
  arguments?: unknown;
}

export interface DAPResponse {
  seq: number;
  type: "response";
  request_seq: number;
  command: string;
  success: boolean;
  message?: string;
  body?: unknown;
}

export interface DAPEvent {
  seq: number;
  type: "event";
  event: string;
  body?: unknown;
}

export type DAPMessage = DAPRequest | DAPResponse | DAPEvent;

/**
 * DAP transport over TCP
 * Handles the Content-Length framing protocol
 */
export class DAPTransport {
  private socket: net.Socket | null = null;
  private rawBuffer = "";
  private seqCounter = 1;
  private pendingRequests = new Map<number, {
    resolve: (response: DAPResponse) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private eventHandlers = new Map<string, (event: DAPEvent) => void>();
  private connected = false;
  private host: string;
  private port: number;
  private timeout: number;
  private onDataBound: (chunk: Buffer) => void;

  constructor(host: string, port: number, timeout: number) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;
    this.onDataBound = this.onData.bind(this);
  }

  /**
   * Connect to the DAP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const address = `${this.host}:${this.port}`;
      this.socket = new net.Socket();
      this.socket.setTimeout(this.timeout);

      this.socket.on("error", (err) => {
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionFailed,
            `Failed to connect to DAP server at ${address}`,
            { host: this.host, port: this.port },
            err,
          ),
        );
      });

      this.socket.on("timeout", () => {
        this.socket?.destroy();
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionTimeout,
            `Connection to DAP server at ${address} timed out`,
            { host: this.host, port: this.port, timeout: this.timeout },
          ),
        );
      });

      this.socket.on("close", () => {
        this.connected = false;
        this.socket = null;
        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(
            new APIError(
              ErrorType.ConnectionError,
              ErrorCodes.ConnectionClosed,
              "Connection closed",
            ),
          );
        }
        this.pendingRequests.clear();
      });

      this.socket.connect(this.port, this.host, () => {
        if (!this.socket) {
          reject(
            new APIError(
              ErrorType.ConnectionError,
              ErrorCodes.ConnectionClosed,
              "Socket not available after connect",
            ),
          );
          return;
        }
        this.connected = true;
        this.socket.on("data", this.onDataBound);
        resolve();
      });
    });
  }

  /**
   * Send a DAP request and wait for the response
   */
  async sendRequest(command: string, args?: unknown): Promise<DAPResponse> {
    if (!this.socket || !this.connected) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected to DAP server",
      );
    }

    const seq = this.seqCounter++;
    const request: DAPRequest = {
      seq,
      type: "request",
      command,
      arguments: args,
    };

    return new Promise<DAPResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(seq);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.Timeout,
            `DAP request '${command}' timed out after ${this.timeout}ms`,
            { command, seq, timeout: this.timeout },
          ),
        );
      }, this.timeout);

      this.pendingRequests.set(seq, { resolve, reject, timer });

      try {
        const encoded = this.encodeMessage(request);
        this.socket!.write(encoded, (err) => {
          if (err) {
            clearTimeout(timer);
            this.pendingRequests.delete(seq);
            reject(
              new APIError(
                ErrorType.ConnectionError,
                ErrorCodes.ConnectionClosed,
                `Failed to send DAP request '${command}'`,
                { command, seq },
                err,
              ),
            );
          }
        });
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(seq);
        reject(err);
      }
    });
  }

  /**
   * Register an event handler
   */
  onEvent(event: string, handler: (event: DAPEvent) => void): void {
    this.eventHandlers.set(event, handler);
  }

  /**
   * Remove an event handler
   */
  offEvent(event: string): void {
    this.eventHandlers.delete(event);
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    this.connected = false;
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.removeListener("data", this.onDataBound);
      return new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          socket.destroy();
          resolve();
        }, 3000);
        socket.end(() => {
          clearTimeout(timeoutId);
          resolve();
        });
        socket.on("error", () => {
          clearTimeout(timeoutId);
          resolve();
        });
      });
    }
  }

  /**
   * Encode a DAP message into the wire format
   */
  private encodeMessage(message: DAPMessage): Buffer {
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, "utf-8")}\r\n\r\n`;
    return Buffer.concat([
      Buffer.from(header, "utf-8"),
      Buffer.from(json, "utf-8"),
    ]);
  }

  /**
   * Handle incoming data from the socket
   */
  private onData(chunk: Buffer): void {
    this.rawBuffer += chunk.toString("utf-8");

    // Process all complete messages in the buffer
    while (true) {
      const headerEnd = this.rawBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        break; // Incomplete header, wait for more data
      }

      // Parse Content-Length header
      const header = this.rawBuffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        // Malformed header, skip
        this.rawBuffer = this.rawBuffer.substring(headerEnd + 4);
        continue;
      }

      const contentLengthStr = contentLengthMatch[1];
      if (!contentLengthStr) {
        // Malformed header, skip
        this.rawBuffer = this.rawBuffer.substring(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthStr, 10);
      const bodyStart = headerEnd + 4;

      if (this.rawBuffer.length < bodyStart + contentLength) {
        break; // Incomplete body, wait for more data
      }

      const body = this.rawBuffer.substring(bodyStart, bodyStart + contentLength);
      this.rawBuffer = this.rawBuffer.substring(bodyStart + contentLength);

      try {
        const message = JSON.parse(body) as DAPMessage;
        this.dispatchMessage(message);
      } catch {
        // JSON parse error, skip this message
      }
    }
  }

  /**
   * Dispatch a parsed DAP message to the appropriate handler
   */
  private dispatchMessage(message: DAPMessage): void {
    if (message.type === "response") {
      const response = message as DAPResponse;
      const pending = this.pendingRequests.get(response.request_seq);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.request_seq);
        if (response.success) {
          pending.resolve(response);
        } else {
          pending.reject(
            new APIError(
              ErrorType.CommandError,
              ErrorCodes.ProtocolError,
              response.message || `DAP command '${response.command}' failed`,
              { command: response.command, request_seq: response.request_seq },
            ),
          );
        }
      }
    } else if (message.type === "event") {
      const event = message as DAPEvent;
      const handler = this.eventHandlers.get(event.event);
      if (handler) {
        handler(event);
      }
      // Also dispatch to catch-all '*'
      const catchAllHandler = this.eventHandlers.get("*");
      if (catchAllHandler) {
        catchAllHandler(event);
      }
    }
    // Ignore requests (server-to-client requests are rare in DAP)
  }
}