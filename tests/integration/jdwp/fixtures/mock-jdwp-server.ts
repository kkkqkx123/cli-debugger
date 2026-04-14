/**
 * Mock JDWP Server for integration testing
 * Simulates a JDWP-enabled JVM for testing without requiring a real JVM
 */

import * as net from "node:net";

export interface MockJDWPServerOptions {
  port?: number;
  handshakeDelay?: number;
  responseDelay?: number;
  onError?: (socket: net.Socket) => void;
}

export interface MockJDWPState {
  threads: Array<{
    id: string;
    name: string;
    status: number;
    suspendStatus: number;
  }>;
  breakpoints: Map<string, { id: string; location: string }>;
  classes: Map<string, { refID: string; methods: string[] }>;
}

/**
 * JDWP Handshake string
 */
const JDWP_HANDSHAKE = "JDWP-Handshake";

/**
 * Default ID sizes for JDWP protocol
 */
const DEFAULT_ID_SIZES = {
  fieldIDSize: 8,
  methodIDSize: 8,
  objectIDSize: 8,
  referenceTypeIDSize: 8,
  frameIDSize: 8,
};

/**
 * Mock JDWP Server
 * Provides a simulated JDWP server for testing
 */
export class MockJDWPServer {
  private server: net.Server | null = null;
  private options: MockJDWPServerOptions;
  private port: number = 0;
  private connections: net.Socket[] = [];
  private responseHandler: ((data: Buffer) => Buffer) | null = null;
  private state: MockJDWPState;
  private packetIdCounter: number = 0;

