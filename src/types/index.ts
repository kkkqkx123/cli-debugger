/**
 * Types module exports
 * Centralized type definitions for the CLI debugger
 */

// Debug types
export type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from './debug.js';

// Metadata types
export type {
  VersionInfo,
  Capabilities,
} from './metadata.js';

// Config types and schemas
export type {
  DebugConfig,
  OutputConfig,
  MonitorConfig,
  AppConfig,
  Profile,
  GlobalConfig,
} from './config.js';

export {
  DebugConfigSchema,
  OutputConfigSchema,
  MonitorConfigSchema,
  AppConfigSchema,
  ProfileSchema,
  GlobalConfigSchema,
  createDefaultConfig,
} from './config.js';
