/**
 * Assert Module
 *
 * Timeout-based assertion engine for debugger automation testing.
 * Inspired by Playwright's auto-waiting — polls the debug target until
 * the assertion passes or the timeout expires.
 *
 * @example
 * ```ts
 * import { createAssert } from '@cli-debugger/sdk/assert';
 *
 * const assert = createAssert(dbg);
 * await assert.hitBreakpoint('bp-1', { timeout: 10000 });
 * await assert.variable('count', 42);
 * await assert.topFrame('App.main');
 * ```
 */

import type { Debugger } from "../debugger.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Options for assertion methods */
export interface AssertOptions {
  /** Maximum time to wait in milliseconds (default: 5000) */
  timeout?: number;
  /** Thread ID to scope the assertion */
  threadId?: string;
  /** Stack frame index to scope the assertion */
  frameIndex?: number;
}

/** Options for expression assertions */
export interface EvalAssertOptions extends AssertOptions {
  /** Whether expression evaluation failure should be treated as assertion failure */
  errorOnFailure?: boolean;
}

/** Options for topFrame assertion */
export interface TopFrameOptions {
  /** Maximum time to wait in milliseconds (default: 5000) */
  timeout?: number;
  /** Thread ID to check */
  threadId?: string;
}

// ─── Assertion Error ─────────────────────────────────────────────────────────

/**
 * Custom error thrown when an assertion fails.
 * Provides structured diagnostic information.
 */
export class AssertionError extends Error {
  constructor(
    message: string,
    public readonly detail: {
      expected: unknown;
      actual: unknown;
      name?: string;
    },
  ) {
    super(message);
    this.name = "AssertionError";
  }
}

// ─── Assert Module ───────────────────────────────────────────────────────────

export type AssertModule = ReturnType<typeof createAssert>;

/**
 * Create a bound assert module for a Debugger instance.
 *
 * @param dbg - A connected Debugger instance
 * @returns An assert object with all assertion methods
 */
export function createAssert(dbg: Debugger) {
  const engine = new AssertEngine(dbg);

  return {
    // ─── Breakpoint Assertions ───

    /**
     * Assert that a breakpoint has been hit a specific number of times.
     * @param id - Breakpoint ID
     * @param times - Expected hit count (default: at least 1)
     * @param options - Assertion options
     */
    async hitBreakpoint(
      id: string,
      times?: number,
      options?: AssertOptions,
    ): Promise<void> {
      return engine.hitBreakpoint(id, times, options);
    },

    /**
     * Assert that a breakpoint has NOT been hit.
     * @param id - Breakpoint ID
     * @param options - Assertion options
     */
    async notHitBreakpoint(id: string, options?: AssertOptions): Promise<void> {
      return engine.notHitBreakpoint(id, options);
    },

    /**
     * Assert that a breakpoint exists at the given location.
     * @param location - Breakpoint location string
     * @param options - Assertion options
     */
    async breakpointExists(
      location: string,
      options?: AssertOptions,
    ): Promise<void> {
      return engine.breakpointExists(location, options);
    },

    /**
     * Assert the total number of breakpoints.
     * @param n - Expected count
     * @param options - Assertion options
     */
    async breakpointCount(n: number, options?: AssertOptions): Promise<void> {
      return engine.breakpointCount(n, options);
    },

    // ─── Variable Assertions ───

    /**
     * Assert that a variable equals the expected value.
     * @param name - Variable name
     * @param expected - Expected value
     * @param options - Assertion options
     */
    async variable(
      name: string,
      expected: unknown,
      options?: AssertOptions,
    ): Promise<void> {
      return engine.variable(name, expected, options);
    },

    /**
     * Assert that a variable does NOT equal the expected value.
     * @param name - Variable name
     * @param expected - Value that should not match
     * @param options - Assertion options
     */
    async variableNot(
      name: string,
      expected: unknown,
      options?: AssertOptions,
    ): Promise<void> {
      return engine.variableNot(name, expected, options);
    },

    /**
     * Assert that a variable satisfies a predicate function.
     * @param name - Variable name
     * @param predicate - Function that returns true if the value is acceptable
     * @param msg - Optional custom error message
     * @param options - Assertion options
     */
    async variableSatisfies(
      name: string,
      predicate: (value: unknown) => boolean,
      msg?: string,
      options?: AssertOptions,
    ): Promise<void> {
      return engine.variableSatisfies(name, predicate, msg, options);
    },

    /**
     * Assert that a variable has a specific type.
     * @param name - Variable name
     * @param type - Expected type string
     * @param options - Assertion options
     */
    async variableType(
      name: string,
      type: string,
      options?: AssertOptions,
    ): Promise<void> {
      return engine.variableType(name, type, options);
    },

    // ─── Expression Assertions ───

    /**
     * Assert that an expression evaluates to the expected value.
     * @param expr - Expression to evaluate
     * @param expected - Expected result
     * @param options - Assertion options
     */
    async expression(
      expr: string,
      expected: unknown,
      options?: EvalAssertOptions,
    ): Promise<void> {
      return engine.expression(expr, expected, options);
    },

    /**
     * Assert that an expression evaluation throws an error.
     * @param expr - Expression to evaluate
     * @param errorPattern - Optional string or regex to match the error message
     * @param options - Assertion options
     */
    async expressionThrows(
      expr: string,
      errorPattern?: string | RegExp,
      options?: EvalAssertOptions,
    ): Promise<void> {
      return engine.expressionThrows(expr, errorPattern, options);
    },

    // ─── Execution State Assertions ───

    /**
     * Assert that the debugger is currently paused.
     * @param options - Assertion options
     */
    async paused(options?: AssertOptions): Promise<void> {
      return engine.paused(options);
    },

    /**
     * Assert that the debugger is currently running.
     * @param options - Assertion options
     */
    async running(options?: AssertOptions): Promise<void> {
      return engine.running(options);
    },

    /**
     * Assert the number of active threads.
     * @param n - Expected thread count
     * @param options - Assertion options
     */
    async threadCount(n: number, options?: AssertOptions): Promise<void> {
      return engine.threadCount(n, options);
    },

    /**
     * Assert the depth of the call stack.
     * @param n - Expected stack depth
     * @param options - Assertion options
     */
    async stackDepth(n: number, options?: AssertOptions): Promise<void> {
      return engine.stackDepth(n, options);
    },

    /**
     * Assert the name of the top stack frame method.
     * @param method - Expected method name (partial match)
     * @param options - Assertion options
     */
    async topFrame(
      method: string,
      options?: TopFrameOptions,
    ): Promise<void> {
      return engine.topFrame(method, options);
    },
  } as const;
}

