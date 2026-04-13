import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import { TextFormatter } from "../text.js";
import { JsonFormatter } from "../json.js";
import { TableFormatter } from "../table.js";
import { createFormatter } from "../index.js";
import type { ThreadInfo, StackFrame, VersionInfo } from "../../types/index.js";

// Mock writable stream for testing
class MockWritable extends Writable {
  public output: string = "";

  _write(chunk: Buffer, encoding: string, callback: () => void): void {
    this.output += chunk.toString();
    callback();
  }

  clear(): void {
    this.output = "";
  }
}

describe("Output Formatters", () => {
  const mockWriter = new MockWritable();

  const mockThreads: ThreadInfo[] = [
    { id: 1, name: "main", state: "RUNNABLE", isSuspended: false, priority: 5 },
    { id: 2, name: "worker", state: "WAITING", isSuspended: true, priority: 5 },
  ];

  const mockFrames: StackFrame[] = [
    {
      method: "main",
      location: "Main.java",
      line: 10,
      isNative: false,
    },
    {
      method: "run",
      location: "Worker.java",
      line: 25,
      isNative: true,
    },
  ];

  const mockVersion: VersionInfo = {
    protocolVersion: "1.0",
    runtimeName: "Java",
    runtimeVersion: "17",
    description: "Test VM",
  };

  describe("TextFormatter", () => {
    const formatter = new TextFormatter({ color: false });
    formatter.setWriter(mockWriter);

    it("should format threads", async () => {
      mockWriter.clear();
      await formatter.formatThreads(mockThreads);
      expect(mockWriter.output).toContain("Thread 1: main");
      expect(mockWriter.output).toContain("Thread 2: worker");
      expect(mockWriter.output).toContain("[RUNNING]");
      expect(mockWriter.output).toContain("[SUSPENDED]");
    });

    it("should format stack frames", async () => {
      mockWriter.clear();
      await formatter.formatStack(mockFrames);
      expect(mockWriter.output).toContain("#0 main at Main.java:10");
      expect(mockWriter.output).toContain("#1 run at Worker.java:25");
      expect(mockWriter.output).toContain("[native]");
    });

    it("should format version info", async () => {
      mockWriter.clear();
      await formatter.formatVersion(mockVersion);
      expect(mockWriter.output).toContain("Protocol: 1.0");
      expect(mockWriter.output).toContain("Runtime: Java 17");
      expect(mockWriter.output).toContain("Description: Test VM");
    });

    it("should format errors", async () => {
      mockWriter.clear();
      const error = new Error("Test error");
      await formatter.formatError(error);
      expect(mockWriter.output).toContain("Error: Test error");
    });
  });

  describe("JsonFormatter", () => {
    const formatter = new JsonFormatter();
    formatter.setWriter(mockWriter);

    it("should format threads as JSON", async () => {
      mockWriter.clear();
      await formatter.formatThreads(mockThreads);
      const output = JSON.parse(mockWriter.output);
      expect(output.type).toBe("threads");
      expect(output.data).toHaveLength(2);
      expect(output.data[0].name).toBe("main");
    });

    it("should format stack frames as JSON", async () => {
      mockWriter.clear();
      await formatter.formatStack(mockFrames);
      const output = JSON.parse(mockWriter.output);
      expect(output.type).toBe("stack");
      expect(output.data).toHaveLength(2);
      expect(output.data[0].method).toBe("main");
    });

    it("should format version as JSON", async () => {
      mockWriter.clear();
      await formatter.formatVersion(mockVersion);
      const output = JSON.parse(mockWriter.output);
      expect(output.type).toBe("version");
      expect(output.data.protocolVersion).toBe("1.0");
    });

    it("should format errors as JSON", async () => {
      mockWriter.clear();
      const error = new Error("Test error");
      await formatter.formatError(error);
      const output = JSON.parse(mockWriter.output);
      expect(output.type).toBe("error");
      expect(output.data.message).toBe("Test error");
    });
  });

  describe("TableFormatter", () => {
    const formatter = new TableFormatter({ color: false });
    formatter.setWriter(mockWriter);

    it("should format threads as table", async () => {
      mockWriter.clear();
      await formatter.formatThreads(mockThreads);
      expect(mockWriter.output).toContain("ID");
      expect(mockWriter.output).toContain("Name");
      expect(mockWriter.output).toContain("State");
      expect(mockWriter.output).toContain("main");
      expect(mockWriter.output).toContain("worker");
    });

    it("should format stack frames as table", async () => {
      mockWriter.clear();
      await formatter.formatStack(mockFrames);
      expect(mockWriter.output).toContain("#");
      expect(mockWriter.output).toContain("Method");
      expect(mockWriter.output).toContain("Location");
      expect(mockWriter.output).toContain("main");
      expect(mockWriter.output).toContain("run");
    });

    it("should format version as table", async () => {
      mockWriter.clear();
      await formatter.formatVersion(mockVersion);
      expect(mockWriter.output).toContain("Property");
      expect(mockWriter.output).toContain("Value");
      expect(mockWriter.output).toContain("Protocol");
      expect(mockWriter.output).toContain("1.0");
    });
  });

  describe("createFormatter factory", () => {
    it("should create text formatter", () => {
      const formatter = createFormatter({ type: "text" });
      expect(formatter).toBeInstanceOf(TextFormatter);
    });

    it("should create json formatter", () => {
      const formatter = createFormatter({ type: "json" });
      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it("should create table formatter", () => {
      const formatter = createFormatter({ type: "table" });
      expect(formatter).toBeInstanceOf(TableFormatter);
    });

    it("should set writer when provided", () => {
      const formatter = createFormatter({ type: "text", writer: mockWriter });
      expect(formatter).toBeInstanceOf(TextFormatter);
    });
  });
});
