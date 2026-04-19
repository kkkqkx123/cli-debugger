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

// Auto-register protocols
import { registerProtocol } from "./client.js";
import { JDWPClient } from "./jdwp/client.js";
import { DlvClient } from "./dlv/client.js";

registerProtocol("jdwp", (config) => new JDWPClient(config));
registerProtocol("dlv", (config) => new DlvClient(config));
