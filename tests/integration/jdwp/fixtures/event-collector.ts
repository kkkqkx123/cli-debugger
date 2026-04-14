/**
 * Event collector for integration testing
 * Collects and manages debug events during tests
 */

import type { DebugEvent } from "../../../../src/types/debug.js";
import type { JDWPClient } from "../../../../src/protocol/jdwp/client.js";

/**
 * Event collector
 */
export class EventCollector {
  private events: DebugEvent[] = [];
  private collecting = false;

  /**
   * Collect events for a duration
   */
  async collect(client: JDWPClient, duration: number): Promise<DebugEvent[]> {
    this.collecting = true;
    this.events = [];
    const startTime = Date.now();

    while (this.collecting && Date.now() - startTime < duration) {
      try {
        const event = await client.waitForEvent(1000);
        if (event) {
          this.events.push(event);
        }
      } catch {
        // Ignore errors during collection
        break;
      }
    }

    this.collecting = false;
    return this.events;
  }

  /**
   * Collect events until count reached or timeout
   */
  async collectUntil(
    client: JDWPClient,
    count: number,
    timeout: number,
  ): Promise<DebugEvent[]> {
    this.collecting = true;
    this.events = [];
    const startTime = Date.now();

    while (
      this.collecting &&
      this.events.length < count &&
      Date.now() - startTime < timeout
    ) {
      try {
        const event = await client.waitForEvent(1000);
        if (event) {
          this.events.push(event);
        }
      } catch {
        // Ignore errors during collection
        break;
      }
    }

    this.collecting = false;
    return this.events;
  }

  /**
   * Stop collecting
   */
  stop(): void {
    this.collecting = false;
  }

  /**
   * Find events by type
   */
  findByType(type: string): DebugEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Find events by thread ID
   */
  findByThread(threadId: string): DebugEvent[] {
    return this.events.filter((e) => e.threadId === threadId);
  }

  /**
   * Get all collected events
   */
  getAll(): DebugEvent[] {
    return [...this.events];
  }

  /**
   * Get event count
   */
  getCount(): number {
    return this.events.length;
  }

  /**
   * Clear collected events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get first event
   */
  getFirst(): DebugEvent | undefined {
    return this.events[0];
  }

  /**
   * Get last event
   */
  getLast(): DebugEvent | undefined {
    return this.events[this.events.length - 1];
  }

  /**
   * Check if any events collected
   */
  hasEvents(): boolean {
    return this.events.length > 0;
  }

  /**
   * Wait for specific event type
   */
  async waitForEventType(
    client: JDWPClient,
    type: string,
    timeout: number,
  ): Promise<DebugEvent | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const event = await client.waitForEvent(1000);
        if (event && event.type === type) {
          return event;
        }
        if (event) {
          this.events.push(event);
        }
      } catch {
        // Ignore errors
        break;
      }
    }

    return null;
  }
}
