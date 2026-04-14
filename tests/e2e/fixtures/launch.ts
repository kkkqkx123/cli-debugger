/**
 * JVM launch utilities for E2E testing
 * Provides functions to start Java programs with JDWP debugging enabled
 */

import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

/**
 * Launch options
 */
export interface LaunchOptions {
  mainClass: string;
  classpath?: string;
  debugPort?: number;
  suspend?: boolean;
  vmArgs?: string[];
  programArgs?: string[];
}

/**
 * Launched JVM process
 */
export interface LaunchedJVM {
  process: ChildProcess;
  debugPort: number;
  pid: number;
  stdout: string;
  stderr: string;
}

/**
 * Java fixture directory
 */
const FIXTURE_DIR = path.join(__dirname, "java");

/**
 * Check if Java is available
 */
export async function checkJavaAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("java", ["-version"], { stdio: "pipe" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Get Java version
 */
export async function getJavaVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn("java", ["-version"], { stdio: "pipe" });
    let output = "";

    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      const match = output.match(/version "([^"]+)"/);
      resolve(match ? match[1] : null);
    });

    proc.on("error", () => resolve(null));
  });
}

/**
 * Compile Java fixture
 */
export async function compileFixture(className: string): Promise<string> {
  const sourceFile = path.join(FIXTURE_DIR, `${className}.java`);

  // Check if source exists
  try {
    await fs.access(sourceFile);
  } catch {
    throw new Error(`Source file not found: ${sourceFile}`);
  }

  // Compile
  return new Promise((resolve, reject) => {
    const proc = spawn("javac", [sourceFile], { stdio: "pipe" });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(FIXTURE_DIR);
      } else {
        reject(new Error(`Compilation failed with code ${code}`));
      }
    });
  });
}

/**
 * Launch Java program with JDWP debugging
 */
export async function launchJava(options: LaunchOptions): Promise<LaunchedJVM> {
  const debugPort = options.debugPort ?? 5005;
  const suspend = options.suspend ? "y" : "n";

  const args: string[] = [];

  // JDWP agent
  args.push(
    `-agentlib:jdwp=transport=dt_socket,server=y,suspend=${suspend},address=*:${debugPort}`,
  );

  // Classpath
  if (options.classpath) {
    args.push("-cp", options.classpath);
  } else {
    args.push("-cp", FIXTURE_DIR);
  }

  // VM arguments
  if (options.vmArgs) {
    args.push(...options.vmArgs);
  }

  // Main class
  args.push(options.mainClass);

  // Program arguments
  if (options.programArgs) {
    args.push(...options.programArgs);
  }

  const proc = spawn("java", args, { stdio: "pipe" });

  // Collect output
  let stdout = "";
  let stderr = "";

  proc.stdout?.on("data", (data) => {
    stdout += data.toString();
  });

  proc.stderr?.on("data", (data) => {
    stderr += data.toString();
  });

  // Wait for debugger to be ready
  await waitForDebugReady(proc, debugPort);

  return {
    process: proc,
    debugPort,
    pid: proc.pid!,
    stdout,
    stderr,
  };
}

/**
 * Wait for JVM to be ready for debugger connection
 */
async function waitForDebugReady(
  proc: ChildProcess,
  port: number,
  timeout: number = 10000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for debug port ${port}`));
    }, timeout);

    proc.stderr?.on("data", (data) => {
      const message = data.toString();
      if (
        message.includes(`Listening for transport dt_socket at address: ${port}`)
      ) {
        clearTimeout(timeoutId);
        resolve();
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

/**
 * Terminate JVM process
 */
export async function terminateJava(jvm: LaunchedJVM): Promise<void> {
  return new Promise((resolve) => {
    jvm.process.on("close", resolve);
    jvm.process.kill("SIGTERM");

    // Force kill after timeout
    setTimeout(() => {
      try {
        jvm.process.kill("SIGKILL");
      } catch {
        // Ignore
      }
    }, 5000);
  });
}

/**
 * Launch simple program
 */
export async function launchSimpleProgram(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedJVM> {
  await compileFixture("SimpleProgram");
  return launchJava({
    mainClass: "SimpleProgram",
    ...options,
  });
}

/**
 * Launch multi-thread program
 */
export async function launchMultiThreadProgram(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedJVM> {
  await compileFixture("MultiThreadProgram");
  return launchJava({
    mainClass: "MultiThreadProgram",
    ...options,
  });
}

/**
 * Launch breakpoint test program
 */
export async function launchBreakpointTest(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedJVM> {
  await compileFixture("BreakpointTest");
  return launchJava({
    mainClass: "BreakpointTest",
    ...options,
  });
}

/**
 * Launch exception test program
 */
export async function launchExceptionTest(
  options: Partial<LaunchOptions> = {},
): Promise<LaunchedJVM> {
  await compileFixture("ExceptionTest");
  return launchJava({
    mainClass: "ExceptionTest",
    ...options,
  });
}
