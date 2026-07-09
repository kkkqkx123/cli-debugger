/**
 * Protocol module exports
 */

// Re-export types from centralized types module
export type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from "../types/debug.js";

export type { VersionInfo, Capabilities } from "../types/metadata.js";

export type { DebugConfig } from "../types/config.js";

// Protocol interface and factory
export type { DebugProtocol, ProtocolFactory } from "./base.js";

// Errors
export {
  ErrorType,
  ErrorCodes,
  APIError,
  connectionError,
  protocolError,
  commandError,
  inputError,
  internalError,
} from "./errors.js";

// Client factory and registry
export {
  registerProtocol,
  unregisterProtocol,
  createClient,
  createClientWithoutConnect,
  getRegisteredProtocols,
  hasProtocol,
  getProtocolFactory,
  clearRegistry,
} from "./client.js";

// JDWP protocol implementation
export { JDWPClient } from "./jdwp/client.js";
export * as jdwp from "./jdwp/index.js";

// Delve protocol implementation
export { DlvClient } from "./dlv/client.js";
export * as dlv from "./dlv/index.js";

// LLDB protocol implementation
export { LLDBClient } from "./lldb/client.js";
export * as lldb from "./lldb/index.js";

// py-debug (Python) protocol implementation
export { DebugPyClient } from "./py-debug/client.js";
export * as pydebug from "./py-debug/index.js";

// js-debug (JavaScript/TypeScript) protocol implementation
export { JsDebugClient } from "./js-debug/client.js";
export * as jsdebug from "./js-debug/index.js";

// Auto-register protocols
import { registerProtocol } from "./client.js";
import { JDWPClient } from "./jdwp/client.js";
import { DlvClient } from "./dlv/client.js";
import { LLDBClient } from "./lldb/client.js";
import { DebugPyClient } from "./py-debug/client.js";
import { JsDebugClient } from "./js-debug/client.js";

registerProtocol("jdwp", (config) => new JDWPClient(config));
registerProtocol("dlv", (config) => new DlvClient(config));
registerProtocol("lldb", (config) => new LLDBClient(config));
registerProtocol("debugpy", (config) => new DebugPyClient(config));
registerProtocol("js-debug", (config) => new JsDebugClient(config));
