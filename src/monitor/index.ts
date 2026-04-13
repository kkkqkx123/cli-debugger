import type { Monitor, MonitorOptions } from "./interface.js";
import { Poller } from "./poller.js";
import type { StreamOptions } from "./stream.js";
import { StreamMonitor } from "./stream.js";

export type { Monitor, MonitorOptions };
export { Poller };
export type { StreamOptions };
export { StreamMonitor };

/**
 * Create a poller monitor
 */
export function createPoller(options?: MonitorOptions): Poller {
  return new Poller(options);
}

/**
 * Create a stream monitor
 */
export function createStreamMonitor(options: StreamOptions): StreamMonitor {
  return new StreamMonitor(options);
}
