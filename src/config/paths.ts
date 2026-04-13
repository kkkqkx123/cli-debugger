/**
 * Cross-platform path resolution for configuration files
 */

import os from "node:os";
import path from "node:path";
import process from "node:process";

/**
 * Returns the path to the config directory
 * Priority: DEBUGGER_CONFIG_PATH env > default (~/.config/debugger)
 */
export function getConfigPath(): string {
  const envPath = process.env["DEBUGGER_CONFIG_PATH"];
  if (envPath) return envPath;

  const homeDir = os.homedir();
  return path.join(homeDir, ".config", "debugger");
}

/**
 * Returns the path to the cache directory
 * Priority: DEBUGGER_CACHE_PATH env > default (~/.cache/debugger)
 */
export function getCachePath(): string {
  const envPath = process.env["DEBUGGER_CACHE_PATH"];
  if (envPath) return envPath;

  const homeDir = os.homedir();
  return path.join(homeDir, ".cache", "debugger");
}

/**
 * Returns the path to the log directory
 * Priority: DEBUGGER_LOG_PATH env > default (<cache>/logs)
 */
export function getLogPath(): string {
  const envPath = process.env["DEBUGGER_LOG_PATH"];
  if (envPath) return envPath;

  return path.join(getCachePath(), "logs");
}
