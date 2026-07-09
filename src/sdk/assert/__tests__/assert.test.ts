/**
 * Tests for SDK Assert Module
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAssert, AssertionError } from "../index.js";
import type { Debugger } from "../../debugger.js";

// ─── Mock Debugger ───────────────────────────────────────────────────────────

function createMockDebugger(overrides: Partial<Debugger> = {}): Debugger {
  const mock = {
    breakpoints: vi.fn() as any,
    locals: vi.fn() as any,
    evaluate: vi.fn() as any,
    getState: vi.fn() as any,
    threads: vi.fn() as any,
    stack: vi.fn() as any,
    ...overrides,
  } as unknown as Debugger;
  return mock;
}

describe("Assert Module", () => {
  let dbg: Debugger;

  beforeEach(() => {
    dbg = createMockDebugger();
  });

  // ─── Breakpoint Assertions ─────────────────────────────────────────────────

  describe("hitBreakpoint", () => {
    it("should pass when breakpoint is hit", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 3 },
      ]);

      const assert = createAssert(dbg);
      await assert.hitBreakpoint("bp-1");
    });

    it("should pass when hit count meets threshold", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 5 },
      ]);

      const assert = createAssert(dbg);
      await assert.hitBreakpoint("bp-1", 5);
    });

    it("should throw when breakpoint not found", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const assert = createAssert(dbg);
      await expect(assert.hitBreakpoint("bp-1", undefined, { timeout: 100 })).rejects.toThrow(AssertionError);
    });

    it("should throw when hit count is insufficient", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 1 },
      ]);

      const assert = createAssert(dbg);
      await expect(assert.hitBreakpoint("bp-1", 10, { timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  describe("notHitBreakpoint", () => {
    it("should pass when breakpoint has not been hit", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 0 },
      ]);

      const assert = createAssert(dbg);
      await assert.notHitBreakpoint("bp-1");
    });

    it("should throw when breakpoint has been hit", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 3 },
      ]);

      const assert = createAssert(dbg);
      await expect(assert.notHitBreakpoint("bp-1")).rejects.toThrow(AssertionError);
    });
  });

  describe("breakpointExists", () => {
    it("should pass when breakpoint exists at location", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 0 },
      ]);

      const assert = createAssert(dbg);
      await assert.breakpointExists("test.ts:10");
    });

    it("should throw when breakpoint does not exist", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const assert = createAssert(dbg);
      await expect(assert.breakpointExists("test.ts:10", { timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  describe("breakpointCount", () => {
    it("should pass when count matches", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 0 },
        { id: "bp-2", location: "test.ts:20", enabled: true, hitCount: 0 },
      ]);

      const assert = createAssert(dbg);
      await assert.breakpointCount(2);
    });

    it("should throw when count does not match", async () => {
      (dbg.breakpoints as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "bp-1", location: "test.ts:10", enabled: true, hitCount: 0 },
      ]);

      const assert = createAssert(dbg);
      await expect(assert.breakpointCount(3, { timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  // ─── Variable Assertions ───────────────────────────────────────────────────

  describe("variable", () => {
    it("should pass when variable equals expected value", async () => {
      (dbg.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false },
      ]);

      const assert = createAssert(dbg);
      await assert.variable("count", 42);
    });

    it("should throw when variable does not match", async () => {
      (dbg.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 99, isPrimitive: true, isNull: false },
      ]);

      const assert = createAssert(dbg);
      await expect(assert.variable("count", 42, { timeout: 100 })).rejects.toThrow(AssertionError);
    });

    it("should throw when variable is not found", async () => {
      (dbg.locals as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const assert = createAssert(dbg);
      await expect(assert.variable("missing", 42, { timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  describe("variableNot", () => {
    it("should pass when variable does not equal expected value", async () => {
      (dbg.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 99, isPrimitive: true, isNull: false },
      ]);

      const assert = createAssert(dbg);
      await assert.variableNot("count", 42);
    });
  });

  describe("variableSatisfies", () => {
    it("should pass when variable satisfies predicate", async () => {
      (dbg.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false },
      ]);

      const assert = createAssert(dbg);
      await assert.variableSatisfies("count", (v) => v === 42);
    });

    it("should throw when predicate fails", async () => {
      (dbg.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 10, isPrimitive: true, isNull: false },
      ]);

      const assert = createAssert(dbg);
      await expect(
        assert.variableSatisfies("count", (v) => v === 42, "count should be 42", { timeout: 100 }),
      ).rejects.toThrow(AssertionError);
    });
  });

  describe("variableType", () => {
    it("should pass when variable type matches", async () => {
      (dbg.locals as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false },
      ]);

      const assert = createAssert(dbg);
      await assert.variableType("count", "int");
    });
  });

  // ─── Expression Assertions ─────────────────────────────────────────────────

  describe("expression", () => {
    it("should pass when expression evaluates to expected value", async () => {
      (dbg.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({ value: 4, type: "int" });

      const assert = createAssert(dbg);
      await assert.expression("2 + 2", 4);
    });

    it("should throw when expression does not match", async () => {
      (dbg.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({ value: 5, type: "int" });

      const assert = createAssert(dbg);
      await expect(assert.expression("2 + 2", 42, { timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  describe("expressionThrows", () => {
    it("should pass when expression throws", async () => {
      (dbg.evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Division by zero"));

      const assert = createAssert(dbg);
      await assert.expressionThrows("1/0");
    });

    it("should pass when error matches pattern", async () => {
      (dbg.evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Division by zero"));

      const assert = createAssert(dbg);
      await assert.expressionThrows("1/0", "Division");
    });

    it("should pass when error matches regex", async () => {
      (dbg.evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Division by zero"));

      const assert = createAssert(dbg);
      await assert.expressionThrows("1/0", /division/i);
    });

    it("should throw when expression does not throw", async () => {
      (dbg.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({ value: 42, type: "int" });

      const assert = createAssert(dbg);
      await expect(assert.expressionThrows("42")).rejects.toThrow(AssertionError);
    });

    it("should throw when error does not match pattern", async () => {
      (dbg.evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Out of memory"));

      const assert = createAssert(dbg);
      await expect(assert.expressionThrows("bad()", "Division", { timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  // ─── Execution State Assertions ────────────────────────────────────────────

  describe("paused", () => {
    it("should pass when debugger is paused", async () => {
      (dbg.getState as ReturnType<typeof vi.fn>).mockReturnValue("paused");

      const assert = createAssert(dbg);
      await assert.paused();
    });

    it("should throw when debugger is not paused", async () => {
      (dbg.getState as ReturnType<typeof vi.fn>).mockReturnValue("running");

      const assert = createAssert(dbg);
      await expect(assert.paused({ timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  describe("running", () => {
    it("should pass when debugger is running", async () => {
      (dbg.getState as ReturnType<typeof vi.fn>).mockReturnValue("running");

      const assert = createAssert(dbg);
      await assert.running();
    });

    it("should pass when debugger is connected", async () => {
      (dbg.getState as ReturnType<typeof vi.fn>).mockReturnValue("connected");

      const assert = createAssert(dbg);
      await assert.running();
    });
  });

  describe("threadCount", () => {
    it("should pass when thread count matches", async () => {
      (dbg.threads as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", name: "main", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
        { id: "2", name: "worker", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
      ]);

      const assert = createAssert(dbg);
      await assert.threadCount(2);
    });
  });

  describe("stackDepth", () => {
    it("should pass when stack depth matches", async () => {
      (dbg.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "main", location: "App.java", line: 42, isNative: false },
        { id: "2", method: "run", location: "App.java", line: 10, isNative: false },
        { id: "3", method: "helper", location: "App.java", line: 5, isNative: false },
      ]);

      const assert = createAssert(dbg);
      await assert.stackDepth(3);
    });
  });

  describe("topFrame", () => {
    it("should pass when top frame method matches", async () => {
      (dbg.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
      ]);

      const assert = createAssert(dbg);
      await assert.topFrame("App.main");
    });

    it("should pass with partial match", async () => {
      (dbg.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
      ]);

      const assert = createAssert(dbg);
      await assert.topFrame("main");
    });

    it("should throw when top frame does not match", async () => {
      (dbg.stack as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "1", method: "App.run", location: "App.java", line: 10, isNative: false },
      ]);

      const assert = createAssert(dbg);
      await expect(assert.topFrame("main", { timeout: 100 })).rejects.toThrow(AssertionError);
    });
  });

  // ─── AssertionError ────────────────────────────────────────────────────────

  describe("AssertionError", () => {
    it("should have correct name and message", () => {
      const err = new AssertionError("test message", { expected: 1, actual: 2 });
      expect(err.name).toBe("AssertionError");
      expect(err.message).toBe("test message");
      expect(err.detail.expected).toBe(1);
      expect(err.detail.actual).toBe(2);
    });
  });
});