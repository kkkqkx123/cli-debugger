/**
 * Tests for SDK Debugger Main Class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Debugger } from "../debugger.js";
import type { DebugConfig } from "../../types/config.js";

const { MockSessionManager } = vi.hoisted(() => {
  class Mgr {
    createSession = vi.fn().mockResolvedValue("session-1");
    getSession = vi.fn().mockReturnValue({ client: this.createClient() });
    getCurrentClient = vi.fn().mockReturnValue(this.createClient());
    getCurrentSessionInfo = vi.fn().mockReturnValue({
      id: "session-1",
      protocol: "jdwp",
      target: "127.0.0.1:5005",
    });
    getActiveThread = vi.fn().mockReturnValue("thread-1");
    getActiveFrameIndex = vi.fn().mockReturnValue(0);
    setActiveThread = vi.fn();
    setActiveFrameIndex = vi.fn();
    closeAllSessions = vi.fn().mockResolvedValue(undefined);

    private createClient() {
      return {
        connect: vi.fn(),
        close: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true),
        version: vi.fn(),
        capabilities: vi.fn(),
        protocolName: vi.fn().mockReturnValue("mock"),
        supportedLanguages: vi.fn().mockReturnValue([]),
        threads: vi.fn().mockResolvedValue([{ id: "thread-1", name: "main", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() }]),
        stack: vi.fn().mockResolvedValue([{ id: "frame-1", method: "App.main", location: "App.java", line: 42, isNative: false }]),
        threadState: vi.fn(),
        suspend: vi.fn(),
        resume: vi.fn().mockResolvedValue(undefined),
        stepInto: vi.fn(),
        stepOver: vi.fn(),
        stepOut: vi.fn(),
        setBreakpoint: vi.fn().mockResolvedValue("bp-1"),
        removeBreakpoint: vi.fn(),
        clearBreakpoints: vi.fn(),
        breakpoints: vi.fn().mockResolvedValue([{ id: "bp-1", location: "App.java:42", enabled: true, hitCount: 0 }]),
        locals: vi.fn().mockResolvedValue([{ name: "count", type: "int", value: 42, isPrimitive: true, isNull: false }]),
        fields: vi.fn(),
        setField: vi.fn(),
        waitForEvent: vi.fn().mockResolvedValue(null),
        eval: vi.fn().mockResolvedValue({ value: 4, type: "int" }),
        getTypeInfo: vi.fn(),
        getSymbol: vi.fn(),
        getTargetMetadata: vi.fn(),
        enableBreakpoint: vi.fn(),
        disableBreakpoint: vi.fn(),
        getBreakpointInfo: vi.fn(),
        getThreadBatchInfo: vi.fn(),
        supportsFeature: vi.fn().mockReturnValue(true),
      } as any;
    }
  }
  return { MockSessionManager: Mgr };
});

vi.mock("../../session/manager.js", () => ({
  SessionManager: MockSessionManager,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Debugger", () => {
  let dbg: Debugger;
  let config: DebugConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = { protocol: "jdwp", host: "127.0.0.1", port: 5005, timeout: 30000 };
  });

  afterEach(async () => {
    if (dbg && dbg.isConnected) {
      await dbg.disconnect().catch(() => {});
    }
  });

  describe("construction", () => {
    it("should create a Debugger instance", () => {
      dbg = new Debugger(config);
      expect(dbg).toBeInstanceOf(Debugger);
      expect(dbg.isConnected).toBe(false);
    });

    it("should accept partial config", () => {
      dbg = new Debugger({ protocol: "dlv" });
      expect(dbg.config.protocol).toBe("dlv");
      expect(dbg.config.host).toBe("127.0.0.1");
    });

    it("should accept partial config with host and port", () => {
      dbg = new Debugger({ protocol: "jdwp", port: 8000 });
      expect(dbg.config.port).toBe(8000);
    });
  });

  describe("connect", () => {
    it("should connect to debug target", async () => {
      dbg = new Debugger(config);
      await dbg.connect();
      expect(dbg.isConnected).toBe(true);
      expect(dbg.getState()).toBe("paused");
    });

    it("should throw if already connected", async () => {
      dbg = new Debugger(config);
      await dbg.connect();
      await expect(dbg.connect()).rejects.toThrow("Already connected");
    });
  });

  describe("static connect", () => {
    it("should create and connect in one step", async () => {
      dbg = await Debugger.connect(config);
      expect(dbg.isConnected).toBe(true);
    });

    it("should accept string protocol name", async () => {
      dbg = await Debugger.connect("jdwp");
      expect(dbg.isConnected).toBe(true);
      expect(dbg.config.protocol).toBe("jdwp");
    });
  });

  describe("static from", () => {
    it("should create and connect via builder callback", async () => {
      dbg = await Debugger.from((builder) => builder.protocol("jdwp").port(5005));
      expect(dbg.isConnected).toBe(true);
      expect(dbg.config.protocol).toBe("jdwp");
      expect(dbg.config.port).toBe(5005);
    });
  });

  describe("static preset", () => {
    it("should create and connect using a preset config", async () => {
      dbg = await Debugger.preset(config);
      expect(dbg.isConnected).toBe(true);
      expect(dbg.config.protocol).toBe("jdwp");
    });
  });

  describe("disconnect", () => {
    it("should disconnect from debug target", async () => {
      dbg = new Debugger(config);
      await dbg.connect();
      await dbg.disconnect();
      expect(dbg.isConnected).toBe(false);
      expect(dbg.getState()).toBe("disconnected");
    });

    it("should be safe to disconnect when not connected", async () => {
      dbg = new Debugger(config);
      await dbg.disconnect();
      expect(dbg.isConnected).toBe(false);
    });
  });

  describe("execution control", () => {
    beforeEach(async () => {
      dbg = new Debugger(config);
      await dbg.connect();
    });

    it("should continue execution", async () => {
      const ctx = await dbg.continue();
      expect(ctx).toBeDefined();
    });

    it("should pause execution", async () => {
      const ctx = await dbg.pause();
      expect(ctx).toBeDefined();
    });
  });

  describe("breakpoint management", () => {
    beforeEach(async () => {
      dbg = new Debugger(config);
      await dbg.connect();
    });

    it("should set a breakpoint", async () => {
      const bpId = await dbg.breakpoint("App.java:42");
      expect(bpId).toBe("bp-1");
    });

    it("should get all breakpoints", async () => {
      const bps = await dbg.breakpoints();
      expect(bps).toHaveLength(1);
    });

    it("should remove a breakpoint", async () => {
      await dbg.removeBreakpoint("bp-1");
    });

    it("should clear all breakpoints", async () => {
      await dbg.clearBreakpoints();
    });

    it("should enable a breakpoint", async () => {
      await dbg.enableBreakpoint("bp-1");
    });

    it("should disable a breakpoint", async () => {
      await dbg.disableBreakpoint("bp-1");
    });
  });

  describe("data query", () => {
    beforeEach(async () => {
      dbg = new Debugger(config);
      await dbg.connect();
    });

    it("should get locals", async () => {
      const locals = await dbg.locals();
      expect(locals).toHaveLength(1);
      expect(locals[0]!.name).toBe("count");
    });

    it("should get threads", async () => {
      const threads = await dbg.threads();
      expect(threads).toHaveLength(1);
    });

    it("should get stack", async () => {
      const stack = await dbg.stack();
      expect(stack).toHaveLength(1);
    });

    it("should evaluate an expression", async () => {
      const result = await dbg.evaluate("2 + 2");
      expect(result).toBeDefined();
    });

    it("should inspect a variable", async () => {
      const detail = await dbg.inspect("count");
      expect(detail).toBeDefined();
      expect(detail!.name).toBe("count");
    });
  });

  describe("event system", () => {
    beforeEach(async () => {
      dbg = new Debugger(config);
      await dbg.connect();
    });

    it("should support on/off handlers", () => {
      const handler = vi.fn();
      dbg.on("breakpoint", handler);
      dbg.off("breakpoint", handler);
    });
  });

  describe("watch mechanism", () => {
    beforeEach(async () => {
      dbg = new Debugger(config);
      await dbg.connect();
    });

    it("should watch a variable", async () => {
      const callback = vi.fn();
      const watch = await dbg.watchVariable("count", callback, { interval: 50, timeout: 200 });
      expect(watch.active).toBe(true);
      watch.cancel();
      expect(watch.active).toBe(false);
    });

    it("should cancel a watch", async () => {
      const watch = await dbg.watchVariable("count", vi.fn(), { interval: 50, timeout: 200 });
      dbg.unwatch(watch);
      expect(watch.active).toBe(false);
    });

    it("should watch an expression", async () => {
      const watch = await dbg.watchExpression("2 + 2", vi.fn(), { interval: 50, timeout: 200 });
      expect(watch.active).toBe(true);
      watch.cancel();
    });
  });

  describe("session management", () => {
    beforeEach(async () => {
      dbg = new Debugger(config);
      await dbg.connect();
    });

    it("should provide session info", () => {
      const info = dbg.info;
      expect(info.id).toBe("session-1");
      expect(info.protocol).toBe("jdwp");
    });

    it("should support thread switching", () => {
      const result = dbg.useThread("thread-2");
      expect(result).toBe(dbg);
    });

    it("should support frame switching", () => {
      const result = dbg.useFrame(2);
      expect(result).toBe(dbg);
    });
  });

  describe("query and assert modules", () => {
    beforeEach(async () => {
      dbg = new Debugger(config);
      await dbg.connect();
    });

    it("should provide query module", () => {
      expect(dbg.query).toBeDefined();
    });

    it("should provide assert module", () => {
      expect(dbg.assert).toBeDefined();
    });

    it("should provide format module", () => {
      expect(dbg.format).toBeDefined();
    });
  });
});