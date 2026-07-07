/**
 * CLI Debugger - Main entry point
 *
 * A multi-language debugging CLI client with plugin-based architecture
 */

// Export all types
export * from "./types/index.js";

// Export protocol API
export * from "./protocol/index.js";

// Export session manager
export { SessionManager } from "./session/manager.js";
export type { SessionInfo, AutoContext, OutputMode } from "./session/manager.js";

// Export CLI entry
export { runCli } from "./cli/index.js";
