/**
 * Python subprocess bridge for LLDB
 */

import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as url from "node:url";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";
import type { BridgeResponse, BridgeErrorCode } from "./types.js";
import {
  createRequest,
  parseResponse,
  serializeRequest,
  isErrorResponse,
  PROTOCOL,
} from "./protocol.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * Convert camelCase method name to snake_case
 * This is needed because TS uses camelCase but Python handlers use snake_case
 */
function camelToSnake(method: string): string {
  return method.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * LLDB Python bridge
 * Manages communication with the Python subprocess
 */
export class LLDBBridge {
  private process: ChildProcess | null = null;
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
  private scriptPath: string;
  private pythonPath: string;
  private defaultTimeout: number;

  constructor(options: { pythonPath?: string; timeout?: number } = {}) {
    this.pythonPath = options.pythonPath ?? "python3";
    this.defaultTimeout = options.timeout ?? PROTOCOL.DEFAULT_TIMEOUT;
    this.scriptPath = this.resolveScriptPath();
  }

  /**
   * Resolve the path to the Python bridge script
   */
  private resolveScriptPath(): string {
    // Script is located at scripts/lldb_bridge.py relative to this file
    return path.join(__dirname, "scripts", "lldb_bridge.py");
  }

  /**
   * Start the Python bridge process
   */
  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.pythonPath, [this.scriptPath], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
        });

        this.process.on("error", (err) => {
          this.cleanup();
          reject(
            new APIError(
              ErrorType.ConnectionError,
              ErrorCodes.ConnectionFailed,
              `Failed to start Python bridge: ${err.message}`,
              err,
            ),
          );
        });

        this.process.on("exit", (code, _signal) => {
          this.cleanup();
          if (code !== 0 && code !== null) {
            // Process exited unexpectedly
            this.rejectAllPending(
              new APIError(
                ErrorType.ConnectionError,
                ErrorCodes.ConnectionClosed,
                `Python bridge exited with code ${code}`,
              ),
            );
          }
        });

        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleData(data);
        });

        this.process.stderr?.on("data", (data: Buffer) => {
          // Log stderr for debugging but don't treat as error
          console.error(`[lldb-bridge] ${data.toString().trim()}`);
        });

        // Give process a moment to start
        setImmediate(resolve);
      } catch (err) {
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionFailed,
            `Failed to spawn Python process: ${err}`,
          ),
        );
      }
    });
  }

  /**
   * Call a method on the Python bridge
   */
  async call<T>(method: string, params: unknown, timeout?: number): Promise<T> {
    if (!this.process || !this.process.stdin) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Bridge process not running",
      );
    }

    const id = ++this.requestId;
    // Convert camelCase to snake_case for Python handlers
    const pythonMethod = camelToSnake(method);
    const request = createRequest(id, pythonMethod, params);
    const actualTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionTimeout,
            `Request ${method} timed out after ${actualTimeout}ms`,
          ),
        );
      }, actualTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId,
      });

      const message = serializeRequest(request);
      this.process!.stdin!.write(message);
    });
  }

  /**
   * Handle incoming data from Python stdout
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    this.processBuffer();
  }

  /**
   * Process complete messages in the buffer
   */
  private processBuffer(): void {
    const lines = this.buffer.split(PROTOCOL.DELIMITER);
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const response: BridgeResponse = parseResponse(line);
        this.handleResponse(response);
      } catch (err) {
        console.error(`[lldb-bridge] Failed to parse response: ${line}`, err);
      }
    }
  }

  /**
   * Handle a parsed response
   */
  private handleResponse(response: BridgeResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);

    if (isErrorResponse(response)) {
      pending.reject(this.convertError(response.error));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Convert bridge error to APIError
   */
  private convertError(error: { code: string; message: string }): APIError {
    const errorType = this.mapErrorType(error.code as BridgeErrorCode);
    return new APIError(errorType, ErrorCodes.InternalError, error.message);
  }

  /**
   * Map bridge error code to error type
   */
  private mapErrorType(code: BridgeErrorCode): ErrorType {
    switch (code) {
      case "NO_TARGET":
      case "NO_PROCESS":
      case "TARGET_NOT_FOUND":
        return ErrorType.ConnectionError;
      case "INVALID_INPUT":
        return ErrorType.InputError;
      case "UNKNOWN_METHOD":
        return ErrorType.ProtocolError;
      default:
        return ErrorType.InternalError;
    }
  }

  /**
   * Stop the bridge process
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    // Send disconnect command first
    try {
      await this.call("disconnect", { keepAlive: true }, 5000);
    } catch {
      // Ignore disconnect errors
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.buffer = "";
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Check if bridge is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
