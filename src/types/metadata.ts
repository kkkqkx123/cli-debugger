/**
 * Metadata type definitions
 * Types for protocol version and capabilities
 */

/** Version information */
export interface VersionInfo {
  protocolVersion: string;
  runtimeVersion: string;
  runtimeName: string;
  description: string;
}

/** Plugin capabilities statement */
export interface Capabilities {
  supportsVersion: boolean;
  supportsThreads: boolean;
  supportsStack: boolean;
  supportsLocals: boolean;
  supportsBreakpoints: boolean;
  supportsSuspend: boolean;
  supportsResume: boolean;
  supportsStep: boolean;
  supportsCont: boolean;
  supportsNext: boolean;
  supportsFinish: boolean;
  supportsEvents: boolean;
  supportsWatchMode: boolean;
  supportsStreaming: boolean;
}
