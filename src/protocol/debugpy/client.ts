/**
 * DebugPy Client Implementation
 *
 * DebugPy is the Python debug adapter for DAP (Debug Adapter Protocol).
 * This implementation connects to a debugpy TCP adapter and communicates
 * using the DAP (Debug Adapter Protocol) wire format.
 *
 * Usage:
 *   const client = new DebugPyClient({ protocol: "debugpy", host: "127.0.0.1", port: 5678 });
 *   await client.connect();
 */

import type { DebugConfig } from "../../types/config.js";
import { BaseDAPClient, type DAPAdapterConfig } from "../dap/client.js";

/** Default debugpy adapter configuration */
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
      name: "debugpy",
      languages: ["python"],
      runtimeName: "python",
      protocolVersion: "1.0.0",
      launchConfig,
    };
    super(config, adapterConfig);
  }
}