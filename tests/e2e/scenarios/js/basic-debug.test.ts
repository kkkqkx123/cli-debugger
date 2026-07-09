/**
 * JavaScript/js-debug Basic Debug E2E Tests
 *
 * Real-world business scenarios:
 * - A: User connects to a running debug target via js-debug DAP adapter
 * - G: User disconnects cleanly
 * - I: User creates client through protocol factory
 *
 * Note: js-debug is a DAP adapter that mediates between the client
 * and Node.js's Chrome DevTools Protocol (CDP). These tests require
 * a running js-debug DAP adapter to be available on the configured port.
 *
 * Prerequisites:
 * - A js-debug DAP adapter (from VS Code's js-debug extension or standalone build)
 * - Node.js with --inspect running
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { JsDebugClient, createClientWithoutConnect } from "../../../../src/protocol/index.js";
import {
  checkNodeAvailable,
  launchSimpleProgram,
  terminateNode,
} from "../../fixtures/js-launch.js";
import type { LaunchedNode } from "../../fixtures/js-launch.js";
import type { DebugConfig } from "../../../../src/types/config.js";

let dapMediatorAvailable = false;

beforeAll(async () => {
  // js-debug requires a DAP adapter mediator.
  // The standard Node.js --inspect exposes CDP, not DAP.
  // Set JS_DEBUG_DAP_HOST/PORT to point to a running js-debug DAP adapter.
  const envHost = process.env.JS_DEBUG_DAP_HOST;
  const envPort = process.env.JS_DEBUG_DAP_PORT;
  dapMediatorAvailable = !!(envHost && envPort);

  if (!dapMediatorAvailable) {
    console.log(
      "js-debug DAP adapter not configured. Set JS_DEBUG_DAP_HOST and JS_DEBUG_DAP_PORT " +
      "environment variables pointing to a running js-debug DAP adapter."
    );
  }
});

describe("JavaScript Basic Debug E2E", () => {
  let client: JsDebugClient | null = null;
  let debugPort = 0;

  afterEach(async () => {
    if (client) {
      await client.close().catch(() => {});
      client = null;
    }
  });

  describe("connects to js-debug DAP adapter (Scenario A)", () => {
    it("should connect and get protocol metadata", { skip: !dapMediatorAvailable }, async () => {
      const config: DebugConfig = {
        protocol: "js-debug",
        host: process.env.JS_DEBUG_DAP_HOST!,
        port: parseInt(process.env.JS_DEBUG_DAP_PORT!, 10),
        timeout: 15000,
      };

      client = new JsDebugClient(config);
      await client.connect();
      expect(client.isConnected()).toBe(true);

      expect(client.protocolName()).toBe("js-debug");
      expect(client.supportedLanguages()).toContain("javascript");
      expect(client.supportedLanguages()).toContain("typescript");
    });
  });

  describe("factory creation (Scenario I)", () => {
    it("should create js-debug client through protocol factory", { skip: !dapMediatorAvailable }, async () => {
      const client2 = createClientWithoutConnect({
        protocol: "js-debug",
        host: process.env.JS_DEBUG_DAP_HOST!,
        port: parseInt(process.env.JS_DEBUG_DAP_PORT!, 10),
        timeout: 15000,
      });
      expect(client2.protocolName()).toBe("js-debug");
      await client2.connect();
      expect(client2.isConnected()).toBe(true);
      await client2.close();
    });
  });

  describe("clean disconnect (Scenario G)", () => {
    it("should disconnect without errors", { skip: !dapMediatorAvailable }, async () => {
      client = new JsDebugClient({
        protocol: "js-debug",
        host: process.env.JS_DEBUG_DAP_HOST!,
        port: parseInt(process.env.JS_DEBUG_DAP_PORT!, 10),
        timeout: 15000,
      });
      await client.connect();
      expect(client.isConnected()).toBe(true);
      await client.close();
      expect(client.isConnected()).toBe(false);
    });
  });
});