/**
 * Protocol type definitions
 * Re-exports from the centralized types module
 */

// Re-export all debug types
export type {
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from '../types/debug.js';

// Re-export all metadata types
export type {
  VersionInfo,
  Capabilities,
} from '../types/metadata.js';

// Re-export config types
export type {
  DebugConfig,
} from '../types/config.js';
