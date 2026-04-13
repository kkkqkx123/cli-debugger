import process from "node:process";
import type { ProcessDiscoverer } from "./interface.js";

let discoverer: ProcessDiscoverer | null = null;

/**
 * Get platform-specific process discoverer
 */
export function getProcessDiscoverer(): ProcessDiscoverer {
  if (!discoverer) {
    const platform = process.platform;

    switch (platform) {
      case "win32":
        discoverer =
          new (require("./process-windows.js").WindowsProcessDiscoverer)();
        break;
      case "darwin":
      case "linux":
        discoverer = new (require("./process-unix.js").UnixProcessDiscoverer)();
        break;
      default:
        discoverer =
          new (require("./process-other.js").OtherProcessDiscoverer)();
        break;
    }
  }

  return discoverer!;
}

/**
 * Check if a string contains a substring (case-insensitive)
 */
export function containsCaseInsensitive(str: string, substr: string): boolean {
  return str.toLowerCase().includes(substr.toLowerCase());
}

/**
 * Parse PID from string
 */
export function parsePid(s: string): number | null {
  const pid = parseInt(s.trim(), 10);
  return Number.isNaN(pid) ? null : pid;
}
