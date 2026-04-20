/**
 * LLDB environment detection
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface LLDBEnvironment {
  available: boolean;
  pythonPath?: string;
  pythonVersion?: string;
  lldbVersion?: string;
  error?: string;
}

/**
 * Check if LLDB environment is available
 */
export async function checkLLDBEnvironment(
  pythonPath = "python3",
): Promise<LLDBEnvironment> {
  try {
    // Check Python version
    const { stdout: pythonVersion } = await execAsync(`${pythonPath} --version`);
    const versionMatch = pythonVersion.match(/Python (\d+\.\d+)/);

    if (!versionMatch) {
      return {
        available: false,
        pythonPath,
        error: "Failed to parse Python version",
      };
    }

    const majorMinor = versionMatch[1]!;
    const parts = majorMinor.split(".").map(Number);
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;

    if (major < 3 || (major === 3 && minor < 10)) {
      return {
        available: false,
        pythonPath,
        pythonVersion: majorMinor,
        error: `Python 3.10+ required, found ${majorMinor}`,
      };
    }

    // Check if lldb module is available
    const checkScript = `
import sys
try:
    import lldb
    print(lldb.SBDebugger.Create().GetVersionString())
except ImportError as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`;

    const { stdout: lldbOutput } = await execAsync(
      `${pythonPath} -c "${checkScript}"`,
    );

    if (lldbOutput.startsWith("ERROR:")) {
      return {
        available: false,
        pythonPath,
        pythonVersion: majorMinor,
        error: "lldb Python module not found",
      };
    }

    return {
      available: true,
      pythonPath,
      pythonVersion: majorMinor,
      lldbVersion: lldbOutput.trim(),
    };
  } catch (err) {
    return {
      available: false,
      pythonPath,
      error: `Environment check failed: ${err}`,
    };
  }
}
