import WebSocket from "ws";
import type { Monitor, MonitorOptions } from "./interface.js";
import type { DebugEvent } from "../protocol/types.js";

export interface StreamOptions extends MonitorOptions {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  onEvent?: (event: DebugEvent) => void;
}

export class StreamMonitor implements Monitor {
  private url: string;
  private reconnect: boolean;
  private reconnectInterval: number;
  private onEvent?: (event: DebugEvent) => void;
  private ws?: WebSocket;
  private abortController?: AbortController;
  private running = false;

  constructor(options: StreamOptions) {
    this.url = options.url;
    this.reconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 5000;
    this.onEvent = options.onEvent;
  }

  setInterval(_interval: number): void {
    // Not applicable for stream monitor
  }

  setTimeout(_timeout: number): void {
    // Not applicable for stream monitor
  }

  setCommand(_command: () => Promise<void>): void {
    // Not applicable for stream monitor
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Monitor is already running");
    }

    this.running = true;
    this.abortController = new AbortController();

    await this.connect();
  }

  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this.running = false;
  }

  async wait(): Promise<void> {
    // Wait until stopped
    while (this.running) {
      await this.sleep(100);
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        console.error("[Stream] Connected to", this.url);
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString()) as DebugEvent;
          this.onEvent?.(event);
        } catch (error) {
          console.error("[Stream] Failed to parse event:", error);
        }
      });

      this.ws.on("close", () => {
        console.error("[Stream] Connection closed");
        if (this.reconnect && !this.abortController?.signal.aborted) {
          setTimeout(() => {
            this.connect().catch(console.error);
          }, this.reconnectInterval);
        } else {
          this.running = false;
        }
      });

      this.ws.on("error", (error: Error) => {
        console.error("[Stream] Error:", error);
        reject(error);
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
