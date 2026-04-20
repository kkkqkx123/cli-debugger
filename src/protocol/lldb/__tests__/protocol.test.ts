/**
 * Tests for LLDB Protocol utilities
 */

import { describe, it, expect } from "vitest";
import {
  createRequest,
  parseResponse,
  serializeRequest,
  isErrorResponse,
  PROTOCOL,
} from "../protocol.js";

describe("Protocol utilities", () => {
  describe("createRequest", () => {
    it("should create a valid request object", () => {
      const request = createRequest(1, "threads", {});

      expect(request).toEqual({
        id: 1,
        method: "threads",
        params: {},
      });
    });

    it("should include params", () => {
      const params = { threadId: 123, depth: 50 };
      const request = createRequest(2, "stack", params);

      expect(request.params).toEqual(params);
    });
  });

  describe("parseResponse", () => {
    it("should parse success response", () => {
      const line = JSON.stringify({ id: 1, result: { success: true } });
      const response = parseResponse(line);

      expect(response).toEqual({
        id: 1,
        result: { success: true },
      });
    });

    it("should parse error response", () => {
      const line = JSON.stringify({
        id: 1,
        error: { code: "UNKNOWN_METHOD", message: "Unknown method" },
      });
      const response = parseResponse(line);

      expect(response).toEqual({
        id: 1,
        error: { code: "UNKNOWN_METHOD", message: "Unknown method" },
      });
    });
  });

  describe("serializeRequest", () => {
    it("should serialize request with delimiter", () => {
      const request = createRequest(1, "version", {});
      const serialized = serializeRequest(request);

      expect(serialized).toBe(JSON.stringify(request) + PROTOCOL.DELIMITER);
    });

    it("should end with newline", () => {
      const request = createRequest(1, "threads", {});
      const serialized = serializeRequest(request);

      expect(serialized.endsWith("\n")).toBe(true);
    });
  });

  describe("isErrorResponse", () => {
    it("should return true for error response", () => {
      const response = {
        id: 1,
        error: { code: "UNKNOWN_METHOD", message: "Unknown method" },
      };

      expect(isErrorResponse(response)).toBe(true);
    });

    it("should return false for success response", () => {
      const response = {
        id: 1,
        result: { success: true },
      };

      expect(isErrorResponse(response)).toBe(false);
    });
  });

  describe("PROTOCOL constants", () => {
    it("should have correct delimiter", () => {
      expect(PROTOCOL.DELIMITER).toBe("\n");
    });

    it("should have default timeout", () => {
      expect(PROTOCOL.DEFAULT_TIMEOUT).toBe(30000);
    });
  });
});
