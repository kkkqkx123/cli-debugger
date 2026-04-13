import type { ProcessInfo, ProcessDiscoverer } from "./interface.js";
import { getProcessDiscoverer } from "./process.js";
import { WindowsProcessDiscoverer } from "./process-windows.js";
import { UnixProcessDiscoverer } from "./process-unix.js";
import { OtherProcessDiscoverer } from "./process-other.js";

export type { ProcessInfo, ProcessDiscoverer };
export { getProcessDiscoverer };
export { WindowsProcessDiscoverer };
export { UnixProcessDiscoverer };
export { OtherProcessDiscoverer };

/**
 * Create a process discoverer for the current platform
 */
export function createProcessDiscoverer(): ProcessDiscoverer {
  return getProcessDiscoverer();
}
