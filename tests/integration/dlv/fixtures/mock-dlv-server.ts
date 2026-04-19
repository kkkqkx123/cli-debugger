/**
 * Mock Delve Server for integration testing
 * Simulates a Delve debugger server for testing without requiring a real Go process
 */

import * as net from "node:net";

export interface MockDlvServerOptions {
  port?: number;
  responseDelay?: number;
  onError?: (socket: net.Socket) => void;
}

export interface MockDlvState {
  goroutines: Array<{
    id: number;
    userCurrentLoc: {
      file: string;
      line: number;
      function?: { name: string };
    };
    systemStack: boolean;
    threadId: number;
  }>;
  breakpoints: Map<number, {
    id: number;
    file?: string;
    line?: number;
    functionName?: string;
    hitCount: number;
    disabled: boolean;
    Cond?: string;
  }>;
  currentGoroutine: number;
  running: boolean;
  exited: boolean;
  exitStatus: number;
}

/**
 * Mock Delve Server
 * Provides a simulated Delve JSON-RPC server for testing
 */
export class MockDlvServer {
  private server: net.Server | null = null;
  private options: MockDlvServerOptions;
  private port: number = 0;
  private connections: net.Socket[] = [];
  private responseHandler: ((data: Buffer) => Buffer | null) | null = null;
  private state: MockDlvState;
  private requestIdCounter: number = 0;

  constructor(options: MockDlvServerOptions = {}) {
    this.options = options;
    this.state = this.createInitialState();
  }

  /**
   * Start the mock server
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.connections.push(socket);
        this.handleConnection(socket);
      });

      this.server.listen(this.options.port ?? 0, () => {
        const address = this.server?.address();
        if (address && typeof address === "object") {
          this.port = address.port;
          resolve(this.port);
        } else {
          reject(new Error("Failed to get server port"));
        }
      });

      this.server.on("error", reject);
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    // Close all connections
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections = [];

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Simulate an error on all connections
   */
  simulateError(): void {
    if (this.options.onError) {
      for (const socket of this.connections) {
        this.options.onError(socket);
      }
    } else {
      // Default: close all connections
      for (const socket of this.connections) {
        socket.destroy();
      }
    }
  }

  /**
   * Set custom response handler
   */
  setResponseHandler(handler: (data: Buffer) => Buffer | null): void {
    this.responseHandler = handler;
  }

  /**
   * Get current state
   */
  getState(): MockDlvState {
    return this.state;
  }

