import process from "node:process";
import type { Monitor, MonitorOptions } from "./interface.js";

export class Poller implements Monitor {
  private interval: number;
  private timeout: number;
  private command?: () => Promise<void>;
  private abortController?: AbortController;
  private donePromise?: Promise<void>;
  private running = false;

  constructor(options?: MonitorOptions) {
    this.interval = options?.interval ?? 1000;
    this.timeout = options?.timeout ?? 60000;
    this.command = options?.command;
  }

  setInterval(interval: number): void {
    if (interval < 100) {
      interval = 100; // Minimum 100ms
    }
    this.interval = interval;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setCommand(command: () => Promise<void>): void {
    this.command = command;
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Monitor is already running");
    }

    if (!this.command) {
      throw new Error("Monitor command not set");
    }

    this.running = true;
    this.abortController = new AbortController();

    this.donePromise = this.runLoop();
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async wait(): Promise<void> {
    if (this.donePromise) {
      await this.donePromise;
    }
  }

  private async runLoop(): Promise<void> {
    const startTime = Date.now();
    const command = this.command!;

    // Setup signal handlers
    const signalHandler = () => {
      console.error("\n[Monitor] Interrupted, stopping...");
      this.stop();
    };

    process.on("SIGINT", signalHandler);
    process.on("SIGTERM", signalHandler);

    try {
      // Run first command immediately
      await this.executeCommand(command);

      // Start polling loop
      while (!this.abortController?.signal.aborted) {
        // Check timeout
        if (Date.now() - startTime >= this.timeout) {
          console.error("\n[Monitor] Timeout reached, stopping...");
          break;
        }

        // Wait for interval
        await this.sleep(this.interval);

        // Check if aborted during sleep
        if (this.abortController?.signal.aborted) {
          break;
        }

        // Execute command
        await this.executeCommand(command);
      }
    } finally {
      process.off("SIGINT", signalHandler);
      process.off("SIGTERM", signalHandler);
      this.running = false;
    }
  }

  private async executeCommand(command: () => Promise<void>): Promise<void> {
    try {
      await command();
    } catch (error) {
      console.error("\n[Monitor] Command error:", error);
      // Continue monitoring despite errors
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, ms);

      // Allow aborting during sleep
      this.abortController?.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}
