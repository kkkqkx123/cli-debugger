/**
 * Connection lifecycle integration tests
 * Tests JDWP client connection management
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JDWPClient } from "../../../src/protocol/jdwp/client.js";
import { MockJDWPServer } from "./fixtures/index.js";
import type { DebugConfig } from "../../../src/types/config.js";

describe("Connection Lifecycle", () => {
  let server: MockJDWPServer;
  let port: number;
  let config: DebugConfig;

  beforeEach(async () => {
    server = new MockJDWPServer();
    port = await server.start();
    config = {
      protocol: "jdwp",
      host: "127.0.0.1",
      port,
      timeout: 5000,
    };
  });

  afterEach(async () => {
    await server.stop();
  });

  describe("full_lifecycle", () => {
    it("should complete full connection lifecycle", async () => {
      const client = new JDWPClient(config);

      // Initially not connected
      expect(client.isConnected()).toBe(false);

      // Connect
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Execute a simple command
      const version = await client.version();
      expect(version).toBeDefined();
      expect(version.protocolVersion).toBeDefined();

      // Close
      await client.close();
      expect(client.isConnected()).toBe(false);
    });

    it("should handle multiple connect calls gracefully", async () => {
      const client = new JDWPClient(config);

      // First connect
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Second connect should be no-op
      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.close();
    });

    it("should handle multiple close calls gracefully", async () => {
      const client = new JDWPClient(config);

      await client.connect();

      // First close
      await client.close();
      expect(client.isConnected()).toBe(false);

      // Second close should be no-op
      await client.close();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("connect_disconnect_reconnect", () => {
    it("should support connect-disconnect-reconnect cycle", async () => {
      const client = new JDWPClient(config);

      // First connection
      await client.connect();
      expect(client.isConnected()).toBe(true);
      const version1 = await client.version();

      // Disconnect
      await client.close();
      expect(client.isConnected()).toBe(false);

      // Reconnect
      await client.connect();
      expect(client.isConnected()).toBe(true);
      const version2 = await client.version();

      // Should work after reconnect
      expect(version2).toBeDefined();

      await client.close();
    });

    it("should handle rapid connect/disconnect cycles", async () => {
      const cycles = 5;

      for (let i = 0; i < cycles; i++) {
        const client = new JDWPClient(config);
        await client.connect();
        expect(client.isConnected()).toBe(true);
        await client.close();
        expect(client.isConnected()).toBe(false);
      }
    });
  });

  describe("multiple_clients", () => {
    it("should support multiple concurrent clients", async () => {
      const clientCount = 3;
      const clients: JDWPClient[] = [];

      // Create and connect multiple clients
      for (let i = 0; i < clientCount; i++) {
        const client = new JDWPClient(config);
        await client.connect();
        expect(client.isConnected()).toBe(true);
        clients.push(client);
      }

      // All clients should be connected
      for (const client of clients) {
        expect(client.isConnected()).toBe(true);
      }

      // Execute commands on all clients concurrently
      const results = await Promise.all(
        clients.map((client) => client.version()),
      );

      // All should succeed
      for (const result of results) {
        expect(result).toBeDefined();
      }

      // Close all clients
      await Promise.all(clients.map((client) => client.close()));

      // All should be disconnected
      for (const client of clients) {
        expect(client.isConnected()).toBe(false);
      }
    });

    it("should handle concurrent operations on same client", async () => {
      const client = new JDWPClient(config);
      await client.connect();

      // Execute multiple commands concurrently
      const results = await Promise.all([
        client.version(),
        client.capabilities(),
        client.protocolName(),
        client.supportedLanguages(),
      ]);

      expect(results[0]).toBeDefined(); // version
      expect(results[1]).toBeDefined(); // capabilities
      expect(results[2]).toBe("jdwp"); // protocolName
      expect(results[3]).toContain("java"); // supportedLanguages

      await client.close();
    });
  });

  describe("connection_timeout_recovery", () => {
    it("should handle connection timeout gracefully", async () => {
      const client = new JDWPClient({
        protocol: "jdwp",
        host: "192.0.2.1", // Non-routable IP (should timeout)
        port: 5005,
        timeout: 1000, // Short timeout
      });

      // Should throw timeout error
      await expect(client.connect()).rejects.toThrow();

      expect(client.isConnected()).toBe(false);
    });

    it("should recover from timeout and connect to valid address", async () => {
      // First try invalid address
      const client1 = new JDWPClient({
        protocol: "jdwp",
        host: "192.0.2.1",
        port: 5005,
        timeout: 1000,
      });

      await expect(client1.connect()).rejects.toThrow();

      // Now try valid address
      const client2 = new JDWPClient(config);
      await client2.connect();
      expect(client2.isConnected()).toBe(true);
      await client2.close();
    });
  });

  describe("graceful_close_during_command", () => {
    it("should handle close during command execution", async () => {
      const client = new JDWPClient(config);
      await client.connect();

      // Start a command and immediately close
      const commandPromise = client.version();
      const closePromise = client.close();

      // Both should complete without error
      await Promise.allSettled([commandPromise, closePromise]);

      expect(client.isConnected()).toBe(false);
    });
  });

  describe("connection_state", () => {
    it("should correctly report connection state", async () => {
      const client = new JDWPClient(config);

      // Before connect
      expect(client.isConnected()).toBe(false);

      // After connect
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // After close
      await client.close();
      expect(client.isConnected()).toBe(false);
    });

    it("should throw error when executing command on disconnected client", async () => {
      const client = new JDWPClient(config);

      // Not connected
      expect(client.isConnected()).toBe(false);

      // Should throw
      await expect(client.version()).rejects.toThrow();
    });
  });

  describe("protocol_metadata", () => {
    it("should return correct protocol name", () => {
      const client = new JDWPClient(config);
      expect(client.protocolName()).toBe("jdwp");
    });

    it("should return supported languages", () => {
      const client = new JDWPClient(config);
      const languages = client.supportedLanguages();
      expect(languages).toContain("java");
      expect(languages).toContain("kotlin");
      expect(languages).toContain("scala");
    });
  });
});