  /**
   * Update state
   */
  updateState(state: Partial<MockDlvState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Handle incoming connection
   */
  private handleConnection(socket: net.Socket): void {
    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString("utf8");

      // Process complete messages (newline-delimited JSON)
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim()) {
          const response = this.processMessage(line);
          if (response) {
            setTimeout(() => {
              socket.write(response + "\n");
            }, this.options.responseDelay ?? 0);
          }
        }
      }
    });

    socket.on("error", () => {
      // Ignore socket errors
    });

    socket.on("close", () => {
      const index = this.connections.indexOf(socket);
      if (index >= 0) {
        this.connections.splice(index, 1);
      }
    });
  }

  /**
   * Process incoming JSON-RPC message
   */
  private processMessage(message: string): string | null {
    if (this.responseHandler) {
      const result = this.responseHandler(Buffer.from(message));
      return result ? result.toString() : null;
    }

    try {
      const request = JSON.parse(message);

      // Check if it's a valid JSON-RPC request
      if (request.jsonrpc === "2.0" && request.method) {
        const response = this.handleRequest(request.id, request.method, request.params);
        return JSON.stringify(response);
      }
    } catch {
      // Invalid JSON, ignore
    }

    return null;
  }

  /**
   * Handle JSON-RPC request
   */
  private handleRequest(
    id: number | undefined,
    method: string,
    params: unknown[],
  ): { jsonrpc: string; id?: number; result?: unknown; error?: { code: number; message: string } } {
    const response: { jsonrpc: string; id?: number; result?: unknown; error?: { code: number; message: string } } = {
      jsonrpc: "2.0",
      id,
    };

    try {
      response.result = this.executeMethod(method, params);
    } catch (error) {
      response.error = {
        code: -32000,
        message: error instanceof Error ? error.message : "Internal error",
      };
    }

    return response;
  }

  /**
   * Execute RPC method
   */
  private executeMethod(method: string, params: unknown[]): unknown {
    // Debugger API
    if (method === "RPCServer.Version") {
      return {
        DelveVersion: "1.20.0",
        APIVersion: "2",
      };
    }

    if (method === "RPCServer.State") {
      const goroutine = this.state.goroutines.find(g => g.id === this.state.currentGoroutine);
      return {
        State: {
          running: this.state.running,
          currentGoroutine: goroutine ? {
            id: goroutine.id,
            userCurrentLoc: goroutine.userCurrentLoc,
            systemStack: goroutine.systemStack,
            threadId: goroutine.threadId,
          } : null,
          exited: this.state.exited,
          exitStatus: this.state.exitStatus,
          currentThread: goroutine ? {
            id: goroutine.threadId,
            breakPoint: null,
          } : null,
        },
      };
    }

    if (method === "RPCServer.SwitchGoroutine") {
      const goroutineId = params[0] as number;
      this.state.currentGoroutine = goroutineId;
      return {};
    }

    if (method === "RPCServer.Halt") {
      this.state.running = false;
      return {};
    }

    if (method === "RPCServer.Continue") {
      this.state.running = true;
      return {
        State: {
          running: true,
          exited: false,
          exitStatus: 0,
        },
      };
    }

    if (method === "RPCServer.Step") {
      return {
        State: {
          running: false,
          exited: false,
        },
      };
    }

    if (method === "RPCServer.Next") {
      return {
        State: {
          running: false,
          exited: false,
        },
      };
    }

    if (method === "RPCServer.StepOut") {
      return {
        State: {
          running: false,
          exited: false,
        },
      };
    }

    // Goroutine API
    if (method === "RPCServer.ListGoroutines") {
      return {
        Goroutines: this.state.goroutines.map(g => ({
          id: g.id,
          currentLoc: { pc: 0, ...g.userCurrentLoc, function: g.userCurrentLoc.function ?? null },
          userCurrentLoc: { pc: 0, ...g.userCurrentLoc, function: g.userCurrentLoc.function ?? null },
          goStatementLoc: { pc: 0, file: "", line: 0, function: null },
          systemStack: g.systemStack,
          threadId: g.threadId,
        })),
        Nextg: -1,
        GroupBy: null,
      };
    }

    if (method === "RPCServer.GetGoroutine") {
      const paramObj = params[0] as { id?: number };
      const id = paramObj?.id;
      const goroutine = this.state.goroutines.find(g => g.id === id);
      if (!goroutine) {
        throw new Error(`Goroutine ${id} not found`);
      }
      return {
        id: goroutine.id,
        currentLoc: { pc: 0, ...goroutine.userCurrentLoc, function: goroutine.userCurrentLoc.function ?? null },
        userCurrentLoc: { pc: 0, ...goroutine.userCurrentLoc, function: goroutine.userCurrentLoc.function ?? null },
        goStatementLoc: { pc: 0, file: "", line: 0, function: null },
        systemStack: goroutine.systemStack,
        threadId: goroutine.threadId,
      };
    }

    // Breakpoint API
    if (method === "RPCServer.CreateBreakpoint") {
      const bpRequest = params[0] as { file?: string; line?: number; functionName?: string; Cond?: string };
      const id = ++this.requestIdCounter;
      const bp = {
        id,
        name: "",
        addr: 0,
        file: bpRequest?.file ?? "",
        line: bpRequest?.line ?? 0,
        functionName: bpRequest?.functionName ?? "",
        hitCount: 0,
        disabled: false,
        Cond: bpRequest?.Cond ?? "",
        tracepoint: false,
        retrieveGoroutineInfo: false,
        stacktrace: 0,
        goroutine: false,
        variables: [],
        loadArgs: null,
        loadLocals: null,
        userData: null,
      };
      this.state.breakpoints.set(id, bp);
      return bp;
    }

    if (method === "RPCServer.ClearBreakpoint") {
      const paramObj = params[0] as { id?: number; name?: string };
      const id = paramObj?.id;
      if (id !== undefined) {
        this.state.breakpoints.delete(id);
      }
      return {};
    }

    if (method === "RPCServer.ClearAllBreakpoints") {
      this.state.breakpoints.clear();
      return {};
    }

    if (method === "RPCServer.ListBreakpoints") {
      return Array.from(this.state.breakpoints.values());
    }

    // Stack API
    if (method === "RPCServer.Stacktrace") {
      const paramObj = params[0] as { goroutineID?: number; depth?: number };
      const goroutineId = paramObj?.goroutineID ?? this.state.currentGoroutine;
      const depth = paramObj?.depth ?? 50;
      const goroutine = this.state.goroutines.find(g => g.id === goroutineId);

      if (!goroutine) {
        return [];
      }

      // Generate mock stack frames
      const frames = [];
      for (let i = 0; i < Math.min(depth, 5); i++) {
        frames.push({
          file: goroutine.userCurrentLoc.file,
          line: goroutine.userCurrentLoc.line + i,
          function: goroutine.userCurrentLoc.function ? { name: goroutine.userCurrentLoc.function.name, value: 0, type: 0, goType: 0 } : null,
          pc: 0,
          goroutineID: goroutine.id,
          systemStack: goroutine.systemStack,
        });
      }

      return frames;
    }

    // Variable API
    if (method === "RPCServer.ListLocalVars") {
      return [
        { name: "x", type: "int", value: "42", kind: 0, children: [] },
        { name: "y", type: "string", value: '"hello"', kind: 0, children: [] },
      ];
    }

    if (method === "RPCServer.ListFunctionArgs") {
      return [
        { name: "arg1", type: "int", value: "10", kind: 0, children: [] },
      ];
    }

    if (method === "RPCServer.Eval") {
      const expr = params[0] as string;
      return {
        Variable: {
          name: expr,
          type: "int",
          value: "123",
          kind: 0,
          children: [],
        },
      };
    }

    // Info API
    if (method === "RPCServer.ListFunctions") {
      return [
        { name: "main.main", type: 0, value: 0, goType: 0 },
        { name: "main.helper", type: 0, value: 0, goType: 0 },
      ];
    }

    if (method === "RPCServer.ListPackages") {
      return ["main", "fmt", "os"];
    }

    if (method === "RPCServer.ListSources") {
      return ["main.go", "helper.go"];
    }

    if (method === "RPCServer.ListTypes") {
      return [
        { name: "main.MyStruct", size: 0, kind: 0 },
        { name: "int", size: 8, kind: 0 },
      ];
    }

    // Default: return empty result
    return {};
  }

  /**
   * Create initial state
   */
  private createInitialState(): MockDlvState {
    return {
      goroutines: [
        {
          id: 1,
          userCurrentLoc: {
            file: "main.go",
            line: 10,
            function: { name: "main.main" },
          },
          systemStack: false,
          threadId: 1,
        },
        {
          id: 2,
          userCurrentLoc: {
            file: "worker.go",
            line: 25,
            function: { name: "worker.run" },
          },
          systemStack: false,
          threadId: 2,
        },
      ],
      breakpoints: new Map(),
      currentGoroutine: 1,
      running: false,
      exited: false,
      exitStatus: 0,
    };
  }
}
