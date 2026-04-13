/**
 * Tests for protocol client factory and registry
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  registerProtocol,
  unregisterProtocol,
  createClientWithoutConnect,
  getRegisteredProtocols,
  hasProtocol,
  clearRegistry,
} from "../index.js";
import type { DebugProtocol, DebugConfig } from "../index.js";
import { APIError } from "../index.js";

// Mock protocol implementation
class MockProtocol implements DebugProtocol {
  constructor(private config: DebugConfig) {
    void this.config; // Suppress unused variable warning - required by interface but not used in mock
  }

  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  isConnected(): boolean {
    return true;
  }
  async version() {
    return {
      protocolVersion: "1.0",
      runtimeVersion: "1.0",
      runtimeName: "mock",
      description: "Mock protocol",
    };
  }
  async capabilities() {
    return {
      supportsVersion: true,
      supportsThreads: true,
      supportsStack: true,
      supportsLocals: true,
      supportsBreakpoints: true,
      supportsSuspend: true,
      supportsResume: true,
      supportsStep: true,
      supportsCont: true,
      supportsNext: true,
      supportsFinish: true,
      supportsEvents: true,
      supportsWatchMode: true,
      supportsStreaming: true,
    };
  }
  protocolName(): string {
    return "mock";
  }
  supportedLanguages(): string[] {
    return ["mock"];
  }
  async threads() {
    return [];
  }
  async stack() {
    return [];
  }
  async threadState() {
    return "running";
  }
  async suspend() {}
  async resume() {}
  async stepInto() {}
  async stepOver() {}
  async stepOut() {}
  async setBreakpoint() {
    return "bp-1";
  }
  async removeBreakpoint() {}
  async clearBreakpoints() {}
  async breakpoints() {
    return [];
  }
  async locals() {
    return [];
  }
  async fields() {
    return [];
  }
  async waitForEvent() {
    return null;
  }
}

describe("Protocol Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  it("should register a protocol", () => {
    registerProtocol("mock", (config) => new MockProtocol(config));
    expect(hasProtocol("mock")).toBe(true);
  });

  it("should throw error when registering duplicate protocol", () => {
    registerProtocol("mock", (config) => new MockProtocol(config));
    expect(() => {
      registerProtocol("mock", (config) => new MockProtocol(config));
    }).toThrow(APIError);
  });

  it("should throw error when registering with empty name", () => {
    expect(() => {
      registerProtocol("", (config) => new MockProtocol(config));
    }).toThrow(APIError);
  });

  it("should unregister a protocol", () => {
    registerProtocol("mock", (config) => new MockProtocol(config));
    expect(unregisterProtocol("mock")).toBe(true);
    expect(hasProtocol("mock")).toBe(false);
  });

  it("should return false when unregistering non-existent protocol", () => {
    expect(unregisterProtocol("nonexistent")).toBe(false);
  });

  it("should get registered protocols", () => {
    registerProtocol("mock1", (config) => new MockProtocol(config));
    registerProtocol("mock2", (config) => new MockProtocol(config));
    const protocols = getRegisteredProtocols();
    expect(protocols).toContain("mock1");
    expect(protocols).toContain("mock2");
  });
});

describe("Client Factory", () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  it("should create client without connect", () => {
    registerProtocol("mock", (config) => new MockProtocol(config));
    const client = createClientWithoutConnect({
      protocol: "mock",
      host: "localhost",
      port: 5005,
      timeout: 5000,
    });
    expect(client).toBeDefined();
    expect(client.protocolName()).toBe("mock");
  });

  it("should throw error for unregistered protocol", () => {
    expect(() => {
      createClientWithoutConnect({
        protocol: "nonexistent",
        host: "localhost",
        port: 5005,
        timeout: 5000,
      });
    }).toThrow(APIError);
  });

  it("should use default config values", () => {
    registerProtocol("mock", (config) => new MockProtocol(config));
    const client = createClientWithoutConnect({
      protocol: "mock",
      host: "127.0.0.1",
      port: 5005,
      timeout: 5000,
    });
    expect(client).toBeDefined();
  });
});
