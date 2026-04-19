/**
 * Unit tests for Delve RPC client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DlvRpcClient } from "../rpc.js";
import { APIError } from "../../errors.js";

// Mock socket events
interface MockSocketEvents {
  connect?: () => void;
  error?: (err: Error) => void;
  timeout?: () => void;
  close?: () => void;
  data?: (data: Buffer) => void;
}

describe("DlvRpcClient", () => {
  let client: DlvRpcClient;
  let mockEvents: MockSocketEvents;
  let mockWrites: Array<{ data: string; callback?: (err?: Error) => void }>;

  beforeEach(() => {
    mockEvents = {};
    mockWrites = [];

    // Mock net module
    vi.doMock("node:net", () => ({
      Socket: vi.fn().mockImplementation(() => ({
        connect: vi.fn((_port: number, _host: string, callback: () => void) => {
          mockEvents.connect = callback;
          setTimeout(callback, 0);
        }),
        write: vi.fn((data: string, _encoding: string, callback?: (err?: Error) => void) => {
          mockWrites.push({ data, callback });
          callback?.();
          return true;
        }),
        end: vi.fn((callback?: () => void) => {
          setTimeout(() => callback?.(), 0);
        }),
        destroy: vi.fn(),
        setTimeout: vi.fn(),
        on: vi.fn((event: string, callback: () => void) => {
          mockEvents[event as keyof MockSocketEvents] = callback as () => void;
          return this;
        }),
        removeAllListeners: vi.fn(),
      })),
    }));

    client = new DlvRpcClient(5000);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock("node:net");
  });

  describe("constructor", () => {
    it("should create client with default timeout", () => {
      const c = new DlvRpcClient();
      expect(c).toBeInstanceOf(DlvRpcClient);
    });

    it("should create client with custom timeout", () => {
      const c = new DlvRpcClient(10000);
      expect(c).toBeInstanceOf(DlvRpcClient);
    });
  });

  describe("isConnected", () => {
    it("should return false initially", () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("call", () => {
    it("should throw if not connected", async () => {
      await expect(client.call("test", [])).rejects.toThrow(APIError);
    });
  });

  describe("notify", () => {
    it("should throw if not connected", () => {
      expect(() => client.notify("test", [])).toThrow(APIError);
    });
  });

  describe("close", () => {
    it("should do nothing if not connected", async () => {
      await client.close();
      expect(client.isConnected()).toBe(false);
    });
  });
});

describe("createRpcClient", () => {
  it("should create client with default timeout", () => {
    const client = new DlvRpcClient();
    expect(client).toBeInstanceOf(DlvRpcClient);
  });

  it("should create client with custom timeout", () => {
    const client = new DlvRpcClient(10000);
    expect(client).toBeInstanceOf(DlvRpcClient);
  });
});
