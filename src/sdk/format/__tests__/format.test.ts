/**
 * Tests for SDK Format Module
 */

import { describe, it, expect } from "vitest";
import { createFormat } from "../index.js";
import type { Variable, StackFrame, ThreadInfo, BreakpointInfo, DebugEvent } from "../../../types/debug.js";

describe("Format Module", () => {
  const format = createFormat();

  // ─── Variable Formatting ───────────────────────────────────────────────────

  describe("variable", () => {
    it("should format a primitive variable", () => {
      const v: Variable = { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false };
      expect(format.variable(v)).toBe("int count = 42");
    });

    it("should format a string variable", () => {
      const v: Variable = { name: "name", type: "string", value: "hello", isPrimitive: true, isNull: false };
      expect(format.variable(v)).toBe("string name = hello");
    });

    it("should format a null variable", () => {
      const v: Variable = { name: "obj", type: "Object", value: null, isPrimitive: false, isNull: true };
      expect(format.variable(v)).toBe("Object obj = null");
    });

    it("should truncate long values", () => {
      const longVal = "x".repeat(1000);
      const v: Variable = { name: "data", type: "string", value: longVal, isPrimitive: true, isNull: false };
      const result = format.variable(v, { truncate: true, maxValueLength: 50 });
      expect(result.length).toBeLessThan(longVal.length + 50);
      expect(result).toContain("[truncated");
    });

    it("should not truncate when truncate is false", () => {
      const longVal = "x".repeat(1000);
      const v: Variable = { name: "data", type: "string", value: longVal, isPrimitive: true, isNull: false };
      const result = format.variable(v, { truncate: false });
      expect(result).toContain(longVal);
    });
  });

  describe("variables", () => {
    it("should format multiple variables", () => {
      const vars: Variable[] = [
        { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false },
        { name: "name", type: "string", value: "hello", isPrimitive: true, isNull: false },
      ];
      const result = format.variables(vars);
      expect(result).toContain("int count = 42");
      expect(result).toContain("string name = hello");
    });

    it("should handle empty variable list", () => {
      expect(format.variables([])).toContain("no variables");
    });
  });

  // ─── Stack Formatting ──────────────────────────────────────────────────────

  describe("stack", () => {
    it("should format stack frames", () => {
      const frames: StackFrame[] = [
        { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
        { id: "2", method: "App.run", location: "App.java", line: 10, isNative: false },
      ];
      const result = format.stack(frames);
      expect(result).toContain("#0");
      expect(result).toContain("#1");
      expect(result).toContain("App.main");
      expect(result).toContain("App.java:42");
    });

    it("should mark native frames", () => {
      const frames: StackFrame[] = [
        { id: "1", method: "Native.func", location: "native", line: 0, isNative: true },
      ];
      const result = format.stack(frames);
      expect(result).toContain("[native]");
    });

    it("should handle empty stack", () => {
      expect(format.stack([])).toContain("empty stack");
    });
  });

  // ─── Thread Formatting ─────────────────────────────────────────────────────

  describe("threads", () => {
    it("should format thread list", () => {
      const threads: ThreadInfo[] = [
        { id: "1", name: "main", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
        { id: "2", name: "worker", state: "SUSPENDED", status: "suspended", isSuspended: true, isDaemon: false, priority: 5, createdAt: new Date() },
      ];
      const result = format.threads(threads);
      expect(result).toContain("main");
      expect(result).toContain("worker");
      expect(result).toContain("SUSPENDED");
      expect(result).toContain("RUNNING");
    });

    it("should handle empty thread list", () => {
      expect(format.threads([])).toContain("no threads");
    });
  });

  // ─── Breakpoint Formatting ─────────────────────────────────────────────────

  describe("breakpoints", () => {
    it("should format breakpoint list", () => {
      const bps: BreakpointInfo[] = [
        { id: "bp-1", location: "App.java:42", enabled: true, hitCount: 3 },
        { id: "bp-2", location: "App.java:50", enabled: false, hitCount: 0 },
      ];
      const result = format.breakpoints(bps);
      expect(result).toContain("bp-1");
      expect(result).toContain("bp-2");
      expect(result).toContain("enabled");
      expect(result).toContain("disabled");
      expect(result).toContain("hits: 3");
    });

    it("should show condition when present", () => {
      const bps: BreakpointInfo[] = [
        { id: "bp-1", location: "App.java:42", enabled: true, hitCount: 0, condition: "i > 5" },
      ];
      const result = format.breakpoints(bps);
      expect(result).toContain("i > 5");
    });

    it("should handle empty breakpoint list", () => {
      expect(format.breakpoints([])).toContain("no breakpoints");
    });
  });

  // ─── Event Formatting ──────────────────────────────────────────────────────

  describe("event", () => {
    it("should format a debug event", () => {
      const event: DebugEvent = {
        type: "breakpoint",
        threadId: "1",
        location: "App.java:42",
        timestamp: new Date("2026-01-01T00:00:00Z"),
      };
      const result = format.event(event);
      expect(result).toContain("breakpoint");
      expect(result).toContain("thread=1");
      expect(result).toContain("App.java:42");
    });
  });

  // ─── JSON Formatting ───────────────────────────────────────────────────────

  describe("json", () => {
    it("should format data as JSON", () => {
      const result = format.json({ a: 1, b: "hello" });
      expect(result).toBe('{"a":1,"b":"hello"}');
    });

    it("should pretty-print JSON", () => {
      const result = format.json({ a: 1 }, true);
      expect(result).toContain("\n");
    });
  });

  // ─── Table Formatting ──────────────────────────────────────────────────────

  describe("table", () => {
    it("should format a table from headers and rows", () => {
      const result = format.table(["Name", "Value"], [["count", "42"], ["name", "hello"]]);
      expect(result).toContain("Name");
      expect(result).toContain("Value");
      expect(result).toContain("count");
      expect(result).toContain("hello");
    });

    it("should handle empty headers", () => {
      expect(format.table([], [])).toBe("");
    });
  });

  // ─── Text Formatting ───────────────────────────────────────────────────────

  describe("text", () => {
    it("should format null", () => {
      expect(format.text(null)).toBe("null");
    });

    it("should format undefined", () => {
      expect(format.text(undefined)).toBe("undefined");
    });

    it("should format strings", () => {
      expect(format.text("hello")).toBe("hello");
    });

    it("should format objects", () => {
      const result = format.text({ a: 1 });
      expect(result).toContain("a");
      expect(result).toContain("1");
    });

    it("should format numbers", () => {
      expect(format.text(42)).toBe("42");
    });
  });
});