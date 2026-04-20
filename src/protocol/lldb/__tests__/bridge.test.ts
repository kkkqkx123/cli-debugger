/**
 * Tests for LLDB Bridge
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { LLDBBridge } from "../bridge.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

describe("LLDBBridge", () => {
  let bridge: LLDBBridge;
  let mockProcess: {
    stdin: { write: ReturnType<typeof vi.fn> };
    stdout: { on: ReturnType<typeof vi.fn> };
    stderr: { on: ReturnType<typeof vi.fn> };
    on: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
  };

  beforeEach(() => {
    bridge = new LLDBBridge({ timeout: 5000 });

    mockProcess = {
      stdin: { write: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("start", () => {
    it("should spawn Python process with correct arguments", async () => {
      const startPromise = bridge.start();

      // Trigger the 'on' callback for stdout
      const stdoutOnCall = mockProcess.stdout.on.mock.calls.find(
        (call) => call[0] === "data",
      );
      expect(stdoutOnCall).toBeDefined();

      // Trigger the 'on' callback for stderr
      const stderrOnCall = mockProcess.stderr.on.mock.calls.find(
        (call) => call[0] === "data",
      );
      expect(stderrOnCall).toBeDefined();

      await startPromise;

      expect(spawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining([expect.stringContaining("lldb_bridge.py")]),
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    });

    it("should not spawn again if already started", async () => {
      await bridge.start();
      await bridge.start();

      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe("call", () => {
    it("should throw error if process not started", async () => {
      await expect(bridge.call("threads", {})).rejects.toThrow(
        "Bridge process not running",
      );
    });

    it("should send request and wait for response", async () => {
      await bridge.start();

      const callPromise = bridge.call<{ success: boolean }>("version", {});

      // Get the stdout data handler
      const stdoutOnCall = mockProcess.stdout.on.mock.calls.find(
        (call) => call[0] === "data",
      );
      const dataHandler = stdoutOnCall?.[1] as (data: Buffer) => void;

      // Simulate response
      const response = JSON.stringify({
        id: 1,
        result: { success: true },
      });
      dataHandler(Buffer.from(response + "\n"));

      const result = await callPromise;
      expect(result).toEqual({ success: true });

      // Verify request was sent
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"method":"version"'),
      );
    });

    it("should handle error response", async () => {
      await bridge.start();

      const callPromise = bridge.call("unknown", {});

      // Get the stdout data handler
      const stdoutOnCall = mockProcess.stdout.on.mock.calls.find(
        (call) => call[0] === "data",
      );
      const dataHandler = stdoutOnCall?.[1] as (data: Buffer) => void;

      // Simulate error response
      const response = JSON.stringify({
        id: 1,
        error: { code: "UNKNOWN_METHOD", message: "Unknown method: unknown" },
      });
      dataHandler(Buffer.from(response + "\n"));

      await expect(callPromise).rejects.toThrow("Unknown method: unknown");
    });
  });

  describe("stop", () => {
    it("should kill process on stop", async () => {
      await bridge.start();

      // Mock the call to disconnect to resolve immediately
      mockProcess.stdin.write.mockImplementation(() => {
        // Simulate immediate response
        const stdoutOnCall = mockProcess.stdout.on.mock.calls.find(
          (call) => call[0] === "data",
        );
        if (stdoutOnCall) {
          const dataHandler = stdoutOnCall[1] as (data: Buffer) => void;
          dataHandler(Buffer.from(JSON.stringify({ id: 1, result: { success: true } }) + "\n"));
        }
      });

      await bridge.stop();
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it("should do nothing if not started", async () => {
      await bridge.stop();
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe("isRunning", () => {
    it("should return false if not started", () => {
      expect(bridge.isRunning()).toBe(false);
    });

    it("should return true if started", async () => {
      await bridge.start();
      expect(bridge.isRunning()).toBe(true);
    });
  });
});
