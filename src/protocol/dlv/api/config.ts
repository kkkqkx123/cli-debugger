/**
 * Delve debugger configuration API
 * Manage debugger settings and path substitutions
 */

import type { DlvRpcClient } from "../rpc.js";

/**
 * Debugger configuration settings
 */
export interface DlvDebuggerConfig {
  showLocationRegex: boolean;
  substitutePathRules: Array<{ from: string; to: string }>;
  debugInfoDirectories: string[];
  maxStringLen: number;
  maxArrayValues: number;
  maxVariableRecurse: number;
  maxStructFields: number;
}

/**
 * Get current debugger configuration
 * @param rpc - RPC client
 * @returns Current configuration settings
 */
export async function getConfig(rpc: DlvRpcClient): Promise<DlvDebuggerConfig> {
  return rpc.call<DlvDebuggerConfig>("RPCServer.GetConfig", []);
}

/**
 * Set debugger configuration
 * @param rpc - RPC client
 * @param config - Partial configuration to update
 */
export async function setConfig(
  rpc: DlvRpcClient,
  config: Partial<DlvDebuggerConfig>,
): Promise<void> {
  await rpc.call("RPCServer.SetConfig", [config]);
}

/**
 * Add a path substitution rule
 * Used for mapping source paths between local and remote systems
 * @param rpc - RPC client
 * @param from - Original path pattern
 * @param to - Replacement path
 */
export async function addSubstitutePath(
  rpc: DlvRpcClient,
  from: string,
  to: string,
): Promise<void> {
  await rpc.call("RPCServer.AddSubstitutePath", [{ from, to }]);
}

/**
 * Remove a path substitution rule
 * @param rpc - RPC client
 * @param from - Path pattern to remove
 */
export async function removeSubstitutePath(
  rpc: DlvRpcClient,
  from: string,
): Promise<void> {
  await rpc.call("RPCServer.RemoveSubstitutePath", [{ from }]);
}
