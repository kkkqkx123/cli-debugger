/**
 * LLDB bridge communication protocol
 */

import type { BridgeRequest, BridgeResponse } from "./types.js";

/**
 * Protocol constants
 */
export const PROTOCOL = {
  /** Line delimiter for messages */
  DELIMITER: "\n",
  /** Default timeout in ms */
  DEFAULT_TIMEOUT: 30000,
} as const;

/**
 * Create a bridge request
 */
export function createRequest(
  id: number,
  method: string,
  params: unknown,
): BridgeRequest {
  return { id, method, params };
}

/**
 * Parse a bridge response
 */
export function parseResponse(line: string): BridgeResponse {
  return JSON.parse(line) as BridgeResponse;
}

/**
 * Serialize a request for sending
 */
export function serializeRequest(request: BridgeRequest): string {
  return JSON.stringify(request) + PROTOCOL.DELIMITER;
}

/**
 * Check if response is an error
 */
export function isErrorResponse(
  response: BridgeResponse,
): response is { id: number; error: { code: string; message: string } } {
  return "error" in response;
}
