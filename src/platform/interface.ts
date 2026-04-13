/**
 * Process information
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  command?: string;
  user?: string;
}

/**
 * Process discoverer interface
 */
export interface ProcessDiscoverer {
  /**
   * Find all running processes
   */
  findProcesses(): Promise<ProcessInfo[]>;

  /**
   * Find process listening on a specific port
   */
  findProcessByPort(port: number): Promise<ProcessInfo | null>;

  /**
   * Find processes by name (case-insensitive)
   */
  findProcessByName(name: string): Promise<ProcessInfo[]>;

  /**
   * Check if a port is in use
   */
  isPortInUse(port: number): Promise<boolean>;
}
