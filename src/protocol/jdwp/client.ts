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
  EventType,
} from "./protocol/index.js";
import * as vm from "./vm.js";
import * as referenceType from "./reference-type.js";
import * as method from "./method.js";
import * as thread from "./thread.js";
import * as stackFrame from "./stack-frame.js";
import * as objectReference from "./object-reference.js";
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

          // Get ID sizes - use a temporary executor since we don't have idSizes yet
          const executor: vm.JDWPCommandExecutor = {
            sendPacket: (packet) => this.sendPacket(packet),
            readReply: () => this.readReply(),
            idSizes: {
              fieldIDSize: 8,
              methodIDSize: 8,
              objectIDSize: 8,
              referenceTypeIDSize: 8,
              frameIDSize: 8,
            },
          };
          this.idSizes = await vm.getIDSizes(executor);

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
    this.connected = false;
    this.socket = null;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        // Force destroy if timeout
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

  /**
   * Get all threads
   * @param options.keepSuspended - If true, keep VM suspended after getting threads (default: false)
   * @param options.autoSuspend - If true, automatically suspend VM before getting threads (default: true)
   */
  async threads(options?: { keepSuspended?: boolean; autoSuspend?: boolean }): Promise<ThreadInfo[]> {
    const keepSuspended = options?.keepSuspended ?? false;
    const autoSuspend = options?.autoSuspend ?? true;
    return this.executeCommand(async (executor) => {
      // Suspend VM to get consistent thread info (if autoSuspend is true)
      if (autoSuspend) {
        await vm.suspendVM(executor);
      }

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
        // Resume VM only if we auto-suspended and not keeping suspended
        if (autoSuspend && !keepSuspended) {
          await vm.resumeVM(executor);
        }
      }
    });
  }

  /**
   * Get stack frames for a thread
   * @param threadId - Thread ID
   * @param options.autoSuspend - If true, automatically suspend thread if not suspended (default: false)
   */
  async stack(threadId: string, options?: { autoSuspend?: boolean }): Promise<StackFrame[]> {
    const autoSuspend = options?.autoSuspend ?? false;
    return this.executeCommand(async (executor) => {
      // Check if thread is suspended before getting stack
      const { suspendStatus } = await thread.getThreadStatus(executor, threadId);
      const wasSuspended = suspendStatus > 0;

      if (!wasSuspended) {
        if (autoSuspend) {
          await thread.suspendThread(executor, threadId);
        } else {
          throw new APIError(
            ErrorType.CommandError,
            ErrorCodes.ThreadNotSuspended,
            `Thread ${threadId} is not suspended. Use 'suspend' command first or set autoSuspend option.`,
          );
        }
      }

      try {
        return thread.getThreadStack(executor, threadId);
      } finally {
        // Resume thread if we auto-suspended it
        if (!wasSuspended && autoSuspend) {
          await thread.resumeThread(executor, threadId);
        }
      }
    });
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
      await this.waitForEventInternal(executor, this.config.timeout);

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
      await this.waitForEventInternal(executor, this.config.timeout);

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
      await this.waitForEventInternal(executor, this.config.timeout);

      // Clear event request
      await event.clearBreakpointRequest(executor, requestID);
    });
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(
    location: string,
    condition?: string,
    type?: 'line' | 'method-entry' | 'method-exit' | 'exception' | 'field-access' | 'field-modify' | 'class-load' | 'class-unload' | 'thread-start' | 'thread-death',
  ): Promise<string> {
    const breakpointType = type ?? 'line';

    // Handle method entry/exit breakpoints
    if (breakpointType === 'method-entry' || breakpointType === 'method-exit') {
      return this.setMethodBreakpoint(location, breakpointType, condition);
    }

    // Handle exception breakpoints
    if (breakpointType === 'exception') {
      return this.setExceptionBreakpoint(location, condition);
    }

    // Handle field breakpoints
    if (breakpointType === 'field-access' || breakpointType === 'field-modify') {
      return this.setFieldBreakpoint(location, breakpointType);
    }

    // Handle class load/unload breakpoints
    if (breakpointType === 'class-load' || breakpointType === 'class-unload') {
      return this.setClassBreakpoint(location, breakpointType);
    }

    // Handle thread start/death breakpoints
    if (breakpointType === 'thread-start' || breakpointType === 'thread-death') {
      return this.setThreadBreakpoint(location, breakpointType);
    }

    // Handle line breakpoints (existing logic)
    return this.setLineBreakpoint(location, condition);
  }

  private async setLineBreakpoint(location: string, _condition?: string): Promise<string> {
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

  private async setMethodBreakpoint(location: string, type: 'method-entry' | 'method-exit', _condition?: string): Promise<string> {
    return this.executeCommand(async (executor) => {
      const { className, methodName } = this.parseMethodLocation(location);

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

      // Set method entry/exit request
      const eventType = type === 'method-entry' ? EventType.MethodEntry : EventType.MethodExit;
      const requestID = await event.setMethodRequest(
        executor,
        eventType,
        classInfo.refID,
        targetMethod.methodID,
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

  private async setExceptionBreakpoint(
    exceptionClassName: string,
    _condition?: string,
  ): Promise<string> {
    return this.executeCommand(async (executor) => {
      // Handle '*' as all exceptions (null referenceTypeID)
      let exceptionRefTypeID: string | null = null;

      if (exceptionClassName !== '*') {
        // Find exception class by name
        const classInfo = await vm.classByName(executor, exceptionClassName);
        if (!classInfo) {
          throw new APIError(
            ErrorType.CommandError,
            ErrorCodes.ResourceNotFound,
            `Exception class not found: ${exceptionClassName}`,
          );
        }
        exceptionRefTypeID = classInfo.refID;
      }

      // Set exception request (caught and uncaught)
      const requestID = await event.setExceptionRequest(
        executor,
        exceptionRefTypeID,
        true,  // caught
        true,  // uncaught
        SuspendPolicy.All,
      );

      const bpID = `bp_${this.breakpointMap.size + 1}`;
      this.breakpointMap.set(bpID, {
        id: bpID,
        requestID,
        location: exceptionClassName,
        enabled: true,
        hitCount: 0,
      });

      return bpID;
    });
  }

  private async setFieldBreakpoint(
    fieldLocation: string,
    type: 'field-access' | 'field-modify',
  ): Promise<string> {
    return this.executeCommand(async (executor) => {
      // Parse field location format: "ClassName.fieldName"
      const lastDot = fieldLocation.lastIndexOf('.');
      if (lastDot === -1) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid field location format: ${fieldLocation}. Expected: ClassName.fieldName`,
        );
      }

      const className = fieldLocation.substring(0, lastDot);
      const fieldName = fieldLocation.substring(lastDot + 1);

      // Find class
      const classInfo = await vm.classByName(executor, className);
      if (!classInfo) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Class not found: ${className}`,
        );
      }

      // Get fields
      const fields = await referenceType.getFields(executor, classInfo.refID);
      const targetField = fields.find((f) => f.name === fieldName);
      if (!targetField) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Field not found: ${fieldName}`,
        );
      }

      // Set field request
      const eventType = type === 'field-access' ? EventType.FieldAccess : EventType.FieldModification;
      const requestID = await event.setFieldRequest(
        executor,
        eventType,
        classInfo.refID,
        targetField.fieldID,
        SuspendPolicy.EventThread,
      );

      const bpID = `bp_${this.breakpointMap.size + 1}`;
      this.breakpointMap.set(bpID, {
        id: bpID,
        requestID,
        location: fieldLocation,
        enabled: true,
        hitCount: 0,
      });

      return bpID;
    });
  }

  private async setClassBreakpoint(
    classPattern: string,
    type: 'class-load' | 'class-unload',
  ): Promise<string> {
    return this.executeCommand(async (executor) => {
      // Set class request
      const eventType = type === 'class-load' ? EventType.ClassLoad : EventType.ClassUnload;
      const requestID = await event.setClassRequest(
        executor,
        eventType,
        classPattern,
        SuspendPolicy.EventThread,
      );

      const bpID = `bp_${this.breakpointMap.size + 1}`;
      this.breakpointMap.set(bpID, {
        id: bpID,
        requestID,
        location: classPattern,
        enabled: true,
        hitCount: 0,
      });

      return bpID;
    });
  }

  private async setThreadBreakpoint(
    threadID: string,
    type: 'thread-start' | 'thread-death',
  ): Promise<string> {
    return this.executeCommand(async (executor) => {
      // Set thread request
      const eventType = type === 'thread-start' ? EventType.ThreadStart : EventType.ThreadDeath;
      const requestID = await event.setThreadRequest(
        executor,
        eventType,
        threadID,
        SuspendPolicy.EventThread,
      );

      const bpID = `bp_${this.breakpointMap.size + 1}`;
      this.breakpointMap.set(bpID, {
        id: bpID,
        requestID,
        location: threadID,
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
      // Check if thread is suspended before getting locals
      const { suspendStatus } = await thread.getThreadStatus(executor, threadId);
      if (suspendStatus === 0) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ThreadNotSuspended,
          `Thread ${threadId} is not suspended. Use 'suspend' command first.`,
        );
      }

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

      const firstFrame = frames[0];
      if (!firstFrame) {
        return [];
      }

      // Get variable table from method to get proper variable names
      const varTable = await method.getVariableTable(
        executor,
        firstFrame.location,
        firstFrame.method,
      );

      // Get frame values
      const slotCount = varTable.length > 0 ? varTable.length : 10;
      const rawVars = await stackFrame.getStackFrameValues(
        executor,
        threadId,
        firstFrame.frameID,
        slotCount,
      );

      // Map slot index to variable name from variable table
      const varMap = new Map<number, Variable>();
      for (const varInfo of varTable) {
        const rawVar = rawVars[varInfo.slot];
        if (rawVar) {
          varMap.set(varInfo.slot, {
            name: varInfo.name,
            type: varInfo.signature,
            value: rawVar.value,
            isPrimitive: rawVar.isPrimitive,
            isNull: rawVar.isNull,
          });
        }
      }

      // Include any variables not in the variable table (e.g., compiler-generated)
      for (let i = 0; i < rawVars.length; i++) {
        if (!varMap.has(i)) {
          const rawVar = rawVars[i];
          if (rawVar) {
            varMap.set(i, rawVar);
          }
        }
      }

      return Array.from(varMap.values());
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

  async setField(objectId: string, fieldId: string, value: unknown): Promise<void> {
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

      const objectID = parts[1];
      if (!objectID) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid object ID: ${objectId}`,
        );
      }

      // Get object reference type to determine if static field
      const { refTypeID } = await objectReference.getReferenceType(
        executor,
        objectID,
      );

      // Check if field is static by getting field info
      const fields = await referenceType.getFields(executor, refTypeID);
      const targetField = fields.find((f) => f.fieldID === fieldId);
      
      if (!targetField) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Field not found: ${fieldId}`,
        );
      }

      // Check if field is static (modifier bit 0x0008)
      const isStatic = (targetField.modifiers & 0x0008) !== 0;

      if (isStatic) {
        // For static fields, use ReferenceType.SetValues
        await referenceType.setStaticFieldValue(
          executor,
          refTypeID,
          fieldId,
          value,
        );
      } else {
        // For instance fields, use ObjectReference.SetValues
        await objectReference.setInstanceFieldValue(
          executor,
          objectID,
          fieldId,
          value,
        );
      }
    });
  }

  // ==================== Event Handling ====================

  async waitForEvent(timeout?: number): Promise<DebugEvent | null> {
    return this.executeCommand((executor) =>
      this.waitForEventInternal(executor, timeout ?? this.config.timeout),
    );
  }

  // ==================== Private Methods ====================

  private async executeCommand<T>(
    fn: (executor: vm.JDWPCommandExecutor) => Promise<T>,
  ): Promise<T> {
    if (!this.socket || !this.idSizes) {
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

        // Process all complete packets in buffer
        while (this.packetBuffer.length >= 4) {
          const length = this.packetBuffer.readUInt32BE(0);

          // Check if we have complete packet
          if (this.packetBuffer.length < length) {
            break;
          }

          const packetData = this.packetBuffer.subarray(4, length);
          this.packetBuffer = this.packetBuffer.subarray(length);

          // Check if this is a reply packet (flag = 0x80) or command packet (flag = 0)
          const flags = packetData[4];

          if (flags === 0x80) {
            // This is a reply packet
            clearTimeout(timeoutId);
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            socket.removeListener("close", onClose);

            try {
              const reply = decodeReplyPacket(packetData);
              resolve({
                errorCode: reply.errorCode,
                message: reply.message,
                data: reply.data,
              });
              return;
            } catch (err) {
              reject(err);
              return;
            }
          } else {
            // This is a command packet (event from JVM) - skip it
            // Events are handled separately via waitForEvent
            continue;
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
      // Calculate remaining time for this iteration
      const remainingTime = timeout - (Date.now() - startTime);
      if (remainingTime <= 0) {
        break;
      }

      // Read packet with remaining time as timeout
      try {
        // Temporarily override timeout for readReply
        const originalTimeout = this.config.timeout;
        this.config.timeout = Math.min(remainingTime, originalTimeout);

        const reply = await this.readReply();

        // Restore original timeout
        this.config.timeout = originalTimeout;

        // Check if this is an event packet (command set 64)
        if (reply.data.length > 0) {
          const evt = event.parseEvent(reply.data, this.idSizes);
          if (evt) {
            return evt;
          }
        }
      } catch (err) {
        // If timeout, just return null
        if (err instanceof APIError && err.code === ErrorCodes.Timeout) {
          return null;
        }
        throw err;
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

  private parseMethodLocation(location: string): {
    className: string;
    methodName: string;
  } {
    // Parse location format: "ClassName.methodName" for method breakpoints
    const lastDot = location.lastIndexOf(".");

    if (lastDot === -1) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Invalid method location format: ${location}. Expected: ClassName.methodName`,
      );
    }

    const className = location.substring(0, lastDot);
    const methodName = location.substring(lastDot + 1);

    if (!methodName || methodName.includes(":")) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Invalid method name in: ${location}`,
      );
    }

    return { className, methodName };
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
