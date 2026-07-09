/**
 * DebugPy Client Implementation
 *
 * DebugPy is the Python debug adapter for DAP (Debug Adapter Protocol).
 * This implementation connects to a debugpy TCP adapter and communicates
 * using the DAP (Debug Adapter Protocol) wire format.
 *
 * Usage:
 *   const client = new DebugPyClient({ protocol: "py-debug", host: "127.0.0.1", port: 5678 });
 *   await client.connect();
 */

import type { DebugConfig } from "../../types/config.js";
import { BaseDAPClient, type DAPAdapterConfig } from "../dap/client.js";

/** Default py-debug adapter configuration */
const DEFAULT_LAUNCH_CONFIG: Record<string, unknown> = {
  type: "python",
  request: "attach",
  pathMappings: [],
  justMyCode: true,
  showReturnValue: false,
  logToFile: false,
  debugOptions: ["RedirectOutput"],
};

/**
 * DebugPy Client implementation using DAP
 */
export class DebugPyClient extends BaseDAPClient {
  constructor(config: DebugConfig) {
    const launchConfig = { ...DEFAULT_LAUNCH_CONFIG };
    const configExt = config as Record<string, unknown>;
    if (configExt["launchConfig"] && typeof configExt["launchConfig"] === "object") {
      Object.assign(launchConfig, configExt["launchConfig"]);
    }
    const adapterConfig: DAPAdapterConfig = {
      name: "py-debug",
      languages: ["python"],
      runtimeName: "python",
      protocolVersion: "1.0.0",
      launchConfig,
    };
    super(config, adapterConfig);
  }

  /**
   * Python-specific: Evaluate expression using the debugger's internals
   * (e.g., sys module, os module, or debugger utilities)
   */
  async pythonEval(expression: string, context: "repl" | "hover" | "watch" = "repl"): Promise<{ result: string; type: string }> {
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
   * Python-specific: Get Python runtime version
   */
  async getPythonVersion(): Promise<string> {
    try {
      const response = await this.sendDAPRequest("evaluate", {
        expression: "sys.version",
        context: "repl",
      });
      const body = response.body as { result?: string } | undefined;
      return body?.result ?? "unknown";
    } catch {
      return "unknown";
    }
  }
}