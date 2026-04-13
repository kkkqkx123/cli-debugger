import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ProcessDiscoverer, ProcessInfo } from "./interface.js";
import { containsCaseInsensitive, parsePid } from "./process.js";

const execAsync = promisify(exec);

export class UnixProcessDiscoverer implements ProcessDiscoverer {
  async findProcesses(): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync("ps -e -o pid,comm");
      return this.parsePs(stdout);
    } catch {
      return [];
    }
  }

  async findProcessByPort(port: number): Promise<ProcessInfo | null> {
    try {
      // Try lsof first
      const { stdout: lsofOut } = await execAsync(`lsof -i :${port} -t`);
      const pid = parsePid(lsofOut.trim());

      if (pid !== null && pid > 0) {
        return this.findProcessByPid(pid);
      }
    } catch {
      // lsof not available or port not found
    }

    try {
      // Fallback to netstat
      const { stdout } = await execAsync(
        "netstat -tlnp 2>/dev/null || ss -tlnp",
      );
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (line.includes(`:${port}`)) {
          // Parse PID from netstat/ss output
          const match = line.match(/(\d+)\/(\S+)/);
          if (match && match[1]) {
            const pid = Number.parseInt(match[1], 10);
            return this.findProcessByPid(pid);
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  async findProcessByName(name: string): Promise<ProcessInfo[]> {
    const processes = await this.findProcesses();
    return processes.filter((p) => containsCaseInsensitive(p.name, name));
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port}`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async findProcessByPid(pid: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(`ps -p ${pid} -o pid,comm`);
      const processes = this.parsePs(stdout);
      return processes[0] ?? null;
    } catch {
      return null;
    }
  }

  private parsePs(output: string): ProcessInfo[] {
    const processes: ProcessInfo[] = [];
    const lines = output.split("\n").slice(1); // Skip header

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0]) {
        const pid = parsePid(parts[0]);
        if (pid !== null && parts[1]) {
          processes.push({
            pid,
            name: parts[1],
          });
        }
      }
    }

    return processes;
  }
}
