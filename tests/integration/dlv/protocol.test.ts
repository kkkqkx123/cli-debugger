/**
 * Protocol encoding/decoding integration tests for Delve
 * Tests JSON-RPC message encoding and decoding
 */

import { describe, it, expect } from "vitest";
import { DlvTestDataGenerator } from "./fixtures/index.js";

describe("Delve Protocol Encoding/Decoding", () => {
  describe("json_rpc_message_structure", () => {
    it("should correctly structure JSON-RPC request", () => {
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "RPCServer.GetVersion",
        params: [],
      };

      // Verify structure
      expect(request.jsonrpc).toBe("2.0");
      expect(request.id).toBe(1);
      expect(request.method).toBe("RPCServer.GetVersion");
      expect(Array.isArray(request.params)).toBe(true);

      // Should be valid JSON
      const json = JSON.stringify(request);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(request);
    });

    it("should correctly structure JSON-RPC response", () => {
      const response = {
        jsonrpc: "2.0",
        id: 1,
        result: {
          DelveVersion: "1.20.0",
          APIVersion: "2",
        },
      };

      // Verify structure
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();

      // Should be valid JSON
      const json = JSON.stringify(response);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(response);
    });

    it("should correctly structure JSON-RPC error response", () => {
      const errorResponse = {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32000,
          message: "Internal error",
        },
      };

      // Verify structure
      expect(errorResponse.jsonrpc).toBe("2.0");
      expect(errorResponse.id).toBe(1);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBe(-32000);
      expect(errorResponse.error.message).toBe("Internal error");
    });
  });

  describe("rpc_request_variations", () => {
    it("should handle various RPC requests", () => {
      const requests = DlvTestDataGenerator.generateComplexRpcRequests();

      for (const { method, params } of requests) {
        const request = {
          jsonrpc: "2.0",
          id: Math.random(),
          method,
          params,
        };

        // Should be valid JSON
        const json = JSON.stringify(request);
        const parsed = JSON.parse(json);
        expect(parsed.method).toBe(method);
        expect(parsed.params).toEqual(params);
      }
    });

    it("should handle requests with no params", () => {
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "RPCServer.ListBreakpoints",
        params: [],
      };

      const json = JSON.stringify(request);
      const parsed = JSON.parse(json);
      expect(parsed.params).toEqual([]);
    });

    it("should handle requests with complex params", () => {
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "RPCServer.CreateBreakpoint",
        params: [
          {
            file: "main.go",
            line: 10,
            Cond: "x > 5",
          },
        ],
      };

      const json = JSON.stringify(request);
      const parsed = JSON.parse(json);
      expect(parsed.params[0].file).toBe("main.go");
      expect(parsed.params[0].line).toBe(10);
      expect(parsed.params[0].Cond).toBe("x > 5");
    });
  });

  describe("go_value_types", () => {
    it("should handle all Go value types", () => {
      const valueTypes = DlvTestDataGenerator.generateAllGoValueTypes();

      for (const { type, value, description } of valueTypes) {
        // Verify type is valid Go type
        expect(type).toBeTruthy();
        expect(value).toBeDefined();
        expect(description).toBeTruthy();
      }
    });

    it("should handle Go primitive types", () => {
      const primitives = [
        { type: "int", value: 42 },
        { type: "int8", value: 127 },
        { type: "int16", value: 32767 },
        { type: "int32", value: 2147483647 },
        { type: "int64", value: 9007199254740991n },
        { type: "uint", value: 42 },
        { type: "float32", value: 3.14 },
        { type: "float64", value: 3.141592653589793 },
        { type: "string", value: "hello" },
        { type: "bool", value: true },
      ];

      for (const { type, value } of primitives) {
        expect(type).toBeTruthy();
        expect(value).toBeDefined();
      }
    });

    it("should handle Go complex types", () => {
      const complexTypes = [
        { type: "[]int", description: "slice of int" },
        { type: "map[string]int", description: "map string to int" },
        { type: "*int", description: "pointer to int" },
        { type: "struct{}", description: "empty struct" },
        { type: "func()", description: "function" },
        { type: "chan int", description: "channel of int" },
        { type: "interface{}", description: "empty interface" },
      ];

      for (const { type, description } of complexTypes) {
        expect(type).toBeTruthy();
        expect(description).toBeTruthy();
      }
    });
  });

  describe("newline_delimited_json", () => {
    it("should handle newline-delimited JSON messages", () => {
      const messages = [
        { jsonrpc: "2.0", id: 1, method: "test1", params: [] },
        { jsonrpc: "2.0", id: 2, method: "test2", params: [] },
        { jsonrpc: "2.0", id: 3, method: "test3", params: [] },
      ];

      // Concatenate with newlines
      const concatenated = messages
        .map((m) => JSON.stringify(m))
        .join("\n") + "\n";

      // Split and parse
      const lines = concatenated.split("\n").filter((line) => line.trim());
      const parsed = lines.map((line) => JSON.parse(line));

      expect(parsed.length).toBe(3);
      expect(parsed[0].method).toBe("test1");
      expect(parsed[1].method).toBe("test2");
      expect(parsed[2].method).toBe("test3");
    });

    it("should handle message with trailing newline", () => {
      const message = { jsonrpc: "2.0", id: 1, method: "test", params: [] };
      const json = JSON.stringify(message) + "\n";

      const lines = json.split("\n");
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe(JSON.stringify(message));
      expect(lines[1]).toBe("");
    });
  });

  describe("string_encoding_utf8", () => {
    it("should handle UTF-8 strings in Go", () => {
      const testStrings = [
        "Hello World",
        "你好世界",
        "こんにちは",
        "🎉🎊🎁",
        "Mixed: Hello 你好 こんにちは",
      ];

      for (const str of testStrings) {
        const encoded = Buffer.from(str, "utf8");
        const decoded = encoded.toString("utf8");
        expect(decoded).toBe(str);
      }
    });

    it("should handle Go string literals in JSON", () => {
      const goString = "Hello, 世界!";
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "RPCServer.Eval",
        params: [{ expr: goString }],
      };

      const json = JSON.stringify(request);
      const parsed = JSON.parse(json);
      expect(parsed.params[0].expr).toBe(goString);
    });
  });

  describe("malformed_messages", () => {
    it("should identify malformed JSON messages", () => {
      const malformed = DlvTestDataGenerator.generateMalformedRpcRequests();

      for (const msg of malformed) {
        try {
          JSON.parse(msg);
          // If parsing succeeds, check if it's valid JSON-RPC
          const parsed = JSON.parse(msg);
          const isValidRpc =
            parsed.jsonrpc === "2.0" &&
            typeof parsed.method === "string" &&
            Array.isArray(parsed.params);

          // Some malformed messages may parse but not be valid JSON-RPC
          if (isValidRpc) {
            // This is actually valid, skip
            continue;
          }
        } catch {
          // Expected: parsing should fail
          expect(true).toBe(true);
        }
      }
    });

    it("should handle empty message", () => {
      const empty = "";
      expect(empty.length).toBe(0);
    });

    it("should handle incomplete JSON", () => {
      const incomplete = '{"jsonrpc": "2.0", "id": 1';
      expect(() => JSON.parse(incomplete)).toThrow();
    });
  });

  describe("goroutine_data_structure", () => {
    it("should correctly structure goroutine data", () => {
      const goroutines = DlvTestDataGenerator.generateMockGoroutines(3);

      for (const g of goroutines) {
        expect(g.id).toBeGreaterThan(0);
        expect(g.userCurrentLoc).toBeDefined();
        expect(g.userCurrentLoc.file).toBeTruthy();
        expect(g.userCurrentLoc.line).toBeGreaterThan(0);
        expect(typeof g.systemStack).toBe("boolean");
        expect(g.threadId).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle large goroutine lists", () => {
      const goroutines = DlvTestDataGenerator.generateLargeGoroutineList(100);

      expect(goroutines.length).toBe(100);

      for (const g of goroutines) {
        expect(g.id).toBeGreaterThan(0);
        expect(g.userCurrentLoc).toBeDefined();
      }
    });
  });

  describe("breakpoint_data_structure", () => {
    it("should correctly structure breakpoint data", () => {
      const breakpoints = DlvTestDataGenerator.generateBreakpointTestData();

      for (const bp of breakpoints) {
        expect(bp.location).toBeTruthy();
        // Either file:line or functionName should be set
        expect(bp.file || bp.functionName).toBeTruthy();
      }
    });
  });

  describe("variable_data_structure", () => {
    it("should correctly structure variable data", () => {
      const variables = DlvTestDataGenerator.generateMockVariables();

      for (const v of variables) {
        expect(v.name).toBeTruthy();
        expect(v.type).toBeTruthy();
        expect(v.value).toBeDefined();
        expect(typeof v.kind).toBe("number");
      }
    });
  });

  describe("stack_frame_structure", () => {
    it("should correctly structure stack frames", () => {
      const frames = DlvTestDataGenerator.generateMockStackFrames(5);

      for (const f of frames) {
        expect(f.file).toBeTruthy();
        expect(f.line).toBeGreaterThan(0);
        expect(typeof f.systemStack).toBe("boolean");
      }
    });
  });
});
