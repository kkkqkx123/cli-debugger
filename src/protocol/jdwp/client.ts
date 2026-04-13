/**
 * JDWP Client Implementation
 * Implements DebugProtocol interface for Java Debug Wire Protocol
 */

import * as net from "node:net";
import type { DebugProtocol } from "../base.js";
import type { DebugConfig } from "../../types/config.js";
import type { VersionInfo, Capabilities } from "../../types/metadata.js";
import type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from "../../types/debug.js";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";
import { performHandshake } from "./handshake.js";
import { decodeReplyPacket } from "./codec.js";
import {
  type IDSizes,
  type InternalBreakpointInfo,
  SuspendPolicy,
  StepKind,
} from "./protocol.js";
import * as vm from "./vm.js";
import * as referenceType from "./reference-type.js";
import * as method from "./method.js";
import * as thread from "./thread.js";
import * as stackFrame from "./stack-frame.js";
import * as event from "./event.js";

/**
 * JDWP Client
 */
export class JDWPClient implements DebugProtocol {
  private config: DebugConfig;
  private socket: net.Socket | null = null;
  private connected = false;
  private idSizes: IDSizes | null = null;
  private breakpointMap: Map<string, InternalBreakpointInfo> = new Map();
  private packetBuffer: Buffer = Buffer.alloc(0);

  constructor(config: DebugConfig) {
    this.config = config;
  }

  // ==================== Lifecycle ====================

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const address = `${this.config.host}:${this.config.port}`;

      this.socket = new net.Socket();
      this.socket.setTimeout(this.config.timeout);

