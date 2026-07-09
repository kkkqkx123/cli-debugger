/**
 * Node.js/js-debug launch utilities for E2E testing
 * Provides functions to start Node.js programs with --inspect debugging
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export interface LaunchOptions {
  programName: string;
  debugPort?: number;
  nodeArgs?: string[];
}

export interface LaunchedNode {
  process: ChildProcess;
  debugPort: number;
  pid: number;
  stdout: string;
  stderr: string;
}

const FIXTURE_DIR = path.join(__dirname, "js");

/**
 * Check if Node.js is available
 */
export async function checkNodeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--version"], { stdio: "pipe" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Check if source file exists
 */
async function checkSourceExists(programName: string): Promise<string> {
  const sourceFile = path.join(FIXTURE_DIR, `${programName}.js`);
  try {
    await fs.access(sourceFile);
    return sourceFile;
  } catch {
    throw new Error(`Source file not found: ${sourceFile}`);
  }
}

/**
 * Launch Node.js program with --inspect for js-debug
 */
export async function launchNode(options: LaunchOptions): Promise<LaunchedNode> {
  const debugPort = options.debugPort ?? 9229 + Math.floor(Math.random() * 1000);
  await checkSourceExists(options.programName);

  // node --inspect-brk=port program.js
  const args: string[] = [
    `--inspect-brk=127.0.0.1:${debugPort}`,
    `${options.programName}.js`,
  ];

  if (options.nodeArgs) {
    args.push(...options.nodeArgs);
  }

  const proc = spawn("node", args, {
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

  // Wait for Node.js to be ready for debugger connection
  await waitForNodeReady(proc, debugPort);

  return {
    process: proc,
    debugPort,
    pid: proc.pid!,
    stdout,
    stderr,
  };
}

/**
 * Wait for Node.js to be ready for debugger connection
 */
async function waitForNodeReady(
  proc: ChildProcess,
  port: number,
  timeout: number = 15000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        reject(new Error(`Timeout waiting for Node.js debugger on port ${port}`));
      }
    }, timeout);

    const checkMessage = (data: Buffer) => {
      if (resolved) return;
      const message = data.toString();
      if (message.includes("Debugger listening") || message.includes(`ws://127.0.0.1:${port}`) || message.includes(`localhost:${port}`)) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve();
      }
    };

    proc.stdout?.on("data", checkMessage);
    proc.stderr?.on("data", checkMessage);

    proc.on("error", (err: Error) => {
      if (!resolved) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });

    proc.on("close", (code: number | null) => {
      if (!resolved) {
        clearTimeout(timeoutId);
        reject(new Error(`Process exited with code ${code} before ready`));
      }
    });
  });
}

/**
 * Terminate Node.js process
 */
export async function terminateNode(proc: LaunchedNode): Promise<void> {
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
): Promise<LaunchedNode> {
  const debugPort = options.debugPort ?? 9229 + Math.floor(Math.random() * 1000);
  return launchNode({
    programName: "simple_app",
    ...options,
    debugPort,
  });
}