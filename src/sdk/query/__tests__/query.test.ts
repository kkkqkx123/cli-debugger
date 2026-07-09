/**
 * Tests for SDK Query Module
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createQuery, readSourceContext } from "../index.js";
import type { DebugProtocol } from "../../../protocol/base.js";
import type { ExtendedDebugProtocol } from "../../../protocol/extended.js";

// ─── Mock Client ─────────────────────────────────────────────────────────────

function createMockClient(
  overrides: Partial<DebugProtocol & ExtendedDebugProtocol> = {},
): DebugProtocol & ExtendedDebugProtocol {
  return {
    threads: vi.fn() as any,
    stack: vi.fn() as any,
    locals: vi.fn() as any,
    breakpoints: vi.fn() as any,
    getTypeInfo: vi.fn(),
    getTargetMetadata: vi.fn(),
    ...overrides,
  } as unknown as DebugProtocol & ExtendedDebugProtocol;
}

describe("Query Module", () => {
  let client: DebugProtocol & ExtendedDebugProtocol;
  let getClient: () => DebugProtocol | undefined;
  let getActiveThread: () => string | undefined;
  let getActiveFrameIndex: () => number;

  beforeEach(() => {
    client = createMockClient();
    getClient = () => client;
    getActiveThread = () => "thread-1";
    getActiveFrameIndex = () => 0;
  });

  // ─── Variable Query ────────────────────────────────────────────────────────

  describe("variable", () => {
    it("should return variable detail by name", async () => {
      (client.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const result = await query.variable("count");
      expect(result).toBeDefined();
      expect(result!.name).toBe("count");
      expect(result!.value).toBe(42);
    });

    it("should return undefined for unknown variable", async () => {
      (client.locals as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const result = await query.variable("missing");
      expect(result).toBeUndefined();
    });

    it("should throw when no client is available", async () => {
      const query = createQuery(() => undefined, getActiveThread, getActiveFrameIndex);
      await expect(query.variable("count")).rejects.toThrow("No active debug session");
    });
  });

  // ─── Find Variable ─────────────────────────────────────────────────────────

  describe("findVariable", () => {
    it("should find variables matching a pattern", async () => {
      (client.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false },
        { name: "counter", type: "int", value: 10, isPrimitive: true, isNull: false },
        { name: "name", type: "string", value: "hello", isPrimitive: true, isNull: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const results = await query.findVariable("count.*");
      expect(results).toHaveLength(2);
    });
  });

  // ─── Thread Query ──────────────────────────────────────────────────────────

  describe("thread", () => {
    it("should return thread by id", async () => {
      (client.threads as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", name: "main", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
        { id: "2", name: "worker", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const result = await query.thread("2");
      expect(result).toBeDefined();
      expect(result!.name).toBe("worker");
    });

    it("should return active thread when no id given", async () => {
      (client.threads as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "thread-1", name: "main", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const result = await query.thread();
      expect(result).toBeDefined();
      expect(result!.id).toBe("thread-1");
    });
  });

  describe("threadByName", () => {
    it("should find thread by name", async () => {
      (client.threads as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", name: "main", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
        { id: "2", name: "worker-1", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const result = await query.threadByName("worker");
      expect(result).toBeDefined();
      expect(result!.id).toBe("2");
    });
  });

  // ─── Stack Query ───────────────────────────────────────────────────────────

  describe("stack", () => {
    it("should return stack frames", async () => {
      (client.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const frames = await query.stack();
      expect(frames).toHaveLength(1);
    });

    it("should filter by method", async () => {
      (client.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
        { id: "2", method: "App.run", location: "App.java", line: 10, isNative: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const frames = await query.stack("thread-1", { method: "main" });
      expect(frames).toHaveLength(1);
      expect(frames[0]!.method).toBe("App.main");
    });

    it("should filter by method regex", async () => {
      (client.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
        { id: "2", method: "App.run", location: "App.java", line: 10, isNative: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const frames = await query.stack("thread-1", { method: /^App\./ });
      expect(frames).toHaveLength(2);
    });

    it("should filter by file", async () => {
      (client.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
        { id: "2", method: "Util.helper", location: "Util.java", line: 5, isNative: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const frames = await query.stack("thread-1", { file: "Util" });
      expect(frames).toHaveLength(1);
    });
  });

  // ─── Source Context ────────────────────────────────────────────────────────

  describe("sourceContext", () => {
    it("should return source context", async () => {
      (client.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const ctx = await query.sourceContext();
      expect(ctx).toBeDefined();
      expect(ctx!.file).toBe("App.java");
      expect(ctx!.line).toBe(42);
      expect(ctx!.method).toBe("App.main");
    });

    it("should return undefined for unknown location", async () => {
      (client.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "unknown", location: "<unknown>", line: 0, isNative: false },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const ctx = await query.sourceContext();
      expect(ctx).toBeUndefined();
    });
  });

  // ─── Breakpoint Query ──────────────────────────────────────────────────────

  describe("breakpoints", () => {
    it("should return all breakpoints", async () => {
      (client.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "App.java:42", enabled: true, hitCount: 0 },
        { id: "bp-2", location: "App.java:50", enabled: false, hitCount: 0 },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const bps = await query.breakpoints();
      expect(bps).toHaveLength(2);
    });

    it("should filter by enabled status", async () => {
      (client.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "App.java:42", enabled: true, hitCount: 0 },
        { id: "bp-2", location: "App.java:50", enabled: false, hitCount: 0 },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const bps = await query.breakpoints({ enabled: true });
      expect(bps).toHaveLength(1);
      expect(bps[0]!.id).toBe("bp-1");
    });

    it("should filter by location", async () => {
      (client.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "App.java:42", enabled: true, hitCount: 0 },
        { id: "bp-2", location: "App.java:50", enabled: true, hitCount: 0 },
      ]);

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const bps = await query.breakpoints({ location: ":42" });
      expect(bps).toHaveLength(1);
    });
  });

  // ─── Metadata ──────────────────────────────────────────────────────────────

  describe("metadata", () => {
    it("should return metadata when supported", async () => {
      (client.getTargetMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
        executable: "test",
        triple: "x86_64",
        numModules: 10,
        numSections: 5,
        numSymbols: 100,
      });

      const query = createQuery(getClient, getActiveThread, getActiveFrameIndex);
      const meta = await query.metadata();
      expect(meta).toBeDefined();
      expect(meta!.executable).toBe("test");
    });

    it("should return undefined when not supported", async () => {
      const basicClient = createMockClient();
      delete (basicClient as any).getTargetMetadata;

      const query = createQuery(() => basicClient, getActiveThread, getActiveFrameIndex);
      const meta = await query.metadata();
      expect(meta).toBeUndefined();
    });
  });

  // ─── readSourceContext ──────────────────────────────────────────────────────

  describe("readSourceContext", () => {
    it("should return empty array for non-existent file", () => {
      const lines = readSourceContext("/nonexistent/file.ts", 10);
      expect(lines).toEqual([]);
    });

    it("should return empty array for line 0", () => {
      const lines = readSourceContext("/nonexistent/file.ts", 0);
      expect(lines).toEqual([]);
    });
  });
});