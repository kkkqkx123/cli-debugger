/**
 * js-debug (JavaScript/TypeScript Debug Adapter) Client Implementation
 *
 * js-debug is the JavaScript/TypeScript debug adapter for VSCode's DAP.
 * This implementation connects to a js-debug DAP adapter over TCP.
 *
 * For Node.js --inspect debugging, the adapter bridges DAP to the
 * Chrome DevTools Protocol (CDP) used by Node.js/V8.
 *
 * Usage:
 *   const client = new JsDebugClient({ protocol: "js-debug", host: "127.0.0.1", port: 9229 });
 *   await client.connect();
 */

import type { DebugConfig } from "../../types/config.js";
import { BaseDAPClient, type DAPAdapterConfig } from "../dap/client.js";

/** Default js-debug adapter configuration */
const DEFAULT_LAUNCH_CONFIG: Record<string, unknown> = {
  type: "node",
  request: "attach",
  restart: false,
  localRoot: "${workspaceFolder}",
  remoteRoot: null,
  skipFiles: ["<node_internals>/**"],
  smartStep: true,
  showAsyncCalls: true,
};

/**
 * JsDebug Client implementation using DAP
 */
export class JsDebugClient extends BaseDAPClient {
  constructor(config: DebugConfig) {
    const launchConfig = { ...DEFAULT_LAUNCH_CONFIG };
    const configExt = config as Record<string, unknown>;
    if (configExt["launchConfig"] && typeof configExt["launchConfig"] === "object") {
      Object.assign(launchConfig, configExt["launchConfig"]);
    }
    const adapterConfig: DAPAdapterConfig = {
      name: "js-debug",
      languages: ["javascript", "typescript"],
      runtimeName: "node",
      protocolVersion: "1.0.0",
      launchConfig,
    };
    super(config, adapterConfig);
  }

  /**
   * JavaScript-specific: Evaluate console expression
   */
  async jsEval(expression: string, context: "repl" | "hover" | "watch" = "repl"): Promise<{ result: string; type: string }> {
    const response = await this.sendDAPRequest("evaluate", {
      expression,
      context,
    });
    const body = response.body as { result?: string; type?: string } | undefined;
    return {
      result: body?.result ?? "",
      type: body?.type ?? "unknown",
    };
  }

  /**
   * JavaScript-specific: Get runtime info (e.g., Node.js version)
   */
  async getRuntimeInfo(): Promise<{ runtime: string; version: string; description: string }> {
    try {
      const response = await this.sendDAPRequest("evaluate", {
        expression: "process.version",
        context: "repl",
      });
      const body = response.body as { result?: string } | undefined;
      const version = body?.result ?? "unknown";
      return {
        runtime: "node",
        version,
        description: `Node.js ${version}`,
      };
    } catch {
      return {
        runtime: "unknown",
        version: "unknown",
        description: "Could not determine runtime info",
      };
    }
  }
}