// ─── Assert Engine ───────────────────────────────────────────────────────────

/**
 * Core assertion engine with timeout-based polling.
 *
 * Each assertion polls the debug target until the condition is met
 * or the timeout expires. Failed assertions throw `AssertionError`
 * with diagnostic information.
 */
class AssertEngine {
  constructor(private dbg: Debugger) {}

  private getDefaultTimeout(): number {
    return 5000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  // ─── Breakpoint Assertions ───

  async hitBreakpoint(
    id: string,
    times?: number,
    options?: AssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const bps = await this.dbg.breakpoints();
      const bp = bps.find((b) => b.id === id);
      if (bp) {
        if (times === undefined || bp.hitCount >= times) {
          return;
        }
      }
      await this.delay(100);
    }

    const bps = await this.dbg.breakpoints();
    const bp = bps.find((b) => b.id === id);
    throw new AssertionError(
      `Expected breakpoint '${id}' to be hit${times !== undefined ? ` ${times} times` : ""}`,
      {
        expected: times ?? "≥1",
        actual: bp?.hitCount ?? 0,
        name: id,
      },
    );
  }

  async notHitBreakpoint(
    id: string,
    _options?: AssertOptions,
  ): Promise<void> {
    const bps = await this.dbg.breakpoints();
    const bp = bps.find((b) => b.id === id);
    if (bp && bp.hitCount > 0) {
      throw new AssertionError(
        `Expected breakpoint '${id}' to not be hit, but was hit ${bp.hitCount} times`,
        { expected: 0, actual: bp.hitCount, name: id },
      );
    }
  }

  async breakpointExists(
    location: string,
    options?: AssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const bps = await this.dbg.breakpoints();
      const exists = bps.some(
        (b) => b.location === location || b.location.includes(location),
      );
      if (exists) return;
      await this.delay(100);
    }

