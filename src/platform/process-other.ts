import net from "node:net";
import type { ProcessDiscoverer, ProcessInfo } from "./interface.js";

export class OtherProcessDiscoverer implements ProcessDiscoverer {
  async findProcesses(): Promise<ProcessInfo[]> {
    // Not supported on this platform
    return [];
  }

  async findProcessByPort(_port: number): Promise<ProcessInfo | null> {
    // Not supported on this platform
    return null;
  }

  async findProcessByName(_name: string): Promise<ProcessInfo[]> {
    // Not supported on this platform
    return [];
  }

  async isPortInUse(port: number): Promise<boolean> {
    // Basic check using net module
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", () => resolve(true));
      server.once("listening", () => {
        server.close();
        resolve(false);
      });

      server.listen(port);
    });
  }
}
