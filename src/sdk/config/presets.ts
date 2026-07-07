/**
 * Configuration Presets
 *
 * Pre-built configuration templates for common debugging scenarios.
 */

import type { DebugConfig } from "../../types/config.js";

/**
 * Pre-configured protocol presets.
 *
 * Each preset provides sensible defaults for a specific debug protocol.
 * Ports and hosts can be overridden.
 */
export const Presets = {
  /** JDWP (Java Debug Wire Protocol) — default port 5005 */
  jdwp(port = 5005, host = "127.0.0.1"): DebugConfig {
    return { protocol: "jdwp", host, port, timeout: 30000 };
  },

  /** Delve (Go debugger) — default port 2345 */
  dlv(port = 2345, host = "127.0.0.1"): DebugConfig {
    return { protocol: "dlv", host, port, timeout: 30000 };
  },

  /** LLDB (C/C++/Rust) — default port 12345 */
  lldb(port = 12345, host = "127.0.0.1"): DebugConfig {
    return { protocol: "lldb", host, port, timeout: 30000 };
  },

  /** DebugPy (Python) — default port 5678 */
  debugpy(port = 5678, host = "127.0.0.1"): DebugConfig {
    return { protocol: "debugpy", host, port, timeout: 30000 };
  },

  /** js-debug (JavaScript/TypeScript) — default port 9229 */
  jsDebug(port = 9229, host = "127.0.0.1"): DebugConfig {
    return { protocol: "js-debug", host, port, timeout: 30000 };
  },
} as const;