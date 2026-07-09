/**
 * JDWP Client Implementation
 * Implements DebugProtocol interface for Java Debug Wire Protocol
 */

import * as net from "node:net";
import type { DebugProtocol } from "../base.js";
import type { DebugConfig } from "../../types/config.js";
import type { EvalOptions, EvalResult, ExtendedBreakpointInfo, TypeInfo, SymbolInfo, TargetMetadata, ThreadBatchInfo, ExpandedVariable, FieldInfo, FeatureName, ExtendedDebugProtocol } from "../extended.js";
import { DebugConfigSchema } from "../../types/config.js";
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
export class JDWPClient implements DebugProtocol, ExtendedDebugProtocol {
  private config: DebugConfig;
  private socket: net.Socket | null = null;
  private connected = false;
  private idSizes: IDSizes | null = null;
  private breakpointMap: Map<string, InternalBreakpointInfo> = new Map();
  /** Stores breakpoint creation parameters for enable/disable via remove+recreate */
  private breakpointParams: Map<string, { type: string; location: string; condition?: string; params: Record<string, unknown> }> = new Map();
  private packetBuffer: Buffer = Buffer.alloc(0);

  constructor(config: DebugConfig) {
    // Validate configuration
    this.config = DebugConfigSchema.parse(config);
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
            { host: this.config.host, port: this.config.port, phase: "connection" },
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
            { host: this.config.host, port: this.config.port, timeout: this.config.timeout, phase: "connection" },
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
              { host: this.config.host, port: this.config.port, phase: "connection" },
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
          this.connected = false;
          this.socket = null;
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
            ErrorType.InputError,
            ErrorCodes.ThreadNotSuspended,
            `Thread ${threadId} is not suspended. Use 'suspend' command first or set autoSuspend option.`,
            { threadId },
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
          { className, location },
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
          { className, methodName, location },
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
          { className, methodName, lineNumber, location },
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
      this.breakpointParams.set(bpID, {
        type: "line",
        location,
        params: { classInfo: { refID: classInfo.refID }, targetMethod: { methodID: targetMethod.methodID }, lineLocation: { lineCodeIndex: lineLocation.lineCodeIndex }, condition: _condition ?? null },
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
          { className, location },
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
          { className, methodName, location },
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
      this.breakpointParams.set(bpID, {
        type,
        location,
        params: { classInfo: { refID: classInfo.refID }, targetMethod: { methodID: targetMethod.methodID } },
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
            { exceptionClassName },
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
      this.breakpointParams.set(bpID, {
        type: "exception",
        location: exceptionClassName,
        params: { exceptionRefTypeID },
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
          { fieldLocation, expectedFormat: "ClassName.fieldName" },
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
          { className, fieldLocation },
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
          { className, fieldName, fieldLocation },
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
      this.breakpointParams.set(bpID, {
        type: `field-${type}`,
        location: fieldLocation,
        params: { className, fieldName },
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
      this.breakpointParams.set(bpID, {
        type,
        location: classPattern,
        params: { classPattern },
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
      this.breakpointParams.set(bpID, {
        type,
        location: threadID,
        params: { threadID },
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
    this.breakpointParams.delete(id);
  }

  async clearBreakpoints(): Promise<void> {
    await this.executeCommand((executor) =>
      event.clearAllBreakpoints(executor),
    );
    this.breakpointMap.clear();
    this.breakpointParams.clear();
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
          ErrorType.InputError,
          ErrorCodes.ThreadNotSuspended,
          `Thread ${threadId} is not suspended. Use 'suspend' command first.`,
          { threadId },
        );
      }

      // Get frame count
      const frameCount = await thread.getThreadFrameCount(executor, threadId);
      if (frameIndex >= frameCount) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid frame index: ${frameIndex}`,
          { threadId, frameIndex, frameCount },
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
          { objectId, expectedFormat: "tag:id" },
        );
      }

      const refTypeID = parts[1];
      if (!refTypeID) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid object ID: ${objectId}`,
          { objectId },
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

  // ==================== Variable Expansion ====================

  async expandVariable(objectId: string, depth: number = 1): Promise<ExpandedVariable[]> {
    return this.executeCommand((executor) =>
      this.expandVariableRecursive(executor, objectId, depth),
    );
  }

  /**
   * Recursively expand variable fields using the JDWP executor
   */
  private async expandVariableRecursive(
    executor: vm.JDWPCommandExecutor,
    objectId: string,
    depth: number,
  ): Promise<ExpandedVariable[]> {
    const parts = objectId.split(":");
    if (parts.length !== 2) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidObjectId,
        `Invalid object ID: ${objectId}`,
        { objectId, expectedFormat: "tag:id" },
      );
    }

    const refTypeID = parts[1]!;
    const fields = await referenceType.getFields(executor, refTypeID);
    if (fields.length === 0) {
      return [];
    }

    const fieldIDs = fields.map((f) => f.fieldID);
    const { tags, values } = await referenceType.getValuesWithTags(
      executor,
      refTypeID,
      fieldIDs,
    );

    const result: ExpandedVariable[] = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!;
      const tag = tags[i] ?? 0;
      const value = values[i];
      const isPrimitive = this.isPrimitiveTag(tag);
      const isNull = value === null || value === undefined;

      const entry: ExpandedVariable = {
        name: field.name,
        type: this.jdwpSignatureToType(field.signature),
        value,
        isPrimitive,
        isNull,
      };

      // For non-primitive, non-null fields, attach objectId for further expansion
      if (!isPrimitive && !isNull) {
        const childObjectId = `${tag}:${value}`;
        entry.objectId = childObjectId;
        if (depth > 1) {
          entry.children = await this.expandVariableRecursive(executor, childObjectId, depth - 1);
        }
      }

      result.push(entry);
    }

    return result;
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
          { objectId, expectedFormat: "tag:id" },
        );
      }

      const objectID = parts[1];
      if (!objectID) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid object ID: ${objectId}`,
          { objectId },
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
          { objectId, fieldId },
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
        { host: this.config.host, port: this.config.port, connected: this.connected, hasSocket: !!this.socket, hasIDSizes: !!this.idSizes },
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
        { host: this.config.host, port: this.config.port, phase: "send" },
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
              { host: this.config.host, port: this.config.port, packetLength: packet.length, phase: "send" },
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
        { host: this.config.host, port: this.config.port, phase: "read" },
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
            { host: this.config.host, port: this.config.port, timeout: this.config.timeout, phase: "read" },
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
            { host: this.config.host, port: this.config.port, phase: "read" },
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
            { host: this.config.host, port: this.config.port, phase: "read" },
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
        { host: this.config.host, port: this.config.port },
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
        { location, expectedFormat: "ClassName.methodName:lineNumber" },
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
        { location, lineNumber: location.substring(lastColon + 1) },
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
        { location, expectedFormat: "ClassName.methodName" },
      );
    }

    const className = location.substring(0, lastDot);
    const methodName = location.substring(lastDot + 1);

    if (!methodName || methodName.includes(":")) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Invalid method name in: ${location}`,
        { location, methodName },
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

  // ==================== Extended Interface ====================

  async eval(expression: string, threadId: string, frameIndex: number, _options?: EvalOptions): Promise<EvalResult> {
    return this.executeCommand(async (executor) => {
      // Check if thread is suspended
      const { suspendStatus } = await thread.getThreadStatus(executor, threadId);
      if (suspendStatus === 0) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.ThreadNotSuspended,
          `Thread ${threadId} is not suspended. Suspend the thread before evaluation.`,
          { threadId },
        );
      }

      // Get frame count and frames
      const frameCount = await thread.getThreadFrameCount(executor, threadId);
      if (frameIndex >= frameCount) {
        throw new APIError(
          ErrorType.InputError,
          ErrorCodes.InvalidInput,
          `Invalid frame index: ${frameIndex}`,
          { threadId, frameIndex, frameCount },
        );
      }

      const frames = await thread.getThreadFrames(executor, threadId, frameIndex, 1);
      if (frames.length === 0 || !frames[0]) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          "No stack frame found",
          { threadId, frameIndex },
        );
      }

      const firstFrame = frames[0];

      // Check if expression contains parentheses (method call)
      if (expression.includes("(")) {
        return this.evalMethodCall(executor, threadId, firstFrame, expression);
      }

      // Check if expression contains dot (field access)
      if (expression.includes(".")) {
        return this.evalFieldAccess(executor, threadId, firstFrame, expression);
      }

      // Simple variable lookup in locals
      return this.evalVariable(executor, threadId, firstFrame, expression);
    });
  }

  /**
   * Evaluate a simple variable name by looking up in the current frame's locals
   */
  private async evalVariable(
    executor: vm.JDWPCommandExecutor,
    threadId: string,
    frame: { frameID: string; location: string; method: string },
    variableName: string,
  ): Promise<EvalResult> {
    // Try to get variable table for proper names
    try {
      const varTable = await method.getVariableTable(executor, frame.location, frame.method);

      // Find the variable by name
      const varInfo = varTable.find((v) => v.name === variableName);
      if (varInfo) {
        const rawVars = await stackFrame.getStackFrameValues(executor, threadId, frame.frameID, 10);
        const rawVar = rawVars[varInfo.slot];
        if (rawVar) {
          return {
            value: rawVar.value,
            type: this.jdwpSignatureToType(rawVar.type),
            error: undefined,
          };
        }
      }
    } catch {
      // Fall through to generic approach
    }

    // Fallback: get all frame values and find by name index
    const rawVars = await stackFrame.getStackFrameValues(executor, threadId, frame.frameID, 20);
    for (const v of rawVars) {
      if (v.name === variableName || v.name === `var_0`) {
        return {
          value: v.value,
          type: this.jdwpSignatureToType(v.type),
          error: undefined,
        };
      }
    }

    throw new APIError(
      ErrorType.CommandError,
      ErrorCodes.ResourceNotFound,
      `Variable '${variableName}' not found in current frame`,
      { threadId, variableName },
    );
  }

  /**
   * Evaluate a field access expression like "this.fieldName" or "object.fieldName"
   */
  private async evalFieldAccess(
    executor: vm.JDWPCommandExecutor,
    threadId: string,
    frame: { frameID: string; location: string; method: string },
    expression: string,
  ): Promise<EvalResult> {
    const parts = expression.split(".");
    const objectExpr = parts[0];
    const fieldName = parts.slice(1).join(".");

    // Get "this" object from the frame
    const { objectID } = await stackFrame.getThisObject(executor, threadId, frame.frameID);
    if (!objectID) {
      throw new APIError(
        ErrorType.CommandError,
        ErrorCodes.ResourceNotFound,
        "Cannot evaluate field access without 'this' reference",
        { expression },
      );
    }

    // Get the reference type of the object
    const { refTypeID } = await objectReference.getReferenceType(executor, objectID);

    // Get fields of the class
    const fields = await referenceType.getFields(executor, refTypeID);
    const targetField = fields.find((f) => f.name === fieldName);

    if (!targetField) {
      throw new APIError(
        ErrorType.CommandError,
        ErrorCodes.ResourceNotFound,
        `Field '${fieldName}' not found`,
        { expression, objectExpr, fieldName },
      );
    }

    // Get field value
    const values = await objectReference.getInstanceFieldValues(executor, objectID, [targetField.fieldID]);
    const value = values[0];

    return {
      value,
      type: this.jdwpSignatureToType(targetField.signature),
      error: undefined,
    };
  }

  /**
   * Evaluate a method call expression
   */
  private async evalMethodCall(
    executor: vm.JDWPCommandExecutor,
    threadId: string,
    frame: { frameID: string; location: string; method: string },
    expression: string,
  ): Promise<EvalResult> {
    // Parse method call: methodName(args) or object.methodName(args)
    const parenIndex = expression.indexOf("(");
    const methodCallEnd = expression.lastIndexOf(")");

    if (parenIndex === -1 || methodCallEnd === -1) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Invalid method call expression: ${expression}`,
        { expression },
      );
    }

    const methodNamePortion = expression.substring(0, parenIndex).trim();
    const argsStr = expression.substring(parenIndex + 1, methodCallEnd).trim();
    const args = argsStr ? argsStr.split(",").map((a) => a.trim()) : [];

    // Get "this" object
    const { objectID } = await stackFrame.getThisObject(executor, threadId, frame.frameID);
    if (!objectID) {
      throw new APIError(
        ErrorType.CommandError,
        ErrorCodes.ResourceNotFound,
        "Cannot evaluate method call without 'this' reference",
        { expression },
      );
    }

    // Get the reference type and find the method
    const { refTypeID } = await objectReference.getReferenceType(executor, objectID);
    const methods = await referenceType.getMethods(executor, refTypeID);

    const targetMethod = methods.find((m) => m.name === methodNamePortion);
    if (!targetMethod) {
      throw new APIError(
        ErrorType.CommandError,
        ErrorCodes.ResourceNotFound,
        `Method '${methodNamePortion}' not found`,
        { expression, methodName: methodNamePortion },
      );
    }

    // Invoke the method
    const { returnValue, exception } = await objectReference.invokeInstanceMethod(
      executor,
      objectID,
      threadId,
      targetMethod.methodID,
      args,
      0, // default invoke options
    );

    if (exception) {
      return {
        value: undefined,
        type: "object",
        error: `Method threw exception: ${exception}`,
      };
    }

    return {
      value: returnValue,
      type: typeof returnValue === "string" ? "string" : typeof returnValue,
      error: undefined,
    };
  }

  /**
   * Convert JDWP type signature to human-readable type name
   */
  private jdwpSignatureToType(signature: string): string {
    if (!signature || signature.length === 0) return "unknown";
    switch (signature[0]) {
      case "B": return "byte";
      case "C": return "char";
      case "D": return "double";
      case "F": return "float";
      case "I": return "int";
      case "J": return "long";
      case "L": {
        // Object type: "Ljava/lang/String;" -> "java.lang.String"
        const inner = signature.substring(1, signature.length - 1);
        return inner.replace(/\//g, ".");
      }
      case "S": return "short";
      case "Z": return "boolean";
      case "[": return `${this.jdwpSignatureToType(signature.substring(1))}[]`;
      default: return signature;
    }
  }

  async enableBreakpoint(id: string): Promise<void> {
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }
    if (bp.enabled) {
      return; // Already enabled
    }

    // Recreate the EventRequest using stored params
    await this.executeCommand(async (executor) => {
      const stored = this.breakpointParams.get(id);
      if (!stored) {
        throw new APIError(
          ErrorType.InternalError,
          ErrorCodes.InternalError,
          `Breakpoint ${id} params not found for re-creation`,
          { id },
        );
      }

      let newRequestID: number;

      switch (stored.type) {
        case "line": {
          const p = stored.params as Record<string, unknown>;
          const ci = p["classInfo"] as { refID: string };
          const tm = p["targetMethod"] as { methodID: string };
          const ll = p["lineLocation"] as { lineCodeIndex: bigint };
          newRequestID = await event.setBreakpointRequest(
            executor,
            ci.refID,
            tm.methodID,
            ll.lineCodeIndex,
            SuspendPolicy.EventThread,
          );
          break;
        }
        case "method-entry":
        case "method-exit": {
          const p = stored.params as Record<string, unknown>;
          const ci = p["classInfo"] as { refID: string };
          const tm = p["targetMethod"] as { methodID: string };
          const evtType = stored.type === "method-entry" ? EventType.MethodEntry : EventType.MethodExit;
          newRequestID = await event.setMethodRequest(
            executor,
            evtType,
            ci.refID,
            tm.methodID,
            SuspendPolicy.EventThread,
          );
          break;
        }
        case "exception": {
          const p = stored.params as { exceptionRefTypeID: string | null };
          newRequestID = await event.setExceptionRequest(
            executor,
            p.exceptionRefTypeID,
            true,
            true,
            SuspendPolicy.All,
          );
          break;
        }
        case "field-access":
        case "field-modify": {
          const p = stored.params as { className: string; fieldName: string };
          const evtType = stored.type === "field-access" ? EventType.FieldAccess : EventType.FieldModification;
          newRequestID = await event.setFieldRequest(
            executor,
            evtType,
            p.className,
            p.fieldName,
            SuspendPolicy.EventThread,
          );
          break;
        }
        case "class-load":
        case "class-unload": {
          const p = stored.params as { classPattern: string };
          const evtType = stored.type === "class-load" ? EventType.ClassLoad : EventType.ClassUnload;
          newRequestID = await event.setClassRequest(
            executor,
            evtType,
            p.classPattern,
            SuspendPolicy.EventThread,
          );
          break;
        }
        case "thread-start":
        case "thread-death": {
          const p = stored.params as { threadID: string };
          const evtType = stored.type === "thread-start" ? EventType.ThreadStart : EventType.ThreadDeath;
          newRequestID = await event.setThreadRequest(
            executor,
            evtType,
            p.threadID,
            SuspendPolicy.EventThread,
          );
          break;
        }
        default:
          throw new APIError(
            ErrorType.InternalError,
            ErrorCodes.InternalError,
            `Unknown breakpoint type: ${stored.type}`,
            { id, type: stored.type },
          );
      }

      bp.requestID = newRequestID;
      bp.enabled = true;
    });
  }

  async disableBreakpoint(id: string): Promise<void> {
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }
    if (!bp.enabled) {
      return; // Already disabled
    }

    await this.executeCommand(async (executor) => {
      await event.clearBreakpointRequest(executor, bp.requestID);
    });

    bp.enabled = false;
  }

  async getBreakpointInfo(id: string): Promise<ExtendedBreakpointInfo> {
    if (!this.isConnected()) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected",
      );
    }
    const bp = this.breakpointMap.get(id);
    if (!bp) {
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Breakpoint ${id} not found`,
        { id },
      );
    }

    return {
      id: id,
      location: bp.location,
      enabled: bp.enabled,
      hitCount: bp.hitCount || 0,
      ignoreCount: 0,
      condition: null,
    };
  }

  async getTypeInfo(typeName: string, includeFields?: boolean, _includeTemplateArgs?: boolean): Promise<TypeInfo> {
    return this.executeCommand(async (executor) => {
      // Convert type name to JDWP signature format if needed
      const signature = typeName.startsWith("L") && typeName.endsWith(";")
        ? typeName
        : `L${typeName.replace(/\./g, "/")};`;

      // Find class by signature
      const classInfo = await vm.classByName(executor, signature);
      if (!classInfo) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Type '${typeName}' not found`,
          { typeName },
        );
      }

      // Get class signature for human-readable name
      const classSignature = await referenceType.getSignature(executor, classInfo.refID);
      const readableName = classSignature
        ? classSignature.replace(/^L|;$/g, "").replace(/\//g, ".")
        : typeName;

      // Get fields for enum detection (always, even without includeFields)
      const rawFields = await referenceType.getFields(executor, classInfo.refID);

      // Detect enum type: Java compiler adds a synthetic $VALUES field to enum classes
      const isEnumeration = rawFields.some(f => f.name === "$VALUES" || f.name === "ENUM$VALUES");

      // Get fields for display if requested
      let fields: FieldInfo[] = [];
      if (includeFields) {
        fields = rawFields.map((f) => ({
          name: f.name,
          typeName: this.jdwpSignatureToType(f.signature),
          offset: 0,
          byteSize: 0,
          isStatic: (f.modifiers & 0x0008) !== 0,
        }));
      }

      return {
        name: readableName,
        byteSize: 0, // JDWP doesn't provide byte size directly
        isPointer: false,
        isArray: signature.startsWith("["),
        isStruct: false,
        isClass: !signature.startsWith("["),
        isUnion: false,
        isEnumeration,
        numTemplateArgs: 0,
        templateArgs: [],
        fields,
        baseClasses: [], // JDWP provides interfaces but not base classes through simple API
        enumValues: isEnumeration
          ? rawFields
              .filter(f => (f.modifiers & 0x0019) === 0x0019) // ACC_STATIC | ACC_FINAL | ACC_PUBLIC = enum constants
              .map(f => ({ name: f.name, value: BigInt(0) }))
          : [],
      };
    });
  }

  async getSymbol(threadId: string, frameIndex: number, symbolName?: string, fuzzyMatch?: boolean): Promise<SymbolInfo> {
    return this.executeCommand(async (executor) => {
      // Get the current frame's class context
      const frames = await thread.getThreadFrames(executor, threadId, frameIndex, 1);
      if (frames.length === 0 || !frames[0]) {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          "No stack frame found",
          { threadId, frameIndex },
        );
      }

      const frame = frames[0];

      // Get all loaded classes for fuzzy matching
      const allClasses = await vm.getAllClasses(executor);

      if (symbolName) {
        // Search for a specific class/symbol
        const targetSignature = symbolName.startsWith("L")
          ? symbolName
          : `L${symbolName.replace(/\./g, "/")};`;

        // Try to find the class
        const classInfo = await vm.classByName(executor, targetSignature);
        if (classInfo) {
          const signature = await referenceType.getSignature(executor, classInfo.refID);
          const readableName = signature
            ? signature.replace(/^L|;$/g, "").replace(/\//g, ".")
            : symbolName;

          return {
            name: readableName,
            type: "code",
            address: parseInt(classInfo.refID, 16) || 0,
            size: 0,
            module: "java",
          };
        }

        // Fuzzy match if enabled
        if (fuzzyMatch) {
          for (const cls of allClasses) {
            try {
              const sig = await referenceType.getSignature(executor, cls.refID);
              if (sig && sig.toLowerCase().includes(targetSignature.toLowerCase())) {
                const readableName = sig.replace(/^L|;$/g, "").replace(/\//g, ".");
                return {
                  name: readableName,
                  type: "code",
                  address: parseInt(cls.refID, 16) || 0,
                  size: 0,
                  module: "java",
                };
              }
            } catch {
              continue;
            }
          }
        }

        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          `Symbol '${symbolName}' not found`,
          { symbolName },
        );
      }

      // No symbol name: return info about the current class
      try {
        const signatures = await referenceType.getSignature(executor, frame!.location);
        const readableName = signatures
          ? signatures.replace(/^L|;$/g, "").replace(/\//g, ".")
          : `class_${frame!.location}`;

        return {
          name: readableName,
          type: "code",
          address: parseInt(frame!.location, 16) || 0,
          size: 0,
          module: "java",
        };
      } catch {
        throw new APIError(
          ErrorType.CommandError,
          ErrorCodes.ResourceNotFound,
          "Could not resolve symbol for current frame",
          { threadId, frameIndex },
        );
      }
    });
  }

  async getTargetMetadata(): Promise<TargetMetadata> {
    if (!this.isConnected()) {
      throw new APIError(
        ErrorType.ConnectionError,
        ErrorCodes.ConnectionClosed,
        "Not connected",
      );
    }

    return this.executeCommand(async (executor) => {
      // Get JVM version info for runtime details
      let runtimeVersion = "java";
      try {
        const versionInfo = await vm.getVersion(executor);
        runtimeVersion = versionInfo.runtimeVersion;
      } catch {
        // use default
      }

      // Count loaded classes
      let numClasses = 0;
      try {
        const allClasses = await vm.getAllClasses(executor);
        numClasses = allClasses.length;
      } catch {
        // use default
      }

      // Get class paths for module-like info
      let classpathCount = 0;
      try {
        const classPaths = await vm.getClassPaths(executor);
        classpathCount = classPaths.classpath.length + classPaths.bootClasspath.length;
      } catch {
        // use default
      }

      return {
        executable: runtimeVersion,
        triple: `java-${process.arch}`,
        numModules: classpathCount,
        numSections: numClasses,
        numSymbols: numClasses,
      };
    });
  }

  async getThreadBatchInfo(threadId: string): Promise<ThreadBatchInfo> {
    return this.executeCommand(async (executor) => {
      const frameCount = await thread.getThreadFrameCount(executor, threadId);
      if (frameCount === 0) {
        return {
          threadId,
          functions: [],
          files: [],
          lines: [],
          addresses: [],
          modules: [],
        };
      }

      const frames = await thread.getThreadFrames(executor, threadId, 0, frameCount);
      const functions: string[] = [];
      const files: string[] = [];
      const lines: number[] = [];
      const addresses: bigint[] = [];
      const modules: string[] = ["java"];

      for (const frame of frames) {
        // Resolve method name from methodID
        let methodName = frame.method;
        try {
          const sig = await referenceType.getSignature(executor, frame.location);
          const className = sig ? sig.replace(/^L|;$/g, "").replace(/\//g, ".") : frame.location;
          methodName = `${className}.${frame.method}`;
        } catch {
          // Use raw method ID as fallback
        }
        functions.push(methodName);

        // Resolve source file and line from location
        try {
          const sig = await referenceType.getSignature(executor, frame.location);
          const sourcePath = sig ? sig.replace(/^L|;$/g, "").replace(/\//g, "/") + ".java" : "unknown";
          files.push(sourcePath);
        } catch {
          files.push("unknown");
        }

        lines.push(0); // Line number not directly available from frame info
        addresses.push(BigInt(0));
      }

      return {
        threadId,
        functions,
        files,
        lines,
        addresses,
        modules,
      };
    });
  }

  supportsFeature(feature: FeatureName): boolean {
    switch (feature) {
      case "eval":
        return true;
      case "enableDisableBreakpoint":
        return true;
      case "extendedBreakpointInfo":
        return true;
      case "targetMetadata":
        return true;
      case "typeInfo":
        return true;
      case "symbolInfo":
        return true;
      case "expandVariable":
        return true;
      case "threadBatchInfo":
        return true;
      default:
        return false;
    }
  }
}
