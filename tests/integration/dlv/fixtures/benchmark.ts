/**
 * Benchmark utilities for Delve performance testing
 * Provides tools to measure and analyze performance metrics
 */

/**
 * Benchmark result
 */
export interface DlvBenchmarkResult<T> {
  result: T;
  duration: number;
  iterations: number;
  average: number;
  min: number;
  max: number;
}

/**
 * Throughput result
 */
export interface DlvThroughputResult {
  operations: number;
  duration: number;
  opsPerSecond: number;
  avgLatencyMs: number;
}

/**
 * Memory usage snapshot
 */
export interface DlvMemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Benchmark utilities for Delve
 */
export class DlvBenchmark {
  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Measure execution time of a synchronous function
   */
  static measureTimeSync<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Run benchmark with multiple iterations
   */
  static async runBenchmark<T>(
    fn: () => Promise<T>,
    iterations: number = 100,
  ): Promise<DlvBenchmarkResult<T>> {
    const durations: number[] = [];
    let result: T | undefined;

    for (let i = 0; i < iterations; i++) {
      const { result: r, duration } = await this.measureTime(fn);
      result = r;
      durations.push(duration);
    }

    const total = durations.reduce((a, b) => a + b, 0);
    const average = total / iterations;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return {
      result: result!,
      duration: total,
      iterations,
      average,
      min,
      max,
    };
  }

  /**
   * Measure throughput (operations per second)
   */
  static async measureThroughput(
    fn: () => Promise<void>,
    durationMs: number = 1000,
  ): Promise<DlvThroughputResult> {
    let operations = 0;
    const start = Date.now();
    const latencies: number[] = [];

    while (Date.now() - start < durationMs) {
      const opStart = performance.now();
      await fn();
      const opDuration = performance.now() - opStart;
      latencies.push(opDuration);
      operations++;
    }

    const actualDuration = Date.now() - start;
    const opsPerSecond = (operations / actualDuration) * 1000;
    const avgLatencyMs =
      latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      operations,
      duration: actualDuration,
      opsPerSecond,
      avgLatencyMs,
    };
  }

  /**
   * Measure throughput with fixed iterations
   */
  static async measureThroughputFixed(
    fn: () => Promise<void>,
    iterations: number = 1000,
  ): Promise<DlvThroughputResult> {
    const start = performance.now();
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const opStart = performance.now();
      await fn();
      const opDuration = performance.now() - opStart;
      latencies.push(opDuration);
    }

    const duration = performance.now() - start;
    const opsPerSecond = (iterations / duration) * 1000;
    const avgLatencyMs =
      latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      operations: iterations,
      duration,
      opsPerSecond,
      avgLatencyMs,
    };
  }

  /**
   * Take memory snapshot
   */
  static takeMemorySnapshot(): DlvMemorySnapshot {
    const mem = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };
  }

  /**
   * Compare memory usage before and after
   */
  static async compareMemory<T>(
    fn: () => Promise<T>,
  ): Promise<{
    result: T;
    before: DlvMemorySnapshot;
    after: DlvMemorySnapshot;
    delta: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
  }> {
    const before = this.takeMemorySnapshot();
    const result = await fn();
    const after = this.takeMemorySnapshot();

    return {
      result,
      before,
      after,
      delta: {
        heapUsed: after.heapUsed - before.heapUsed,
        heapTotal: after.heapTotal - before.heapTotal,
        external: after.external - before.external,
        rss: after.rss - before.rss,
      },
    };
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Format duration to human readable string
   */
  static formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
    return `${(ms / 60000).toFixed(2)} min`;
  }

  /**
   * Format throughput to human readable string
   */
  static formatThroughput(opsPerSecond: number): string {
    if (opsPerSecond < 1000) return `${opsPerSecond.toFixed(2)} ops/s`;
    if (opsPerSecond < 1000000)
      return `${(opsPerSecond / 1000).toFixed(2)} K ops/s`;
    return `${(opsPerSecond / 1000000).toFixed(2)} M ops/s`;
  }
}
