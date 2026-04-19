/**
 * Performance benchmark tests for Delve
 * Measures performance of Delve operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DlvClient } from "../../../src/protocol/dlv/client.js";
import { MockDlvServer, DlvBenchmark } from "./fixtures/index.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Delve Performance Benchmarks", () => {
  let server: MockDlvServer;
  let port: number;
  let config: DebugConfig;
  let client: DlvClient;

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
  });

  afterEach(async () => {
    await client.close();
    await server.stop();
  });

  describe("connection_time", () => {
    it("should measure connection time", async () => {
      // Close existing connection
      await client.close();

      // Measure connection time
      const { duration } = await DlvBenchmark.measureTime(async () => {
        const newClient = new DlvClient(config);
        await newClient.connect();
        await newClient.close();
      });

      // Connection should be fast for local server
      expect(duration).toBeLessThan(1000); // < 1 second

      console.log(`Connection time: ${DlvBenchmark.formatDuration(duration)}`);
    });

    it("should measure multiple connection times", async () => {
      await client.close();

      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { duration } = await DlvBenchmark.measureTime(async () => {
          const newClient = new DlvClient(config);
          await newClient.connect();
          await newClient.close();
        });
        durations.push(duration);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / iterations;
      console.log(`Average connection time: ${DlvBenchmark.formatDuration(avg)}`);

      // All should be reasonably fast
      for (const duration of durations) {
        expect(duration).toBeLessThan(2000);
      }
    });
  });

  describe("command_latency", () => {
    it("should measure version command latency", async () => {
      const { duration } = await DlvBenchmark.measureTime(() => client.version());

      console.log(`Version command latency: ${DlvBenchmark.formatDuration(duration)}`);

      // Should be fast for local server
      expect(duration).toBeLessThan(100);
    });

    it("should measure capabilities command latency", async () => {
      const { duration } = await DlvBenchmark.measureTime(() =>
        client.capabilities(),
      );

      console.log(
        `Capabilities command latency: ${DlvBenchmark.formatDuration(duration)}`,
      );

      expect(duration).toBeLessThan(100);
    });

    it("should measure threads command latency", async () => {
      const { duration } = await DlvBenchmark.measureTime(() => client.threads());

      console.log(`Threads command latency: ${DlvBenchmark.formatDuration(duration)}`);

      expect(duration).toBeLessThan(500);
    });
  });

  describe("throughput_commands", () => {
    it("should measure command throughput", async () => {
      const result = await DlvBenchmark.measureThroughput(
        async () => {
          await client.version();
        },
        1000, // 1 second
      );

      console.log(`Command throughput: ${DlvBenchmark.formatThroughput(result.opsPerSecond)}`);
      console.log(`Average latency: ${DlvBenchmark.formatDuration(result.avgLatencyMs)}`);

      // Should handle at least 50 commands per second (relaxed for CI environments)
      expect(result.opsPerSecond).toBeGreaterThan(50);
    });

    it("should measure metadata command throughput", async () => {
      const result = await DlvBenchmark.measureThroughputFixed(
        async () => {
          await client.version();
          await client.capabilities();
        },
        100, // 100 iterations
      );

      console.log(
        `Metadata throughput: ${DlvBenchmark.formatThroughput(result.opsPerSecond)}`,
      );

      expect(result.operations).toBe(100);
    });
  });

  describe("concurrent_performance", () => {
    it("should measure concurrent command performance", async () => {
      const concurrentCount = 10;

      const { duration } = await DlvBenchmark.measureTime(async () => {
        const promises = [];
        for (let i = 0; i < concurrentCount; i++) {
          promises.push(client.version());
        }
        await Promise.all(promises);
      });

      console.log(
        `${concurrentCount} concurrent commands: ${DlvBenchmark.formatDuration(duration)}`,
      );

      // Concurrent should be faster than sequential
      expect(duration).toBeLessThan(1000);
    });

    it("should compare sequential vs concurrent", async () => {
      const count = 10;

      // Sequential
      const sequentialStart = performance.now();
      for (let i = 0; i < count; i++) {
        await client.version();
      }
      const sequentialDuration = performance.now() - sequentialStart;

      // Concurrent
      const concurrentStart = performance.now();
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(client.version());
      }
      await Promise.all(promises);
      const concurrentDuration = performance.now() - concurrentStart;

      console.log(`Sequential ${count} commands: ${DlvBenchmark.formatDuration(sequentialDuration)}`);
      console.log(`Concurrent ${count} commands: ${DlvBenchmark.formatDuration(concurrentDuration)}`);

      // Concurrent should be faster or similar
      expect(concurrentDuration).toBeLessThanOrEqual(sequentialDuration * 1.5);
    });
  });

  describe("memory_usage", () => {
    it("should measure memory usage", async () => {
      const snapshot = DlvBenchmark.takeMemorySnapshot();

      console.log(`Heap used: ${DlvBenchmark.formatBytes(snapshot.heapUsed)}`);
      console.log(`Heap total: ${DlvBenchmark.formatBytes(snapshot.heapTotal)}`);
      console.log(`RSS: ${DlvBenchmark.formatBytes(snapshot.rss)}`);

      expect(snapshot.heapUsed).toBeGreaterThan(0);
    });

    it("should compare memory before and after operations", async () => {
      const { delta } = await DlvBenchmark.compareMemory(async () => {
        // Perform some operations
        for (let i = 0; i < 100; i++) {
          await client.version();
        }
      });

      console.log(`Memory delta: ${DlvBenchmark.formatBytes(delta.heapUsed)}`);

      // Memory should not grow excessively
      expect(delta.heapUsed).toBeLessThan(10 * 1024 * 1024); // < 10MB
    });
  });

  describe("large_data_handling", () => {
    it("should handle large goroutine lists", async () => {
      // Configure server with many goroutines
      server.updateState({
        goroutines: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          userCurrentLoc: {
            file: "main.go",
            line: 10 + i,
            function: { name: i === 0 ? "main.main" : `worker.work${i}` },
          },
          systemStack: false,
          threadId: i + 1,
        })),
      });

      const { duration } = await DlvBenchmark.measureTime(() => client.threads());

      console.log(`100 goroutines query: ${DlvBenchmark.formatDuration(duration)}`);

      // Should handle 100 goroutines quickly
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });

  describe("benchmark_utilities", () => {
    it("should format bytes correctly", () => {
      expect(DlvBenchmark.formatBytes(100)).toBe("100 B");
      expect(DlvBenchmark.formatBytes(1024)).toBe("1.00 KB");
      expect(DlvBenchmark.formatBytes(1024 * 1024)).toBe("1.00 MB");
    });

    it("should format duration correctly", () => {
      expect(DlvBenchmark.formatDuration(0.5)).toBe("500.00 μs");
      expect(DlvBenchmark.formatDuration(100)).toBe("100.00 ms");
      expect(DlvBenchmark.formatDuration(1500)).toBe("1.50 s");
    });

    it("should format throughput correctly", () => {
      expect(DlvBenchmark.formatThroughput(100)).toBe("100.00 ops/s");
      expect(DlvBenchmark.formatThroughput(1500)).toBe("1.50 K ops/s");
      expect(DlvBenchmark.formatThroughput(1500000)).toBe("1.50 M ops/s");
    });
  });
});
