import process from "node:process";
import type { ProcessDiscoverer } from "./interface.js";
import { WindowsProcessDiscoverer } from "./process-windows.js";
import { UnixProcessDiscoverer } from "./process-unix.js";
import { OtherProcessDiscoverer } from "./process-other.js";

let discoverer: ProcessDiscoverer | null = null;

/**
 * Get platform-specific process discoverer
 */
export function getProcessDiscoverer(): ProcessDiscoverer {
  if (!discoverer) {
    const platform = process.platform;

    switch (platform) {
      case "win32":
        discoverer = new WindowsProcessDiscoverer();
        break;
      case "darwin":
      case "linux":
        discoverer = new UnixProcessDiscoverer();
        break;
      default:
        discoverer = new OtherProcessDiscoverer();
        break;
    }
  }

  return discoverer;
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
