/**
 * Delve launch utilities for E2E testing
 * Provides functions to start Go programs with Delve debugging enabled
 */

import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

/**
 * Launch options
 */
export interface LaunchOptions {
  programName: string;
  debugPort?: number;
  headless?: boolean;
  apiVersion?: number;
  dlvArgs?: string[];
}

/**
 * Launched Delve process
 */
export interface LaunchedDelve {
  process: ChildProcess;
  debugPort: number;
  pid: number;
  stdout: string;
  stderr: string;
}

/**
 * Go fixture directory
 */
const FIXTURE_DIR = path.join(__dirname, "go");

/**
 * Check if Go is available
 */
export async function checkGoAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("go", ["version"], { stdio: "pipe" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Get Go version
 */
export async function getGoVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn("go", ["version"], { stdio: "pipe" });
    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      const match = output.match(/go(\d+\.\d+(?:\.\d+)?)/);
      resolve(match ? match[1] : null);
    });

    proc.on("error", () => resolve(null));
  });
}

/**
 * Check if Delve is available
 */
export async function checkDelveAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("dlv", ["version"], { stdio: "pipe" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Get Delve version
 */
export async function getDelveVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn("dlv", ["version"], { stdio: "pipe" });
    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      const match = output.match(/Version: (\S+)/);
      resolve(match ? match[1] : null);
    });

    proc.on("error", () => resolve(null));
  });
}

/**
 * Check if source file exists
 */
async function checkSourceExists(programName: string): Promise<string> {
  const sourceFile = path.join(FIXTURE_DIR, `${programName}.go`);

  try {
    await fs.access(sourceFile);
    return sourceFile;
  } catch {
    throw new Error(`Source file not found: ${sourceFile}`);
  }
}

/**
 * Launch Go program with Delve debugging
 * Uses 'dlv debug' which compiles and starts the program
 */
export async function launchDelve(options: LaunchOptions): Promise<LaunchedDelve> {
  const debugPort = options.debugPort ?? 4040;
  const apiVersion = options.apiVersion ?? 2;
  await checkSourceExists(options.programName);

  // Build dlv arguments
  // Using 'dlv debug' which compiles and starts the program
  // The program will pause at entry point
  // Note: We pass just the filename, not the full path, and run from FIXTURE_DIR
  const args = [
    "debug",
    `${options.programName}.go`,
    "--headless",
    `--listen=127.0.0.1:${debugPort}`,
    `--api-version=${apiVersion}`,
    "--log", // Enable logging for debugging
  ];

  // Add any extra dlv args
  if (options.dlvArgs) {
    args.push(...options.dlvArgs);
  }

  const proc = spawn("dlv", args, {
    stdio: "pipe",
    cwd: FIXTURE_DIR,
  });

  // Collect output
  let stdout = "";
  let stderr = "";

  proc.stdout?.on("data", (data) => {
    stdout += data.toString();
  });

  proc.stderr?.on("data", (data) => {
    stderr += data.toString();
  });

  // Wait for Delve to be ready
  await waitForDelveReady(proc, debugPort);

  return {
    process: proc,
    debugPort,
    pid: proc.pid!,
    stdout,
    stderr,
  };
}

/**
 * Wait for Delve to be ready for debugger connection
 */
async function waitForDelveReady(
  proc: ChildProcess,
  port: number,
  timeout: number = 15000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        reject(new Error(`Timeout waiting for Delve on port ${port}`));
      }
    }, timeout);

    const checkMessage = (data: Buffer) => {
      if (resolved) return;
      const message = data.toString();
      // Check for API server listening message
      if (
        message.includes(`API server listening at: 127.0.0.1:${port}`) ||
        message.includes(`listening at: 127.0.0.1:${port}`)
      ) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve();
      }
    };

    // Listen to both stdout and stderr
    proc.stdout?.on("data", checkMessage);
    proc.stderr?.on("data", checkMessage);

    proc.on("error", (err) => {
      if (!resolved) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (!resolved) {
        clearTimeout(timeoutId);
        if (code !== 0) {
          reject(new Error(`Delve exited with code ${code}`));
        } else {
          // Process exited cleanly but we didn't see the ready message
          reject(new Error("Delve exited before ready message was received"));
        }
      }
    });
  });
}

/**
 * Terminate Delve process
 */
export async function terminateDelve(delve: LaunchedDelve): Promise<void> {
  return new Promise((resolve) => {
    const onClose = () => {
      resolve();
    };

    const onError = () => {
      // Process might already be dead
      resolve();
    };

    delve.process.on("close", onClose);
    delve.process.on("error", onError);

    // Try to kill gracefully
    try {
      delve.process.kill("SIGTERM");
    } catch {
      // Process might already be dead
      resolve();
      return;
    }

    // Force kill after timeout
    setTimeout(() => {
      try {
        delve.process.kill("SIGKILL");
      } catch {
        // Ignore
      }
      resolve();
    }, 3000);
  });
}

/**
 * Generate a random debug port to avoid conflicts
 */
function getRandomPort(base: number = 4040): number {
  return base + Math.floor(Math.random() * 1000);
}

/**
 * Launch simple program
 */
export async function launchSimpleProgram(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedDelve> {
  const debugPort = options.debugPort ?? getRandomPort();
  return launchDelve({
    programName: "simple_program",
    ...options,
    debugPort,
  });
}

/**
 * Launch breakpoint test program
 */
export async function launchBreakpointTest(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedDelve> {
  const debugPort = options.debugPort ?? getRandomPort();
  return launchDelve({
    programName: "breakpoint_test",
    ...options,
    debugPort,
  });
}

/**
 * Launch step test program
 */
export async function launchStepTest(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedDelve> {
  const debugPort = options.debugPort ?? getRandomPort();
  return launchDelve({
    programName: "step_test",
    ...options,
    debugPort,
  });
}

/**
 * Launch variable test program
 */
export async function launchVariableTest(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedDelve> {
  const debugPort = options.debugPort ?? getRandomPort();
  return launchDelve({
    programName: "variable_test",
    ...options,
    debugPort,
  });
}

/**
 * Launch multi-thread program
 */
export async function launchMultiThreadProgram(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedDelve> {
  const debugPort = options.debugPort ?? getRandomPort();
  return launchDelve({
    programName: "multi_thread_program",
    ...options,
    debugPort,
  });
}
