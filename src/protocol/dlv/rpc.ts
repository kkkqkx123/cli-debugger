/**
 * JSON-RPC 2.0 communication layer for Delve
 */

import * as net from "node:net";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
} from "./types.js";

/**
 * JSON-RPC client for Delve debugger
 */
export class DlvRpcClient {
  private socket: net.Socket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private buffer = "";
  private connected = false;
  private defaultTimeout: number;

  constructor(defaultTimeout = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Connect to Delve RPC server
   */
  async connect(host: string, port: number, timeout?: number): Promise<void> {
    if (this.connected) {
      return;
    }

    const connectTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(connectTimeout);

      const cleanup = () => {
        this.socket?.removeAllListeners();
      };

      this.socket.on("error", (err) => {
        cleanup();
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionFailed,
            `Failed to connect to ${host}:${port}`,
            err,
          ),
        );
      });

      this.socket.on("timeout", () => {
        cleanup();
        this.socket?.destroy();
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionTimeout,
            `Connection to ${host}:${port} timed out`,
          ),
        );
      });

      this.socket.on("close", () => {
        this.handleDisconnect();
      });

      this.socket.on("data", (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.connect(port, host, () => {
        this.connected = true;
        resolve();
      });
    });
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (!this.connected || !this.socket) {
      return;
    }

    const socket = this.socket;
    this.connected = false;
    this.socket = null;

    // Reject all pending requests
    for (const { reject, timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
      reject(
        new APIError(
          ErrorType.ConnectionError,
          ErrorCodes.ConnectionClosed,
          "Connection closed",
        ),
      );
    }
    this.pendingRequests.clear();

    return new Promise((resolve) => {
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

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send JSON-RPC request and wait for response
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.connected || !this.socket) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected",
      );
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.Timeout,
            `Request ${method} timed out`,
          ),
        );
      }, this.defaultTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId,
      });

      const message = JSON.stringify(request) + "\n";
      this.socket!.write(message, "utf8", (err) => {
        if (err) {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(id);
          reject(
            new APIError(
              ErrorType.ConnectionError,
              ErrorCodes.ConnectionClosed,
              `Failed to send request: ${method}`,
              err,
            ),
          );
        }
      });
    });
  }

  /**
   * Send notification (no response expected)
   */
  notify(method: string, params: unknown[] = []): void {
    if (!this.connected || !this.socket) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected",
      );
    }

    const request: Omit<JsonRpcRequest, "id"> = {
      jsonrpc: "2.0",
      method,
      params,
    };

    const message = JSON.stringify(request) + "\n";
    this.socket.write(message, "utf8");
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString("utf8");

    // Process complete messages (newline-delimited JSON)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) {
        this.handleMessage(line);
      }
    }
  }

  /**
   * Handle a complete JSON message
   */
  private handleMessage(message: string): void {
    let response: JsonRpcResponse;
    try {
      response = JSON.parse(message);
    } catch {
      // Invalid JSON, ignore
      return;
    }

    // Check if this is a response to a pending request
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(this.createRpcError(response.error));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  /**
   * Create APIError from JSON-RPC error
   * Maps Delve error codes to appropriate error types
   */
  private createRpcError(error: JsonRpcError | string): APIError {
    // Delve can return error as either a string or an object
    // Handle both cases
    let errorType: ErrorType;
    let errorCode: number;
    let errorMessage: string;

    if (typeof error === "string") {
      // Error is a plain string
      errorType = ErrorType.CommandError;
      errorCode = ErrorCodes.InternalError;
      errorMessage = error;
    } else {
      // Error is an object with code and message
      // Map JSON-RPC error codes to our error types
      // Delve error codes:
      // 1: Internal error
      // 2: Parameter error
      // 3: Not found
      // 4: Not readable
      // 5: Not supported
      // 5001: Process exited (custom Delve error)

      // Handle undefined or null error code
      const code = error.code ?? 1;

      switch (code) {
        case 1:
          errorType = ErrorType.CommandError;
          errorCode = ErrorCodes.InternalError;
          break;
        case 2:
          errorType = ErrorType.InputError;
          errorCode = ErrorCodes.InvalidInput;
          break;
        case 3:
          errorType = ErrorType.CommandError;
          errorCode = ErrorCodes.NotFound;
          break;
        case 4:
          errorType = ErrorType.CommandError;
          errorCode = ErrorCodes.NotReadable;
          break;
        case 5:
          errorType = ErrorType.CommandError;
          errorCode = ErrorCodes.NotSupported;
          break;
        case 5001:
          // Process exited - this is expected when the debugged process terminates
          errorType = ErrorType.CommandError;
          errorCode = ErrorCodes.InternalError;
          break;
        default:
          errorType = ErrorType.CommandError;
          errorCode = ErrorCodes.InternalError;
      }

      errorMessage = error.message || `Delve error (code: ${code})`;
    }

    return new APIError(
      errorType,
      errorCode,
      errorMessage,
    );
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.connected = false;

    // Reject all pending requests
    for (const { reject, timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
      reject(
        new APIError(
          ErrorType.ConnectionError,
          ErrorCodes.ConnectionClosed,
          "Connection closed",
        ),
      );
    }
    this.pendingRequests.clear();
  }
}

/**
 * Create a new RPC client
 */
export function createRpcClient(defaultTimeout?: number): DlvRpcClient {
  return new DlvRpcClient(defaultTimeout);
}
