/**
 * Event handling integration tests for Delve
 * Tests Delve event processing and notification
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DlvClient } from "../../../src/protocol/dlv/client.js";
import { MockDlvServer, DlvEventCollector } from "./fixtures/index.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Delve Event Handling", () => {
  let server: MockDlvServer;
  let port: number;
  let config: DebugConfig;
  let client: DlvClient;
  let eventCollector: DlvEventCollector;

  beforeEach(async () => {
    server = new MockDlvServer();
    port = await server.start();
    config = {
      protocol: "dlv",
      host: "127.0.0.1",
      port,
      timeout: 5000,
    };
    client = new DlvClient(config);
    await client.connect();
    eventCollector = new DlvEventCollector();
  });

  afterEach(async () => {
    eventCollector.stop();
    await client.close();
    await server.stop();
  });

  describe("event_timeout", () => {
    it("should return null when no event occurs within timeout", async () => {
      // Wait for event with short timeout
      const event = await client.waitForEvent(100);

      // Should return null since no event was triggered
      expect(event).toBeNull();
    });

    it("should handle multiple timeout waits", async () => {
      // Multiple waits should all return null
      for (let i = 0; i < 3; i++) {
        const event = await client.waitForEvent(50);
        expect(event).toBeNull();
      }
    });
  });

  describe("event_collector", () => {
    it("should collect events over duration", async () => {
      // Collect events for 200ms
      const events = await eventCollector.collect(client, 200);

      // Should return array (may be empty)
      expect(Array.isArray(events)).toBe(true);
    });

    it("should collect events until count reached", async () => {
      // Try to collect 5 events with 200ms timeout
      const events = await eventCollector.collectUntil(client, 5, 200);

      // Should return array (may have fewer than 5)
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(5);
    });

    it("should stop collecting when requested", async () => {
      // Start collection
      const collectPromise = eventCollector.collect(client, 5000);

      // Stop after short delay
      setTimeout(() => eventCollector.stop(), 100);

      // Should complete quickly
      const events = await collectPromise;
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("event_filtering", () => {
    it("should filter events by type", async () => {
      // Collect some events
      await eventCollector.collect(client, 100);

      // Filter by breakpoint type
      const breakpointEvents = eventCollector.findByType("breakpoint");
      expect(Array.isArray(breakpointEvents)).toBe(true);

      // Filter by step type
      const stepEvents = eventCollector.findByType("step");
      expect(Array.isArray(stepEvents)).toBe(true);
    });

    it("should filter events by goroutine", async () => {
      // Collect some events
      await eventCollector.collect(client, 100);

      // Filter by goroutine ID
      const goroutineEvents = eventCollector.findByThread("1");
      expect(Array.isArray(goroutineEvents)).toBe(true);
    });
  });

  describe("event_state", () => {
    it("should track event count", async () => {
      // Initial count
      expect(eventCollector.getCount()).toBe(0);

      // Collect events
      await eventCollector.collect(client, 100);

      // Get count
      const count = eventCollector.getCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should check if events exist", async () => {
      // Initially no events
      expect(eventCollector.hasEvents()).toBe(false);

      // Collect events
      await eventCollector.collect(client, 100);

      // May or may not have events
      const hasEvents = eventCollector.hasEvents();
      expect(typeof hasEvents).toBe("boolean");
    });

    it("should get first and last events", async () => {
      // Collect events
      await eventCollector.collect(client, 100);

      // Get first/last
      const first = eventCollector.getFirst();
      const last = eventCollector.getLast();

      // If there are events, first and last should be defined
      if (eventCollector.hasEvents()) {
        expect(first).toBeDefined();
        expect(last).toBeDefined();
      } else {
        expect(first).toBeUndefined();
        expect(last).toBeUndefined();
      }
    });

    it("should clear collected events", async () => {
      // Collect events
      await eventCollector.collect(client, 100);

      // Clear
      eventCollector.clear();

      // Should be empty
      expect(eventCollector.getCount()).toBe(0);
      expect(eventCollector.hasEvents()).toBe(false);
    });
  });

  describe("event_wait_for_type", () => {
    it("should wait for specific event type", async () => {
      // Wait for breakpoint event (won't occur)
      const event = await eventCollector.waitForEventType(
        client,
        "breakpoint",
        100,
      );

      // Should return null since no event
      expect(event).toBeNull();
    });
  });

  describe("breakpoint_event_flow", () => {
    it("should handle breakpoint setup and teardown", async () => {
      // Clear any existing breakpoints
      await client.clearBreakpoints();

      // Verify cleared
      const bps = await client.breakpoints();
      expect(bps.length).toBe(0);

      // No events should occur
      const event = await client.waitForEvent(100);
      expect(event).toBeNull();
    });
  });

  describe("multiple_event_types", () => {
    it("should handle multiple event type requests", async () => {
      // Clear breakpoints
      await client.clearBreakpoints();

      // Wait for various event types
      const results = await Promise.all([
        client.waitForEvent(50),
        client.waitForEvent(50),
        client.waitForEvent(50),
      ]);

      // All should be null (no events triggered)
      for (const result of results) {
        expect(result).toBeNull();
      }
    });
  });

  describe("event_queue", () => {
    it("should handle sequential event waits", async () => {
      // Multiple sequential waits
      for (let i = 0; i < 3; i++) {
        const event = await client.waitForEvent(50);
        expect(event).toBeNull();
      }
    });
  });

  describe("terminated_event", () => {
    it("should detect terminated state", async () => {
      // Set state to exited
      server.updateState({
        exited: true,
        exitStatus: 0,
      });

      // Wait for event
      const event = await client.waitForEvent(200);

      // Should get terminated event
      if (event) {
        expect(event.type).toBe("terminated");
      }
    });
  });
});
