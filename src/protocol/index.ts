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
} from '../types/debug.js';

export type {
  VersionInfo,
  Capabilities,
} from '../types/metadata.js';

export type {
  DebugConfig,
} from '../types/config.js';

// Protocol interface and factory
export type { DebugProtocol, ProtocolFactory } from './base.js';

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
} from './errors.js';

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
} from './client.js';