  constructor(options: MockJDWPServerOptions = {}) {
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
  setResponseHandler(handler: (data: Buffer) => Buffer): void {
    this.responseHandler = handler;
  }

  /**
   * Get current state
   */
  getState(): MockJDWPState {
    return this.state;
  }

  /**
   * Update state
   */
  updateState(state: Partial<MockJDWPState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Handle incoming connection
   */
  private handleConnection(socket: net.Socket): void {
    let handshakeComplete = false;
    let buffer = Buffer.alloc(0);

    socket.on("data", (data) => {
      if (!handshakeComplete) {
        // Handle handshake
        const handshakeData = data.toString();
        if (handshakeData.startsWith(JDWP_HANDSHAKE)) {
          // Send handshake response
          setTimeout(() => {
            socket.write(JDWP_HANDSHAKE);
            handshakeComplete = true;
          }, this.options.handshakeDelay ?? 0);
        }
      } else {
        // Handle JDWP packets
        buffer = Buffer.concat([buffer, data]);

        while (buffer.length >= 4) {
          const length = buffer.readUInt32BE(0);
          if (buffer.length < length) {
            break;
          }

          const packet = buffer.subarray(0, length);
          buffer = buffer.subarray(length);

          // Process packet
          const response = this.processPacket(packet);
          if (response) {
            setTimeout(() => {
              socket.write(response);
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
   * Process incoming JDWP packet
   */
  private processPacket(packet: Buffer): Buffer | null {
    if (this.responseHandler) {
      return this.responseHandler(packet);
    }

    // Parse packet header
    const length = packet.readUInt32BE(0);
    const id = packet.readInt32BE(4);
    const flags = packet.readUInt8(8);

    // If it's a command packet (flags === 0)
    if (flags === 0) {
      const commandSet = packet.readUInt8(9);
      const command = packet.readUInt8(10);
      const data = packet.subarray(11, length);

      return this.handleCommand(id, commandSet, command, data);
    }

    return null;
  }

  /**
   * Handle JDWP command
   */
  private handleCommand(
    id: number,
    commandSet: number,
    command: number,
    _data: Buffer,
  ): Buffer {
    // Default response: empty reply with error code 0
    const responseData = this.generateResponse(commandSet, command);
    return this.buildReplyPacket(id, 0, responseData);
  }

  /**
   * Generate response data for command
   */
  private generateResponse(commandSet: number, command: number): Buffer {
    // VirtualMachine command set (1)
    if (commandSet === 1) {
      switch (command) {
        case 1: // Version
          return this.generateVersionResponse();
        case 10: // IDSizes
          return this.generateIDSizesResponse();
        case 11: // Suspend
          return Buffer.alloc(0);
        case 12: // Resume
          return Buffer.alloc(0);
        case 4: // AllThreads
          return this.generateAllThreadsResponse();
        case 13: // Exit
          return Buffer.alloc(0);
        case 2: // ClassesBySignature
          return Buffer.alloc(0);
        default:
          return Buffer.alloc(0);
      }
    }

    // ThreadReference command set (11)
    if (commandSet === 11) {
      switch (command) {
        case 1: // Name
          return Buffer.from("main", "utf8");
        case 4: // Status
          return Buffer.from([0, 0, 0, 2, 0, 0, 0, 0]); // RUNNING, not suspended
        case 8: // Suspend
          return Buffer.alloc(0);
        case 9: // Resume
          return Buffer.alloc(0);
        default:
          return Buffer.alloc(0);
      }
    }

    // EventRequest command set (15)
    if (commandSet === 15) {
      switch (command) {
        case 1: // Set
          return Buffer.from([0, 0, 0, 1]); // requestID = 1
        case 2: // Clear
          return Buffer.alloc(0);
        default:
          return Buffer.alloc(0);
      }
    }

    return Buffer.alloc(0);
  }

  /**
   * Generate Version command response
   */
  private generateVersionResponse(): Buffer {
    const description = "Mock JDWP Server 1.0";
    const vmVersion = "1.0.0";
    const vmName = "MockVM";

    const descBuf = Buffer.from(description, "utf8");
    const vmVersionBuf = Buffer.from(vmVersion, "utf8");
    const vmNameBuf = Buffer.from(vmName, "utf8");

    const buffer = Buffer.alloc(
      4 + descBuf.length + 4 + vmVersionBuf.length + 4 + vmNameBuf.length + 4,
    );
    let offset = 0;

    // description
    buffer.writeUInt32BE(descBuf.length, offset);
    offset += 4;
    descBuf.copy(buffer, offset);
    offset += descBuf.length;

    // jdwpMajor
    buffer.writeUInt32BE(1, offset);
    offset += 4;

    // jdwpMinor
    buffer.writeUInt32BE(6, offset);
    offset += 4;

    // vmVersion
    buffer.writeUInt32BE(vmVersionBuf.length, offset);
    offset += 4;
    vmVersionBuf.copy(buffer, offset);
    offset += vmVersionBuf.length;

    // vmName
    buffer.writeUInt32BE(vmNameBuf.length, offset);
    offset += 4;
    vmNameBuf.copy(buffer, offset);

    return buffer;
  }

  /**
   * Generate IDSizes command response
   */
  private generateIDSizesResponse(): Buffer {
    const buffer = Buffer.alloc(20);
    let offset = 0;

    buffer.writeInt32BE(DEFAULT_ID_SIZES.fieldIDSize, offset);
    offset += 4;
    buffer.writeInt32BE(DEFAULT_ID_SIZES.methodIDSize, offset);
    offset += 4;
    buffer.writeInt32BE(DEFAULT_ID_SIZES.objectIDSize, offset);
    offset += 4;
    buffer.writeInt32BE(DEFAULT_ID_SIZES.referenceTypeIDSize, offset);
    offset += 4;
    buffer.writeInt32BE(DEFAULT_ID_SIZES.frameIDSize, offset);

    return buffer;
  }

  /**
   * Generate AllThreads command response
   */
  private generateAllThreadsResponse(): Buffer {
    const threads = this.state.threads;
    const buffer = Buffer.alloc(4 + threads.length * 8);
    let offset = 0;

    buffer.writeUInt32BE(threads.length, offset);
    offset += 4;

    for (const thread of threads) {
      const id = BigInt(thread.id);
      buffer.writeBigUInt64BE(id, offset);
      offset += 8;
    }

    return buffer;
  }

  /**
   * Build reply packet
   */
  private buildReplyPacket(
    id: number,
    errorCode: number,
    data: Buffer,
  ): Buffer {
    const length = 11 + data.length;
    const buffer = Buffer.alloc(length);

    let offset = 0;
    buffer.writeUInt32BE(length, offset);
    offset += 4;
    buffer.writeInt32BE(id, offset);
    offset += 4;
    buffer.writeUInt8(0x80, offset); // Reply flag
    offset += 1;
    buffer.writeUInt16BE(errorCode, offset);
    offset += 2;
    data.copy(buffer, offset);

    return buffer;
  }

  /**
   * Create initial state
   */
  private createInitialState(): MockJDWPState {
    return {
      threads: [
        { id: "1", name: "main", status: 2, suspendStatus: 0 },
        { id: "2", name: "Reference Handler", status: 4, suspendStatus: 0 },
        { id: "3", name: "Finalizer", status: 4, suspendStatus: 0 },
      ],
      breakpoints: new Map(),
      classes: new Map(),
    };
  }
}
