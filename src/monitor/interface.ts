/**
 * Monitor interface for observing debug state changes
 */
export interface Monitor {
  /**
   * Start monitoring
   */
  start(): Promise<void>;

  /**
   * Stop monitoring
   */
  stop(): void;

  /**
   * Set refresh interval (in milliseconds)
   */
  setInterval(interval: number): void;

  /**
   * Set total timeout (in milliseconds)
   */
  setTimeout(timeout: number): void;

  /**
   * Set the command to execute on each tick
   */
  setCommand(command: () => Promise<void>): void;

  /**
   * Wait for monitoring to complete
   */
  wait(): Promise<void>;
}

/** Monitor options */
export interface MonitorOptions {
  interval?: number;
  timeout?: number;
  command?: () => Promise<void>;
}
