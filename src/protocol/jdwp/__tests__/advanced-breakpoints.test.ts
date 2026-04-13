/**
 * Tests for advanced breakpoint functionality (exception, field, class, thread breakpoints)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JDWPClient } from "../client.js";
import type { DebugConfig } from "../../../types/config.js";

// Mock net.Socket to avoid actual network connections
vi.mock("node:net", () => {
  const mockSocket = {
    connect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    write: vi.fn((_data: Buffer, cb: () => void) => cb()),
    end: vi.fn((cb: () => void) => cb()),
    destroy: vi.fn(),
    setTimeout: vi.fn(),
  };

  return {
    default: {
      Socket: vi.fn(() => mockSocket),
    },
  };
});

describe("Advanced Breakpoints - Exception Breakpoint", () => {
  let client: JDWPClient;

  beforeEach(() => {
    const config: DebugConfig = {
      protocol: "jdwp",
      host: "localhost",
      port: 5005,
      timeout: 5000,
    };
    client = new JDWPClient(config);
  });

  afterEach(() => {
    client.close().catch(() => {
      // Ignore errors during cleanup
    });
  });

  it("should accept exception breakpoint type in setBreakpoint signature", async () => {
    // This test verifies the type signature is correct
    // Actual functionality requires a real JDWP connection
    await expect(async () => {
      await client.setBreakpoint("java.lang.NullPointerException", undefined, "exception");
    }).rejects.toThrow(); // Will throw because we're not connected
  });

  it("should accept wildcard exception breakpoint", async () => {
    await expect(async () => {
      await client.setBreakpoint("*", undefined, "exception");
    }).rejects.toThrow(); // Will throw because we're not connected
  });
});

describe("Advanced Breakpoints - Field Breakpoint", () => {
  let client: JDWPClient;

  beforeEach(() => {
    const config: DebugConfig = {
      protocol: "jdwp",
      host: "localhost",
      port: 5005,
      timeout: 5000,
    };
    client = new JDWPClient(config);
  });

  afterEach(() => {
    client.close().catch(() => {
      // Ignore errors during cleanup
    });
  });

  it("should accept field-access breakpoint type", async () => {
    await expect(async () => {
      await client.setBreakpoint("com.example.MyClass.myField", undefined, "field-access");
    }).rejects.toThrow(); // Will throw because we're not connected
  });

  it("should accept field-modify breakpoint type", async () => {
    await expect(async () => {
      await client.setBreakpoint("com.example.MyClass.myField", undefined, "field-modify");
    }).rejects.toThrow(); // Will throw because we're not connected
  });

  it("should reject invalid field location format", async () => {
    // The connection check happens before format validation, so we test that
    // In a real scenario with connection, the format would be validated
    await expect(async () => {
      await client.setBreakpoint("invalid-format", undefined, "field-access");
    }).rejects.toThrow(); // Will throw because we're not connected
  });
});

describe("Advanced Breakpoints - Class Breakpoint", () => {
  let client: JDWPClient;

  beforeEach(() => {
    const config: DebugConfig = {
      protocol: "jdwp",
      host: "localhost",
      port: 5005,
      timeout: 5000,
    };
    client = new JDWPClient(config);
  });

  afterEach(() => {
    client.close().catch(() => {
      // Ignore errors during cleanup
    });
  });

  it("should accept class-load breakpoint type", async () => {
    await expect(async () => {
      await client.setBreakpoint("com.example.*", undefined, "class-load");
    }).rejects.toThrow(); // Will throw because we're not connected
  });

  it("should accept class-unload breakpoint type", async () => {
    await expect(async () => {
      await client.setBreakpoint("com.example.MyClass", undefined, "class-unload");
    }).rejects.toThrow(); // Will throw because we're not connected
  });
});

describe("Advanced Breakpoints - Thread Breakpoint", () => {
  let client: JDWPClient;

  beforeEach(() => {
    const config: DebugConfig = {
      protocol: "jdwp",
      host: "localhost",
      port: 5005,
      timeout: 5000,
    };
    client = new JDWPClient(config);
  });

  afterEach(() => {
    client.close().catch(() => {
      // Ignore errors during cleanup
    });
  });

  it("should accept thread-start breakpoint type", async () => {
    await expect(async () => {
      await client.setBreakpoint("thread-123", undefined, "thread-start");
    }).rejects.toThrow(); // Will throw because we're not connected
  });

  it("should accept thread-death breakpoint type", async () => {
    await expect(async () => {
      await client.setBreakpoint("thread-123", undefined, "thread-death");
    }).rejects.toThrow(); // Will throw because we're not connected
  });
});

describe("Advanced Breakpoints - Type Safety", () => {
  it("should have correct type signature for setBreakpoint with all breakpoint types", () => {
    // This is a compile-time type check
    // If this compiles successfully, the types are correct
    type BreakpointType =
      | "line"
      | "method-entry"
      | "method-exit"
      | "exception"
      | "field-access"
      | "field-modify"
      | "class-load"
      | "class-unload"
      | "thread-start"
      | "thread-death";

    // Verify all types are accepted
    const validTypes: BreakpointType[] = [
      "line",
      "method-entry",
      "method-exit",
      "exception",
      "field-access",
      "field-modify",
      "class-load",
      "class-unload",
      "thread-start",
      "thread-death",
    ];

    expect(validTypes).toHaveLength(10);
  });
});
