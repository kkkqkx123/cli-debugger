/**
 * Test data generator for Delve integration tests
 * Provides test data for various Go value types and RPC scenarios
 */

/**
 * Go value type test data
 */
export interface GoValueTypeTestData {
  type: string;
  value: unknown;
  description: string;
}

/**
 * Test data generator for Delve
 */
export const DlvTestDataGenerator = {
  /**
   * Generate all Go value types for testing
   */
  generateAllGoValueTypes(): GoValueTypeTestData[] {
    return [
      { type: "int", value: 42, description: "int" },
      { type: "int8", value: 127, description: "int8" },
      { type: "int16", value: 32767, description: "int16" },
      { type: "int32", value: 2147483647, description: "int32" },
      { type: "int64", value: 9007199254740991n, description: "int64" },
      { type: "uint", value: 42, description: "uint" },
      { type: "uint8", value: 255, description: "uint8" },
      { type: "uint16", value: 65535, description: "uint16" },
      { type: "uint32", value: 4294967295, description: "uint32" },
      { type: "float32", value: 3.14, description: "float32" },
      { type: "float64", value: 3.141592653589793, description: "float64" },
      { type: "string", value: "hello world", description: "string" },
      { type: "bool", value: true, description: "bool true" },
      { type: "bool", value: false, description: "bool false" },
      { type: "complex64", value: "1+2i", description: "complex64" },
      { type: "complex128", value: "1+2i", description: "complex128" },
    ];
  },

  /**
   * Generate complex RPC request data for testing
   */
  generateComplexRpcRequests(): Array<{ method: string; params: unknown[] }> {
    return [
      {
        method: "RPCServer.CreateBreakpoint",
        params: [{ file: "main.go", line: 10 }],
      },
      {
        method: "RPCServer.CreateBreakpoint",
        params: [{ functionName: "main.main" }],
      },
      {
        method: "RPCServer.ListGoroutines",
        params: [],
      },
      {
        method: "RPCServer.Stacktrace",
        params: [1, 50],
      },
      {
        method: "RPCServer.ListLocalVars",
        params: [{ goroutineID: 1, frame: 0 }],
      },
    ];
  },

  /**
   * Generate malformed RPC requests for error testing
   */
  generateMalformedRpcRequests(): string[] {
    return [
      // Invalid JSON
      "{ invalid json }",
      // Missing required fields
      JSON.stringify({ jsonrpc: "2.0" }),
      // Invalid method
      JSON.stringify({ jsonrpc: "2.0", method: 123, id: 1 }),
      // Invalid params
      JSON.stringify({ jsonrpc: "2.0", method: "test", params: "not-array", id: 1 }),
    ];
  },

  /**
   * Generate large goroutine list for performance testing
   */
  generateLargeGoroutineList(count: number = 100): Array<{
    id: number;
    userCurrentLoc: {
      file: string;
      line: number;
      function?: { name: string };
    };
    systemStack: boolean;
    threadId: number;
  }> {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      userCurrentLoc: {
        file: "main.go",
        line: 10 + i,
        function: { name: i === 0 ? "main.main" : `worker.work${i}` },
      },
      systemStack: false,
      threadId: i + 1,
    }));
  },

  /**
   * Generate Go source file test data
   */
  generateGoSourceTestData(): Array<{ file: string; content: string }> {
    return [
      {
        file: "main.go",
        content: `package main

import "fmt"

func main() {
    x := 42
    y := "hello"
    fmt.Println(x, y)
}
`,
      },
      {
        file: "worker.go",
        content: `package main

func worker(id int) {
    for i := 0; i < 10; i++ {
        process(id, i)
    }
}

func process(id, value int) {
    // processing
}
`,
      },
    ];
  },

  /**
   * Generate breakpoint test data
   */
  generateBreakpointTestData(): Array<{
    location: string;
    file?: string;
    line?: number;
    functionName?: string;
  }> {
    return [
      {
        location: "main.go:10",
        file: "main.go",
        line: 10,
      },
      {
        location: "main.main",
        functionName: "main.main",
      },
      {
        location: "worker.go:25",
        file: "worker.go",
        line: 25,
      },
      {
        location: "worker.process",
        functionName: "worker.process",
      },
    ];
  },

  /**
   * Generate mock goroutine info
   */
  generateMockGoroutines(count: number = 3): Array<{
    id: number;
    userCurrentLoc: {
      file: string;
      line: number;
      function?: { name: string };
    };
    systemStack: boolean;
    threadId: number;
  }> {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      userCurrentLoc: {
        file: "main.go",
        line: 10 + i * 5,
        function: { name: i === 0 ? "main.main" : `worker.work${i}` },
      },
      systemStack: false,
      threadId: i + 1,
    }));
  },

  /**
   * Generate mock stack frames
   */
  generateMockStackFrames(depth: number = 5): Array<{
    file: string;
    line: number;
    function?: { name: string };
    systemStack: boolean;
  }> {
    return Array.from({ length: depth }, (_, i) => ({
      file: "main.go",
      line: 10 + i * 5,
      function: { name: i === 0 ? "main.main" : `main.helper${i}` },
      systemStack: false,
    }));
  },

  /**
   * Generate mock variable data
   */
  generateMockVariables(): Array<{
    name: string;
    type: string;
    value: string;
    kind: number;
  }> {
    return [
      { name: "x", type: "int", value: "42", kind: 0 },
      { name: "y", type: "string", value: '"hello"', kind: 0 },
      { name: "z", type: "bool", value: "true", kind: 0 },
      { name: "arr", type: "[]int", value: "len: 3, cap: 3", kind: 1 },
      { name: "m", type: "map[string]int", value: "len: 2", kind: 2 },
      { name: "ptr", type: "*int", value: "0xc0000b2008", kind: 3 },
    ];
  },

  /**
   * Generate Go package test data
   */
  generateMockPackages(): string[] {
    return [
      "main",
      "fmt",
      "os",
      "strings",
      "strconv",
      "time",
      "sync",
      "context",
      "errors",
      "log",
    ];
  },

  /**
   * Generate Go function test data
   */
  generateMockFunctions(): Array<{ name: string; package: string }> {
    return [
      { name: "main.main", package: "main" },
      { name: "main.helper", package: "main" },
      { name: "fmt.Println", package: "fmt" },
      { name: "fmt.Printf", package: "fmt" },
      { name: "strings.Split", package: "strings" },
      { name: "time.Now", package: "time" },
    ];
  },
};
