/**
 * Tests for CLI Formatter Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock process.stdout.write before importing
const stdoutWrite = vi.fn();
beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(stdoutWrite);
});
afterEach(() => {
  vi.restoreAllMocks();
});

import {
  writeContext,
  writeMessage,
  writeError,
  writeSuccess,
  writeResult,
  writeTable,
} from "../formatter.js";

describe("CLI Formatter", () => {
  describe("writeMessage", () => {
    it("should write a message in text mode", () => {
      writeMessage("hello", "text");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("hello"));
    });

    it("should write a message in json mode", () => {
      writeMessage("hello", "json");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("hello"));
    });
  });

  describe("writeError", () => {
    it("should write an error in text mode", () => {
      writeError("something went wrong", "text");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("something went wrong"));
    });

    it("should write an error in json mode", () => {
      writeError("err", "json");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("err"));
    });
  });

  describe("writeSuccess", () => {
    it("should write a success in text mode", () => {
      writeSuccess("done", "text");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("done"));
    });
  });

  describe("writeResult", () => {
    it("should write a result in text mode", () => {
      writeResult("key", "value", "text");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("value"));
    });

    it("should write a result in json mode", () => {
      writeResult("count", 42, "json");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("42"));
    });
  });

  describe("writeTable", () => {
    it("should write a table with headers and rows", () => {
      writeTable(["Name", "Value"], [["count", "42"], ["name", "hello"]], "text");
      const output = stdoutWrite.mock.calls.map((c: any) => c[0]).join("");
      expect(output).toContain("Name");
      expect(output).toContain("Value");
      expect(output).toContain("count");
    });

    it("should handle empty data", () => {
      writeTable(["Name"], [], "text");
      expect(stdoutWrite).toHaveBeenCalled();
    });

    it("should write table in json mode", () => {
      writeTable(["Name"], [["Alice"]], "json");
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("Alice"));
    });
  });

  describe("writeContext", () => {
    it("should write context with location", () => {
      writeContext(
        {
          location: { file: "App.java", line: 42, method: "App.main" },
          locals: [
            { name: "count", type: "int", value: 42, isPrimitive: true, isNull: false },
          ],
        },
        "text",
      );
      const output = stdoutWrite.mock.calls.map((c: any) => c[0]).join("");
      expect(output).toContain("App.java");
      expect(output).toContain("42");
      expect(output).toContain("count");
    });

    it("should write context without location", () => {
      writeContext({}, "text");
      expect(stdoutWrite).toHaveBeenCalled();
    });

    it("should write context with threads", () => {
      writeContext(
        {
          threads: [
            { id: "1", name: "main", state: "RUNNING", status: "running", isSuspended: false, isDaemon: false, priority: 5, createdAt: new Date() },
          ],
        },
        "text",
      );
      const output = stdoutWrite.mock.calls.map((c: any) => c[0]).join("");
      expect(output).toContain("main");
    });

    it("should write context with source context", () => {
      writeContext(
        {
          location: { file: "App.java", line: 42, method: "App.main" },
          sourceContext: [">   42|   int x = 42;", "    43|   int y = x + 1;"],
        },
        "text",
      );
      const output = stdoutWrite.mock.calls.map((c: any) => c[0]).join("");
      expect(output).toContain("42|");
    });

    it("should write context with stack", () => {
      writeContext(
        {
          stack: [
            { id: "1", method: "App.main", location: "App.java", line: 42, isNative: false },
          ],
        },
        "text",
      );
      const output = stdoutWrite.mock.calls.map((c: any) => c[0]).join("");
      expect(output).toContain("App.main");
    });

    it("should write context in json mode", () => {
      writeContext(
        { location: { file: "App.java", line: 42, method: "main" } },
        "json",
      );
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("App.java"));
    });
  });
});