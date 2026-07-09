/**
 * Basic Python Debugging Example
 *
 * Demonstrates connecting to a DebugPy target, using assertions,
 * and querying debug state.
 *
 * Usage:
 *   npx tsx examples/basic-python.ts
 *
 * Prerequisites:
 *   Python application running with debugpy:
 *     python -m debugpy --listen 5678 --wait-for-client app.py
 */

import { Debugger } from "../src/sdk/index.js";

async function main() {
  // 1. Create a Debugger instance for Python debugging
  const dbg = new Debugger({
    protocol: "debugpy",
    host: "127.0.0.1",
    port: 5678,
    timeout: 30000,
  });

  // 2. Connect
  console.log("Connecting to Python process...");
  await dbg.connect();
  console.log("Connected!");

  // 3. Set a breakpoint
  await dbg.breakpoint("app.py:10");

  // 4. Continue and wait
  await dbg.continue();

  // 5. Use assertions to verify state
  dbg.on("breakpoint", async () => {
    // Assert variable values
    try {
      await dbg.assert.variable("count", 5);
      console.log("✓ count equals 5");
    } catch {
      console.log("✗ count is not 5");
    }

    // Assert variable type
    try {
      await dbg.assert.variableType("name", "str");
      console.log("✓ name is a string");
    } catch {
      console.log("✗ name is not a string");
    }

    // Evaluate expression
    const expr = await dbg.evaluate("count + 1");
    console.log("count + 1 =", expr.value);

    await dbg.continue();
  });

  setTimeout(async () => {
    await dbg.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  }, 30000);
}

main().catch(console.error);