      this.socket.on("error", (err) => {
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionFailed,
            `Failed to connect to ${address}`,
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
            `Connection to ${address} timed out`,
          ),
        );
      });

      this.socket.connect(this.config.port, this.config.host, async () => {
        if (!this.socket) {
          reject(
            new APIError(
              ErrorType.ConnectionError,
              ErrorCodes.ConnectionClosed,
              "Socket not available",
            ),
          );
          return;
        }
        try {
          // Perform handshake
          await performHandshake(this.socket, this.config.timeout);

          // Get ID sizes
          this.idSizes = await this.executeCommand((executor) =>
            vm.getIDSizes(executor),
          );

          this.connected = true;
          resolve();
        } catch (err) {
          this.socket?.destroy();
          reject(err);
        }
      });
    });
  }

  async close(): Promise<void> {
    if (!this.connected || !this.socket) {
      return;
    }

    const socket = this.socket;
    return new Promise((resolve) => {
      socket.end(() => {
        this.connected = false;
        this.socket = null;
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ==================== Metadata ====================

  protocolName(): string {
    return "jdwp";
  }

  supportedLanguages(): string[] {
    return ["java", "kotlin", "scala"];
  }

  async version(): Promise<VersionInfo> {
    return this.executeCommand((executor) => vm.getVersion(executor));
  }

  async capabilities(): Promise<Capabilities> {
    return this.executeCommand((executor) => vm.getCapabilities(executor));
  }

  // ==================== Thread Management ====================

  async threads(): Promise<ThreadInfo[]> {
    return this.executeCommand(async (executor) => {
      // Suspend VM to get consistent thread info
      await vm.suspendVM(executor);

      try {
        const threadIDs = await vm.getAllThreads(executor);
        const threads: ThreadInfo[] = [];

        for (const threadID of threadIDs) {
          const name = await thread.getThreadName(executor, threadID);
          const { threadStatus, suspendStatus } = await thread.getThreadStatus(
            executor,
            threadID,
          );

          threads.push({
            id: threadID,
            name,
            state: this.getThreadStateString(threadStatus),
            status: this.getThreadStateString(threadStatus),
            isSuspended: suspendStatus > 0,
            isDaemon: false,
            priority: 5,
            createdAt: new Date(),
          });
        }

        return threads;
      } finally {
        // Resume VM
        await vm.resumeVM(executor);
      }
    });
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    return this.executeCommand((executor) =>
      thread.getThreadStack(executor, threadId),
    );
  }

  async threadState(threadId: string): Promise<string> {
    return this.executeCommand((executor) =>
      thread.getThreadState(executor, threadId),
    );
  }

  // ==================== Execution Control ====================

  async suspend(threadId?: string): Promise<void> {
    return this.executeCommand(async (executor) => {
      if (threadId) {
        await thread.suspendThread(executor, threadId);
      } else {
        await vm.suspendVM(executor);
      }
    });
  }

  async resume(threadId?: string): Promise<void> {
    return this.executeCommand(async (executor) => {
      if (threadId) {
        await thread.resumeThread(executor, threadId);
      } else {
        await vm.resumeVM(executor);
      }
    });
  }

  async stepInto(threadId: string): Promise<void> {
    return this.executeCommand(async (executor) => {
      const requestID = await event.setStepRequest(
        executor,
        threadId,
        StepKind.Into,
        SuspendPolicy.All,
      );

      await vm.resumeVM(executor);

      // Wait for step event
      await this.waitForEventInternal(executor, 30000);

      // Clear event request
      await event.clearBreakpointRequest(executor, requestID);
    });
  }

  async stepOver(threadId: string): Promise<void> {
    return this.executeCommand(async (executor) => {
      const requestID = await event.setStepRequest(
        executor,
        threadId,
        StepKind.Over,
        SuspendPolicy.All,
      );

      await vm.resumeVM(executor);

      // Wait for step event
      await this.waitForEventInternal(executor, 30000);

      // Clear event request
      await event.clearBreakpointRequest(executor, requestID);
    });
  }

  async stepOut(threadId: string): Promise<void> {
    return this.executeCommand(async (executor) => {
      const requestID = await event.setStepRequest(
        executor,
        threadId,
        StepKind.Out,
        SuspendPolicy.All,
      );

      await vm.resumeVM(executor);

      // Wait for step event
      await this.waitForEventInternal(executor, 30000);

      // Clear event request
      await event.clearBreakpointRequest(executor, requestID);
    });
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(location: string): Promise<string> {
    return this.executeCommand(async (executor) => {
      const { className, methodName, lineNumber } = this.parseLocation(location);

      // Find class
      const classInfo = await vm.classByName(executor, className);
      if (!classInfo) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Class not found: ${className}`,
        );
      }

      // Get methods
      const methods = await referenceType.getMethods(executor, classInfo.refID);
      const targetMethod = methods.find((m) => m.name === methodName);
      if (!targetMethod) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Method not found: ${methodName}`,
        );
      }

      // Get line table
      const lineTable = await method.getLineTable(
        executor,
        classInfo.refID,
        targetMethod.methodID,
      );

      const lineLocation = lineTable.find(
        (loc) => loc.lineNumber === lineNumber,
      );
      if (!lineLocation) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Line number not found: ${lineNumber}`,
        );
      }

      // Set breakpoint request
      const requestID = await event.setBreakpointRequest(
        executor,
        classInfo.refID,
        targetMethod.methodID,
        lineLocation.lineCodeIndex,
        SuspendPolicy.EventThread,
      );

      // Generate breakpoint ID
      const bpID = `bp_${this.breakpointMap.size + 1}`;
      this.breakpointMap.set(bpID, {
        id: bpID,
        requestID,
        location,
        enabled: true,
        hitCount: 0,
      });

      return bpID;
    });
  }

  async removeBreakpoint(id: string): Promise<void> {
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      return;
    }

    await this.executeCommand(async (executor) => {
      await event.clearBreakpointRequest(executor, bp.requestID);
    });

    this.breakpointMap.delete(id);
  }

  async clearBreakpoints(): Promise<void> {
    await this.executeCommand((executor) =>
      event.clearAllBreakpoints(executor),
    );
    this.breakpointMap.clear();
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    return Array.from(this.breakpointMap.values()).map((bp) => ({
      id: bp.id,
      location: bp.location,
      enabled: bp.enabled,
      hitCount: bp.hitCount,
    }));
  }

  // ==================== Variable Inspection ====================

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    return this.executeCommand(async (executor) => {
      // Get frame count
      const frameCount = await thread.getThreadFrameCount(executor, threadId);
      if (frameIndex >= frameCount) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid frame index: ${frameIndex}`,
        );
      }

      // Get frames
      const frames = await thread.getThreadFrames(
        executor,
        threadId,
        frameIndex,
        1,
      );
      if (frames.length === 0) {
        return [];
      }

      // Get frame values (simplified - would need variable table for proper names)
      const firstFrame = frames[0];
      if (!firstFrame) {
        return [];
      }
      return stackFrame.getStackFrameValues(
        executor,
        threadId,
        firstFrame.frameID,
        10, // Assume max 10 local variables
      );
    });
  }

  async fields(objectId: string): Promise<Variable[]> {
    return this.executeCommand(async (executor) => {
      // Parse object ID (format: "tag:id")
      const parts = objectId.split(":");
      if (parts.length !== 2) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidObjectId,
          `Invalid object ID: ${objectId}`,
        );
      }

      const refTypeID = parts[1];
      if (!refTypeID) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid object ID: ${objectId}`,
        );
      }

      // Get fields
      const fields = await referenceType.getFields(executor, refTypeID);
      if (fields.length === 0) {
        return [];
      }

      // Get field values
      const fieldIDs = fields.map((f) => f.fieldID);
      const { tags, values } = await referenceType.getValuesWithTags(
        executor,
        refTypeID,
        fieldIDs,
      );

      return fields.map((field, i) => {
        const tag = tags[i] ?? 0;
        const value = values[i];
        return {
          name: field.name,
          type: field.signature,
          value,
          isPrimitive: this.isPrimitiveTag(tag),
          isNull: value === null || value === undefined,
        };
      });
    });
  }

  // ==================== Event Handling ====================

  async waitForEvent(timeout?: number): Promise<DebugEvent | null> {
    return this.executeCommand((executor) =>
      this.waitForEventInternal(executor, timeout ?? 30000),
    );
  }

  // ==================== Private Methods ====================

  private async executeCommand<T>(
    fn: (executor: vm.JDWPCommandExecutor) => Promise<T>,
  ): Promise<T> {
    if (!this.connected || !this.socket || !this.idSizes) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected",
      );
    }

    const executor: vm.JDWPCommandExecutor = {
      sendPacket: (packet) => this.sendPacket(packet),
      readReply: () => this.readReply(),
      idSizes: this.idSizes,
    };

    return fn(executor);
  }

  private async sendPacket(packet: Buffer): Promise<void> {
    if (!this.socket) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Socket not available",
      );
    }
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      socket.write(packet, (err) => {
        if (err) {
          reject(
            new APIError(
              ErrorType.ConnectionError,
              ErrorCodes.ConnectionClosed,
              "Failed to send packet",
              err,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  private async readReply(): Promise<{
    errorCode: number;
    message: string;
    data: Buffer;
  }> {
    if (!this.socket) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Socket not available",
      );
    }
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.Timeout,
            "Read timeout",
          ),
        );
      }, this.config.timeout);

      const onData = (chunk: Buffer) => {
        this.packetBuffer = Buffer.concat([this.packetBuffer, chunk]);

        // Check if we have enough data for length
        if (this.packetBuffer.length < 4) {
          return;
        }

        const length = this.packetBuffer.readUInt32BE(0);

        // Check if we have complete packet
        if (this.packetBuffer.length >= length) {
          clearTimeout(timeoutId);
          socket.removeListener("data", onData);
          socket.removeListener("error", onError);
          socket.removeListener("close", onClose);

          const packetData = this.packetBuffer.subarray(4, length);
          this.packetBuffer = this.packetBuffer.subarray(length);

          try {
            const reply = decodeReplyPacket(packetData);
            resolve({
              errorCode: reply.errorCode,
              message: reply.message,
              data: reply.data,
            });
          } catch (err) {
            reject(err);
          }
        }
      };

      const onError = (err: Error) => {
        clearTimeout(timeoutId);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionClosed,
            "Connection error",
            err,
          ),
        );
      };

      const onClose = () => {
        clearTimeout(timeoutId);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionClosed,
            "Connection closed",
          ),
        );
      };

      socket.on("data", onData);
      socket.on("error", onError);
      socket.on("close", onClose);

      // Process existing buffer
      if (this.packetBuffer.length > 0) {
        onData(Buffer.alloc(0));
      }
    });
  }

  private async waitForEventInternal(
    _executor: vm.JDWPCommandExecutor,
    timeout: number,
  ): Promise<DebugEvent | null> {
    if (!this.idSizes) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "ID sizes not available",
      );
    }
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Read packet
      const reply = await this.readReply();

      // Check if this is an event packet (command set 64)
      if (reply.data.length > 0) {
        const evt = event.parseEvent(reply.data, this.idSizes);
        if (evt) {
          return evt;
        }
      }
    }

    return null;
  }

  private parseLocation(location: string): {
    className: string;
    methodName: string;
    lineNumber: number;
  } {
    // Parse location format: "ClassName.methodName:lineNumber"
    const lastDot = location.lastIndexOf(".");
    const lastColon = location.lastIndexOf(":");

    if (lastDot === -1 || lastColon === -1 || lastColon <= lastDot) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Invalid location format: ${location}. Expected: ClassName.methodName:lineNumber`,
      );
    }

    const className = location.substring(0, lastDot);
    const methodName = location.substring(lastDot + 1, lastColon);
    const lineNumber = parseInt(location.substring(lastColon + 1), 10);

    if (isNaN(lineNumber)) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Invalid line number: ${location.substring(lastColon + 1)}`,
      );
    }

    return { className, methodName, lineNumber };
  }

  private getThreadStateString(state: number): string {
    switch (state) {
      case 1:
        return "zombie";
      case 2:
        return "running";
      case 3:
        return "sleeping";
      case 4:
        return "waiting-for-monitor";
      case 5:
        return "waiting";
      case 6:
        return "not-started";
      case 7:
        return "started";
      default:
        return `unknown(${state})`;
    }
  }

  private isPrimitiveTag(tag: number): boolean {
    return (
      tag === 0x42 || // B - byte
      tag === 0x43 || // C - char
      tag === 0x44 || // D - double
      tag === 0x46 || // F - float
      tag === 0x49 || // I - int
      tag === 0x4a || // J - long
      tag === 0x53 || // S - short
      tag === 0x5a // Z - boolean
    );
  }
}
