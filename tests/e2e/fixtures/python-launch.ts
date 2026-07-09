/**
 * Python/debugpy launch utilities for E2E testing
 * Provides functions to start Python programs with debugpy debugging enabled
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export interface LaunchOptions {
  programName: string;
  debugPort?: number;
  pythonArgs?: string[];
}

export interface LaunchedPython {
  process: ChildProcess;
  debugPort: number;
  pid: number;
  stdout: string;
  stderr: string;
}

const FIXTURE_DIR = path.join(__dirname, "python");

/**
 * Check if Python is available
 */
export async function checkPythonAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("python3", ["--version"], { stdio: "pipe" });
    proc.on("error", () => {
      // Try `python` instead
      const proc2 = spawn("python", ["--version"], { stdio: "pipe" });
      proc2.on("error", () => resolve(false));
      proc2.on("close", (code) => resolve(code === 0));
    });
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Check if debugpy is available
 */
export async function checkDebugPyAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("python3", ["-m", "debugpy", "--version"], { stdio: "pipe" });
    proc.on("error", () => {
      const proc2 = spawn("python", ["-m", "debugpy", "--version"], { stdio: "pipe" });
      proc2.on("error", () => resolve(false));
      proc2.on("close", (code) => resolve(code === 0));
    });
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Get the Python executable name (python3 or python)
 */
async function getPythonExecutable(): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn("python3", ["--version"], { stdio: "pipe" });
    proc.on("error", () => resolve("python"));
    proc.on("close", (code) => resolve(code === 0 ? "python3" : "python"));
  });
}

/**
 * Check if source file exists
 */
async function checkSourceExists(programName: string): Promise<string> {
  const sourceFile = path.join(FIXTURE_DIR, `${programName}.py`);
  try {
    await fs.access(sourceFile);
    return sourceFile;
  } catch {
    throw new Error(`Source file not found: ${sourceFile}`);
  }
}

/**
 * Launch Python program with debugpy debugging
 * Uses debugpy to listen for DAP connections
 */
export async function launchPython(options: LaunchOptions): Promise<LaunchedPython> {
  const debugPort = options.debugPort ?? 5678 + Math.floor(Math.random() * 1000);
  await checkSourceExists(options.programName);
  const pythonExe = await getPythonExecutable();

  // Build args for debugpy
  // python -m debugpy --listen 127.0.0.1:{port} --wait-for-client {program}.py
  const args: string[] = [
    "-m",
    "debugpy",
    "--listen",
    `127.0.0.1:${debugPort}`,
    "--wait-for-client",
    `${options.programName}.py`,
  ];

  if (options.pythonArgs) {
    args.push(...options.pythonArgs);
  }

  const proc = spawn(pythonExe, args, {
    stdio: "pipe",
    cwd: FIXTURE_DIR,
  });

  let stdout = "";
  let stderr = "";

  proc.stdout?.on("data", (data: Buffer) => {
    stdout += data.toString();
  });

  proc.stderr?.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  // Wait for debugpy to be ready
  await waitForDebugPyReady(proc, debugPort);

  return {
    process: proc,
    debugPort,
    pid: proc.pid!,
    stdout,
    stderr,
  };
}

/**
 * Wait for debugpy to be ready for connection.
 * debugpy does not emit a "listening" message and each probe connection
 * creates a real session that interferes with the subsequent DAPTransport
 * connection, so we just wait for a grace period.
 */
async function waitForDebugPyReady(
  proc: ChildProcess,
  port: number,
  timeout: number = 15000,
): Promise<void> {
  // Don't probe the port - debugpy handles each probe connection as a real session,
  // which interferes with the subsequent DAPTransport connection. Just wait.
  await new Promise((r) => setTimeout(r, 2000));
}

/**
 * Terminate Python process
 */
export async function terminatePython(proc: LaunchedPython): Promise<void> {
  return new Promise((resolve) => {
    const onClose = () => resolve();
    const onError = () => resolve();

    proc.process.on("close", onClose);
    proc.process.on("error", onError);

    try {
      proc.process.kill("SIGTERM");
    } catch {
      resolve();
      return;
    }

    setTimeout(() => {
      try {
        proc.process.kill("SIGKILL");
      } catch {
        // Ignore
      }
      resolve();
    }, 3000);
  });
}

/**
 * Launch simple program
 */
export async function launchSimpleProgram(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedPython> {
  const debugPort = options.debugPort ?? 5678 + Math.floor(Math.random() * 1000);
  return launchPython({
    programName: "simple_program",
    ...options,
    debugPort,
  });
}