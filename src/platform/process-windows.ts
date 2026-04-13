import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ProcessDiscoverer, ProcessInfo } from "./interface.js";
import { containsCaseInsensitive, parsePid } from "./process.js";

const execAsync = promisify(exec);

export class WindowsProcessDiscoverer implements ProcessDiscoverer {
  async findProcesses(): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync("tasklist /FO CSV /NH");
      return this.parseTasklist(stdout);
    } catch {
      return [];
    }
  }

  async findProcessByPort(port: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync("netstat -ano");
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (line.includes(`:${port}`)) {
          const fields = line.trim().split(/\s+/);
          const pidField = fields[fields.length - 1];
          if (pidField) {
            const pid = parsePid(pidField);

            if (pid !== null && pid > 0) {
              return this.findProcessByPid(pid);
            }
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async findProcessByName(name: string): Promise<ProcessInfo[]> {
    const processes = await this.findProcesses();
    return processes.filter((p) => containsCaseInsensitive(p.name, name));
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync("netstat -ano");
      return stdout.includes(`:${port}`);
    } catch {
      return false;
    }
  }

  private async findProcessByPid(pid: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(
        `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
      );
      const processes = this.parseTasklist(stdout);
      return processes[0] ?? null;
    } catch {
      return null;
    }
  }

  private parseTasklist(output: string): ProcessInfo[] {
    const processes: ProcessInfo[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      // Format: "ImageName","PID","SessionName","Session#","MemUsage"
      const match = line.match(/"([^"]+)","(\d+)"/);
      if (match) {
        processes.push({
          name: match[1]!,
          pid: Number.parseInt(match[2]!, 10),
        });
      }
    }

    return processes;
  }
}
