/**
 * Tests for SDK Event System (DebuggerEventEmitter)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebuggerEventEmitter } from "../events.js";
import type { DebugEvent } from "../../types/debug.js";

// ─── Mock Protocol Client ────────────────────────────────────────────────────

function createMockClient() {
  return {
    waitForEvent: vi.fn() as any,
  } as any;
}

function makeEvent(overrides: Partial<DebugEvent> = {}): DebugEvent {
  return {
    type: "breakpoint",
    threadId: "1",
    location: "test.ts:42",
    timestamp: new Date(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DebuggerEventEmitter", () => {
  let emitter: DebuggerEventEmitter;
  let client: any;

  beforeEach(() => {
    emitter = new DebuggerEventEmitter();
    client = createMockClient();
  });

  afterEach(() => {
    emitter.stopPolling();
    emitter.removeAllListeners();
  });

  describe("construction", () => {
    it("should start with polling not active", () => {
      expect(emitter.isPolling()).toBe(false);
    });
  });

  describe("startPolling / stopPolling", () => {
    it("should start polling", () => {
      emitter.startPolling(client);
      expect(emitter.isPolling()).toBe(true);
    });

    it("should stop polling", () => {
      emitter.startPolling(client);
      emitter.stopPolling();
      expect(emitter.isPolling()).toBe(false);
    });

    it("should not start polling twice", () => {
      emitter.startPolling(client);
      emitter.startPolling(client); // second call is no-op
      expect(emitter.isPolling()).toBe(true);
    });
  });

  describe("event dispatch", () => {
    it("should dispatch breakpoint events to registered handlers", async () => {
      const handler = vi.fn();
      emitter.on("breakpoint", handler);

      const event = makeEvent({ type: "breakpoint" });
      (client.waitForEvent as ReturnType<typeof vi.fn>).mockResolvedValue(event);

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event), { timeout: 1000 });
      emitter.stopPolling();
    });

    it("should dispatch output events", async () => {
      const handler = vi.fn();
      emitter.on("output", handler);

      const event = makeEvent({ type: "output" });
      (client.waitForEvent as ReturnType<typeof vi.fn>).mockResolvedValue(event);

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event), { timeout: 1000 });
      emitter.stopPolling();
    });

    it("should dispatch thread events", async () => {
      const handler = vi.fn();
      emitter.on("thread", handler);

      const event = makeEvent({ type: "thread" });
      (client.waitForEvent as ReturnType<typeof vi.fn>).mockResolvedValue(event);

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event), { timeout: 1000 });
      emitter.stopPolling();
    });

    it("should dispatch error events", async () => {
      const handler = vi.fn();
      emitter.on("error", handler);

      const event = makeEvent({ type: "error" });
      (client.waitForEvent as ReturnType<typeof vi.fn>).mockResolvedValue(event);

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event), { timeout: 1000 });
      emitter.stopPolling();
    });

    it("should dispatch state events", async () => {
      const handler = vi.fn();
      emitter.on("state", handler);

      const event = makeEvent({ type: "state" });
      (client.waitForEvent as ReturnType<typeof vi.fn>).mockResolvedValue(event);

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event), { timeout: 1000 });
      emitter.stopPolling();
    });

    it("should dispatch to wildcard '*' handler", async () => {
      const handler = vi.fn();
      emitter.on("*", handler);

      const event = makeEvent({ type: "breakpoint" });
      (client.waitForEvent as ReturnType<typeof vi.fn>).mockResolvedValue(event);

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event), { timeout: 1000 });
      emitter.stopPolling();
    });

    it("should handle null events (timeout) gracefully", async () => {
      const handler = vi.fn();
      emitter.on("breakpoint", handler);

      // Return null once, then a real event
      (client.waitForEvent as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(makeEvent({ type: "breakpoint" }));

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 1000 });
      emitter.stopPolling();
    });

    it("should handle polling errors gracefully", async () => {
      const handler = vi.fn();
      emitter.on("breakpoint", handler);

      (client.waitForEvent as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue(makeEvent({ type: "breakpoint" }));

      emitter.startPolling(client);
      await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 1000 });
      emitter.stopPolling();
    });
  });

  describe("on/off/once", () => {
    it("should register and unregister handlers", () => {
      const handler = vi.fn();
      emitter.on("breakpoint", handler);
      emitter.off("breakpoint", handler);

      // Simulate dispatch
      emitter.emit("breakpoint", makeEvent());
      expect(handler).not.toHaveBeenCalled();
    });

    it("should fire once handler only once", () => {
      const handler = vi.fn();
      emitter.once("breakpoint", handler);

      emitter.emit("breakpoint", makeEvent());
      emitter.emit("breakpoint", makeEvent());

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});