    const bps = await this.dbg.breakpoints();
    const locations = bps.map((b) => b.location);
    throw new AssertionError(
      `Expected breakpoint at '${location}' to exist`,
      { expected: location, actual: locations },
    );
  }

  async breakpointCount(
    n: number,
    options?: AssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const bps = await this.dbg.breakpoints();
      if (bps.length === n) return;
      await this.delay(100);
    }

    const bps = await this.dbg.breakpoints();
    throw new AssertionError(
      `Expected ${n} breakpoints, got ${bps.length}`,
      { expected: n, actual: bps.length },
    );
  }

  // ─── Variable Assertions ───

  async variable(
    name: string,
    expected: unknown,
    options?: AssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
      const variable = locals.find((v) => v.name === name);

      if (variable && this.deepEqual(variable.value, expected)) {
        return;
      }
      await this.delay(100);
    }

    const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
    const actual = locals.find((v) => v.name === name);
    throw new AssertionError(
      `Expected variable '${name}' to equal ${JSON.stringify(expected)}`,
      { expected, actual: actual?.value, name },
    );
  }

  async variableNot(
    name: string,
    expected: unknown,
    options?: AssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
      const variable = locals.find((v) => v.name === name);

      if (variable && !this.deepEqual(variable.value, expected)) {
        return;
      }
      if (!variable) return; // Variable not found = not equal
      await this.delay(100);
    }

    const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
    const actual = locals.find((v) => v.name === name);
    throw new AssertionError(
      `Expected variable '${name}' to not equal ${JSON.stringify(expected)}`,
      { expected, actual: actual?.value, name },
    );
  }

  async variableSatisfies(
    name: string,
    predicate: (value: unknown) => boolean,
    msg?: string,
    options?: AssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
      const variable = locals.find((v) => v.name === name);

      if (variable && predicate(variable.value)) {
        return;
      }
      await this.delay(100);
    }

    const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
    const actual = locals.find((v) => v.name === name);
    throw new AssertionError(
      msg ?? `Expected variable '${name}' to satisfy predicate`,
      { expected: "predicate", actual: actual?.value, name },
    );
  }

  async variableType(
    name: string,
    type: string,
    options?: AssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
      const variable = locals.find((v) => v.name === name);

      if (variable && variable.type === type) {
        return;
      }
      await this.delay(100);
    }

    const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
    const actual = locals.find((v) => v.name === name);
    throw new AssertionError(
      `Expected variable '${name}' to have type '${type}', got '${actual?.type}'`,
      { expected: type, actual: actual?.type, name },
    );
  }

  // ─── Expression Assertions ───

  async expression(
    expr: string,
    expected: unknown,
    options?: EvalAssertOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        const result = await this.dbg.evaluate(expr);
        if (this.deepEqual(result.value, expected)) {
          return;
        }
      } catch {
        if (options?.errorOnFailure) {
          throw new AssertionError(
            `Expression evaluation failed: ${expr}`,
            { expected, actual: "<evaluation error>" },
          );
        }
      }
      await this.delay(100);
    }

    const result = await this.dbg.evaluate(expr).catch(() => null);
    throw new AssertionError(
      `Expected expression '${expr}' to equal ${JSON.stringify(expected)}`,
      { expected, actual: result?.value ?? "<no result>" },
    );
  }

  async expressionThrows(
    expr: string,
    errorPattern?: string | RegExp,
    _options?: EvalAssertOptions,
  ): Promise<void> {
    try {
      const result = await this.dbg.evaluate(expr);

      // No error thrown — assertion fails
      throw new AssertionError(
        `Expected expression '${expr}' to throw an error`,
        { expected: "Error", actual: result.value },
      );
    } catch (err) {
      if (err instanceof AssertionError) throw err;

      const message = err instanceof Error ? err.message : String(err);
      if (errorPattern) {
        const matches =
          errorPattern instanceof RegExp
            ? errorPattern.test(message)
            : message.includes(errorPattern);
        if (!matches) {
          throw new AssertionError(
            `Expected expression '${expr}' error to match '${errorPattern}', got '${message}'`,
            { expected: errorPattern, actual: message },
          );
        }
      }
      // Error thrown as expected
    }
  }

  // ─── Execution State Assertions ───

  async paused(options?: AssertOptions): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const state = this.dbg.getState();
      if (state === "paused") return;
      await this.delay(100);
    }

    const state = this.dbg.getState();
    throw new AssertionError(
      `Expected debugger to be paused, but it is '${state}'`,
      { expected: "paused", actual: state },
    );
  }

  async running(options?: AssertOptions): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const state = this.dbg.getState();
      if (state === "running" || state === "connected") return;
      await this.delay(100);
    }

    const state = this.dbg.getState();
    throw new AssertionError(
      `Expected debugger to be running, but it is '${state}'`,
      { expected: "running", actual: state },
    );
  }

  async threadCount(n: number, options?: AssertOptions): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const threads = await this.dbg.threads();
      if (threads.length === n) return;
      await this.delay(100);
    }

    const threads = await this.dbg.threads();
    throw new AssertionError(
      `Expected ${n} threads, got ${threads.length}`,
      { expected: n, actual: threads.length },
    );
  }

  async stackDepth(n: number, options?: AssertOptions): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const frames = await this.dbg.stack(options?.threadId);
      if (frames.length === n) return;
      await this.delay(100);
    }

    const frames = await this.dbg.stack(options?.threadId);
    throw new AssertionError(
      `Expected stack depth of ${n}, got ${frames.length}`,
      { expected: n, actual: frames.length },
    );
  }

  async topFrame(
    method: string,
    options?: TopFrameOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? this.getDefaultTimeout();
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const frames = await this.dbg.stack(options?.threadId);
      const top = frames[0];
      if (top && top.method.includes(method)) return;
      await this.delay(100);
    }

    const frames = await this.dbg.stack(options?.threadId);
    const top = frames[0];
    throw new AssertionError(
      `Expected top frame to contain '${method}', got '${top?.method ?? "<no frame>"}'`,
      { expected: method, actual: top?.method ?? "<no frame>" },
    );
  }
}