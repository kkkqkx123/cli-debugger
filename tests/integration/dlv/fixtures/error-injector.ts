/**
 * Error injector for Delve integration testing
 * Provides utilities to inject various errors for testing error recovery
 */

import type { MockDlvServer } from "./mock-dlv-server.js";

/**
 * Error types that can be injected
 */
export type DlvErrorType =
  | "connection-drop"
  | "malformed-response"
  | "rpc-error"
  | "timeout"
  | "partial-write";

/**
 * Error injector for Delve
 */
export class DlvErrorInjector {
  private server: MockDlvServer;
  private injectedErrors: Set<DlvErrorType> = new Set();

  constructor(server: MockDlvServer) {
    this.server = server;
  }

  /**
   * Inject connection drop
   */
  injectConnectionDrop(): void {
    this.injectedErrors.add("connection-drop");
    this.server.simulateError();
  }

  /**
   * Inject malformed JSON response
   */
  injectMalformedResponse(): void {
    this.injectedErrors.add("malformed-response");
    this.server.setResponseHandler(() => {
      // Return invalid JSON
      return Buffer.from("{ invalid json }");
    });
  }

  /**
   * Inject RPC error
   */
  injectRpcError(): void {
    this.injectedErrors.add("rpc-error");
    this.server.setResponseHandler((data) => {
      try {
        const request = JSON.parse(data.toString());
        // Return error response for all requests
        return Buffer.from(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32000,
            message: "Injected RPC error",
          },
        }));
      } catch {
        return Buffer.from("{}");
      }
    });
  }

  /**
   * Inject timeout (delay responses)
   */
  injectTimeout(_delayMs: number = 5000): void {
    this.injectedErrors.add("timeout");
    // This is handled by setting responseDelay in server options
    // For now, we just mark it as injected
  }

  /**
   * Inject partial write
   */
  injectPartialWrite(): void {
    this.injectedErrors.add("partial-write");
    // This would require modifying the socket write behavior
    // For now, we just mark it as injected
  }

  /**
   * Clear all injected errors
   */
  clearErrors(): void {
    this.injectedErrors.clear();
    // Reset server to default behavior
    this.server.setResponseHandler(null as never);
  }

  /**
   * Check if error is injected
   */
  hasError(type: DlvErrorType): boolean {
    return this.injectedErrors.has(type);
  }

  /**
   * Get all injected errors
   */
  getInjectedErrors(): DlvErrorType[] {
    return Array.from(this.injectedErrors);
  }
}
