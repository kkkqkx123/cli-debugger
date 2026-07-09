/**
 * Configuration Presets
 *
 * Pre-built configuration templates for common debugging scenarios.
 */

import type { DebugConfig } from "../../types/config.js";

/**
 * Auto-detect the debug protocol from a file path.
 *
 * Maps file extensions to debug protocols:
 * - `.go` → `dlv`
 * - `.java`/`.class`/`.jar` → `jdwp`
 * - `.py` → `py-debug`
 * - `.js`/`.ts`/`.mjs`/`.cjs`/`.mts`/`.cts` → `js-debug`
 * - Native binaries (no extension, `.out`, `.bin`, `.exe`, `.elf`) → `lldb`
 *
 * @param programPath - Path to the program/binary file
 * @returns Detected protocol name, or `undefined` if unknown
 *
 * @example
 * ```ts
 * detectProtocol("App.java")   // "jdwp"
 * detectProtocol("main.go")    // "dlv"
 * detectProtocol("script.py")  // "py-debug"
 * ```
 */
export function detectProtocol(programPath: string): string | undefined {
  const basename = programPath.split("/").pop()?.toLowerCase() ?? "";
  const dotIndex = basename.lastIndexOf(".");
  const ext = dotIndex >= 0 ? basename.slice(dotIndex + 1) : "";

  if (ext === "go" || basename.endsWith(".go")) return "dlv";
  if (ext === "java" || ext === "class" || ext === "jar") return "jdwp";
  if (ext === "py" || basename.endsWith(".py")) return "py-debug";
  if (ext === "js" || ext === "ts" || ext === "mjs" || ext === "cjs" || ext === "mts" || ext === "cts") return "js-debug";
  if (ext === "out" || ext === "bin" || ext === "exe" || ext === "elf") return "lldb";
  // No extension → likely a native binary
  if (ext === "" && basename.length > 0) return "lldb";
  return undefined;
}

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

  /** py-debug (Python) — default port 5678 */
  pyDebug(port = 5678, host = "127.0.0.1"): DebugConfig {
    return { protocol: "py-debug", host, port, timeout: 30000 };
  },

  /** js-debug (JavaScript/TypeScript) — default port 9229 */
  jsDebug(port = 9229, host = "127.0.0.1"): DebugConfig {
    return { protocol: "js-debug", host, port, timeout: 30000 };
  },
} as const;