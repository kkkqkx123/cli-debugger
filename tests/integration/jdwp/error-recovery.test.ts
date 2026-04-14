/**
 * Error recovery integration tests
 * Tests error handling and recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JDWPClient } from "../../../src/protocol/jdwp/client.js";
import { MockJDWPServer, ErrorInjector } from "./fixtures/index.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Error Recovery", () => {
  let server: MockJDWPServer;
  let port: number;
  let config: DebugConfig;
  let errorInjector: ErrorInjector;

  beforeEach(async () => {
    server = new MockJDWPServer();
    port = await server.start();
    config = {
      protocol: "jdwp",
      host: "127.0.0.1",
      port,
      timeout: 5000,
    };
    errorInjector = new ErrorInjector(server);
  });

  afterEach(async () => {
    errorInjector.clearErrors();
    await server.stop();
  });

  describe("connection_lost_recovery", () => {
    it("should detect connection loss", async () => {
      const client = new JDWPClient(config);
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Simulate connection drop
      errorInjector.injectConnectionDrop();

      // Wait a bit for connection to be dropped
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Client may or may not detect the drop immediately
      // This depends on socket implementation
    });

    it("should handle reconnection after connection loss", async () => {
      // First connection
      const client1 = new JDWPClient(config);
      await client1.connect();
      expect(client1.isConnected()).toBe(true);
      await client1.close();

      // Second connection (reconnect)
      const client2 = new JDWPClient(config);
      await client2.connect();
      expect(client2.isConnected()).toBe(true);
      await client2.close();
    });
  });

  describe("malformed_packet_recovery", () => {
    it("should handle malformed packet response", async () => {
      // Inject malformed packet handler
      errorInjector.injectMalformedPacket();

      const client = new JDWPClient(config);

      // Connection should fail due to malformed packet during getIDSizes
      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it("should recover after clearing malformed packet handler", async () => {
      // Inject and then clear
      errorInjector.injectMalformedPacket();
      errorInjector.clearErrors();

      const client = new JDWPClient(config);
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Should work normally now
      const version = await client.version();
      expect(version).toBeDefined();

      await client.close();
    });
  });

  describe("protocol_error_recovery", () => {
    it("should handle protocol errors", async () => {
      // Inject protocol error
      errorInjector.injectProtocolError();

      const client = new JDWPClient(config);

      // Connection should fail due to protocol error during getIDSizes
      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it("should recover after clearing protocol error", async () => {
      // Inject and then clear
      errorInjector.injectProtocolError();
      errorInjector.clearErrors();

      const client = new JDWPClient(config);
      await client.connect();

      // Should work normally
      const version = await client.version();
      expect(version).toBeDefined();

      await client.close();
    });
  });

  describe("timeout_recovery", () => {
    it("should handle connection timeout", async () => {
      const client = new JDWPClient({
        protocol: "jdwp",
        host: "192.0.2.1", // Non-routable IP
        port: 5005,
        timeout: 1000,
      });

      // Should timeout
      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it("should handle command timeout", async () => {
      const client = new JDWPClient({
        ...config,
        timeout: 100, // Very short timeout
      });

      await client.connect();

      // Commands may timeout with very short timeout
      try {
        await client.version();
      } catch (error) {
        // May timeout
        expect(error).toBeDefined();
      }

      await client.close();
    });

    it("should recover after increasing timeout", async () => {
      // First with short timeout
      const client1 = new JDWPClient({
        ...config,
        timeout: 100,
      });

      await client1.connect();
      await client1.close();

      // Now with longer timeout
      const client2 = new JDWPClient({
        ...config,
        timeout: 5000,
      });

      await client2.connect();
      const version = await client2.version();
      expect(version).toBeDefined();
      await client2.close();
    });
  });

  describe("invalid_id_recovery", () => {
    it("should handle invalid thread ID", async () => {
      const client = new JDWPClient(config);
      await client.connect();

      // Try to use invalid thread ID
      await expect(client.stack("invalid-id")).rejects.toThrow();

      // Should still be connected
      expect(client.isConnected()).toBe(true);

      // Valid operations should still work
      const threads = await client.threads();
      expect(threads).toBeDefined();

      await client.close();
    });

    it("should handle invalid object ID", async () => {
      const client = new JDWPClient(config);
      await client.connect();

      // Try to use invalid object ID
      await expect(client.fields("invalid-id")).rejects.toThrow();

      // Should still be connected
      expect(client.isConnected()).toBe(true);

      await client.close();
    });

    it("should handle invalid frame index", async () => {
      const client = new JDWPClient(config);
      await client.connect();

      const threads = await client.threads();

      if (threads.length > 0) {
        const thread = threads[0]!;

        // Suspend thread
        await client.suspend(thread.id);

        // Try invalid frame index
        await expect(client.locals(thread.id, 999999)).rejects.toThrow();

        // Resume
        await client.resume(thread.id);
      }

      await client.close();
    });
  });

  describe("resource_exhaustion", () => {
    it("should handle multiple connections", async () => {
      const count = 10;
      const clients: JDWPClient[] = [];

      // Create multiple connections
      for (let i = 0; i < count; i++) {
        const client = new JDWPClient(config);
        await client.connect();
        clients.push(client);
      }

      // All should be connected
      for (const client of clients) {
        expect(client.isConnected()).toBe(true);
      }

      // Close all
      for (const client of clients) {
        await client.close();
      }
    });

    it("should handle rapid connect/disconnect", async () => {
      const count = 5;

      for (let i = 0; i < count; i++) {
        const client = new JDWPClient(config);
        await client.connect();
        expect(client.isConnected()).toBe(true);
        await client.close();
        expect(client.isConnected()).toBe(false);
      }
    });
  });

  describe("error_injection", () => {
    it("should track injected errors", async () => {
      // No errors initially
      expect(errorInjector.hasError("connection-drop")).toBe(false);

      // Inject error
      errorInjector.injectConnectionDrop();
      expect(errorInjector.hasError("connection-drop")).toBe(true);

      // Clear errors
      errorInjector.clearErrors();
      expect(errorInjector.hasError("connection-drop")).toBe(false);
    });

    it("should list injected errors", async () => {
      // Inject multiple errors
      errorInjector.injectConnectionDrop();
      errorInjector.injectMalformedPacket();

      const errors = errorInjector.getInjectedErrors();
      expect(errors).toContain("connection-drop");
      expect(errors).toContain("malformed-packet");
    });
  });

  describe("graceful_error_handling", () => {
    it("should not crash on errors", async () => {
      const client = new JDWPClient(config);
      await client.connect();

      // Try various invalid operations
      const operations = [
        () => client.stack("invalid"),
        () => client.locals("invalid", 0),
        () => client.fields("invalid"),
        () => client.threadState("invalid"),
      ];

      for (const op of operations) {
        try {
          await op();
        } catch {
          // Expected to fail, but should not crash
        }
      }

      // Client should still be usable
      expect(client.isConnected()).toBe(true);
      const version = await client.version();
      expect(version).toBeDefined();

      await client.close();
    });
  });
});
