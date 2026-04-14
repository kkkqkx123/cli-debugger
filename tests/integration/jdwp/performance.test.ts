/**
 * Performance benchmark tests
 * Measures performance of JDWP operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JDWPClient } from "../../../src/protocol/jdwp/client.js";
import { MockJDWPServer, Benchmark } from "./fixtures/index.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Performance Benchmarks", () => {
  let server: MockJDWPServer;
  let port: number;
  let config: DebugConfig;
  let client: JDWPClient;

  beforeEach(async () => {
    server = new MockJDWPServer();
    port = await server.start();
    config = {
      protocol: "jdwp",
      host: "127.0.0.1",
      port,
      timeout: 5000,
    };
    client = new JDWPClient(config);
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
      const { duration } = await Benchmark.measureTime(async () => {
        const newClient = new JDWPClient(config);
        await newClient.connect();
        await newClient.close();
      });

      // Connection should be fast for local server
      expect(duration).toBeLessThan(1000); // < 1 second

      console.log(`Connection time: ${Benchmark.formatDuration(duration)}`);
    });

    it("should measure multiple connection times", async () => {
      await client.close();

      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { duration } = await Benchmark.measureTime(async () => {
          const newClient = new JDWPClient(config);
          await newClient.connect();
          await newClient.close();
        });
        durations.push(duration);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / iterations;
      console.log(`Average connection time: ${Benchmark.formatDuration(avg)}`);

      // All should be reasonably fast
      for (const duration of durations) {
        expect(duration).toBeLessThan(2000);
      }
    });
  });

  describe("command_latency", () => {
    it("should measure version command latency", async () => {
      const { duration } = await Benchmark.measureTime(() => client.version());

      console.log(`Version command latency: ${Benchmark.formatDuration(duration)}`);

      // Should be fast for local server
      expect(duration).toBeLessThan(100);
    });

    it("should measure capabilities command latency", async () => {
      const { duration } = await Benchmark.measureTime(() =>
        client.capabilities(),
      );

      console.log(
        `Capabilities command latency: ${Benchmark.formatDuration(duration)}`,
      );

      expect(duration).toBeLessThan(100);
    });

    it("should measure threads command latency", async () => {
      const { duration } = await Benchmark.measureTime(() => client.threads());

      console.log(`Threads command latency: ${Benchmark.formatDuration(duration)}`);

      expect(duration).toBeLessThan(500);
    });
  });

  describe("throughput_commands", () => {
    it("should measure command throughput", async () => {
      const result = await Benchmark.measureThroughput(
        async () => {
          await client.version();
        },
        1000, // 1 second
      );

      console.log(`Command throughput: ${Benchmark.formatThroughput(result.opsPerSecond)}`);
      console.log(`Average latency: ${Benchmark.formatDuration(result.avgLatencyMs)}`);

      // Should handle at least 100 commands per second
      expect(result.opsPerSecond).toBeGreaterThan(100);
    });

    it("should measure metadata command throughput", async () => {
      const result = await Benchmark.measureThroughputFixed(
        async () => {
          await client.version();
          await client.capabilities();
        },
        100, // 100 iterations
      );

      console.log(
        `Metadata throughput: ${Benchmark.formatThroughput(result.opsPerSecond)}`,
      );

      expect(result.operations).toBe(100);
    });
  });

  describe("concurrent_performance", () => {
    it("should measure concurrent command performance", async () => {
      const concurrentCount = 10;

      const { duration } = await Benchmark.measureTime(async () => {
        const promises = [];
        for (let i = 0; i < concurrentCount; i++) {
          promises.push(client.version());
        }
        await Promise.all(promises);
      });

      console.log(
        `${concurrentCount} concurrent commands: ${Benchmark.formatDuration(duration)}`,
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

      console.log(`Sequential ${count} commands: ${Benchmark.formatDuration(sequentialDuration)}`);
      console.log(`Concurrent ${count} commands: ${Benchmark.formatDuration(concurrentDuration)}`);

      // Concurrent should be faster or similar
      expect(concurrentDuration).toBeLessThanOrEqual(sequentialDuration * 1.5);
    });
  });

  describe("memory_usage", () => {
    it("should measure memory usage", async () => {
      const snapshot = Benchmark.takeMemorySnapshot();

      console.log(`Heap used: ${Benchmark.formatBytes(snapshot.heapUsed)}`);
      console.log(`Heap total: ${Benchmark.formatBytes(snapshot.heapTotal)}`);
      console.log(`RSS: ${Benchmark.formatBytes(snapshot.rss)}`);

      expect(snapshot.heapUsed).toBeGreaterThan(0);
    });

    it("should compare memory before and after operations", async () => {
      const { delta } = await Benchmark.compareMemory(async () => {
        // Perform some operations
        for (let i = 0; i < 100; i++) {
          await client.version();
        }
      });

      console.log(`Memory delta: ${Benchmark.formatBytes(delta.heapUsed)}`);

      // Memory should not grow excessively
      expect(delta.heapUsed).toBeLessThan(10 * 1024 * 1024); // < 10MB
    });
  });

  describe("large_data_handling", () => {
    it("should handle large thread lists", async () => {
      // Configure server with many threads
      server.updateState({
        threads: Array.from({ length: 100 }, (_, i) => ({
          id: `${i + 1}`,
          name: `Thread-${i + 1}`,
          status: i === 0 ? 2 : 4,
          suspendStatus: 0,
        })),
      });

      const { duration } = await Benchmark.measureTime(() => client.threads());

      console.log(`100 threads query: ${Benchmark.formatDuration(duration)}`);

      expect(duration).toBeLessThan(1000);
    });
  });

  describe("benchmark_utilities", () => {
    it("should format bytes correctly", () => {
      expect(Benchmark.formatBytes(100)).toBe("100 B");
      expect(Benchmark.formatBytes(1024)).toBe("1.00 KB");
      expect(Benchmark.formatBytes(1024 * 1024)).toBe("1.00 MB");
    });

    it("should format duration correctly", () => {
      expect(Benchmark.formatDuration(0.5)).toBe("500.00 μs");
      expect(Benchmark.formatDuration(100)).toBe("100.00 ms");
      expect(Benchmark.formatDuration(1500)).toBe("1.50 s");
    });

    it("should format throughput correctly", () => {
      expect(Benchmark.formatThroughput(100)).toBe("100.00 ops/s");
      expect(Benchmark.formatThroughput(1500)).toBe("1.50 K ops/s");
      expect(Benchmark.formatThroughput(1500000)).toBe("1.50 M ops/s");
    });
  });
});
