/**
 * Advanced Assertion Example
 *
 * Demonstrates all assertion types available in the SDK.
 * Useful for integration testing and automated debugging.
 *
 * Usage:
 *   npx tsx examples/advanced-assert.ts
 */

import { Debugger } from "../src/sdk/index.js";

async function main() {
  const dbg = new Debugger({
    protocol: "jdwp",
    host: "127.0.0.1",
    port: 5005,
    timeout: 30000,
  });

  await dbg.connect();
  await dbg.breakpoint("App.java:42");
  await dbg.continue();

  dbg.on("breakpoint", async () => {
    try {
      // Breakpoint assertions
      await dbg.assert.hitBreakpoint("bp-1");
      console.log("✓ Breakpoint bp-1 was hit");

      await dbg.assert.breakpointExists("App.java:42");
      console.log("✓ Breakpoint exists at App.java:42");

      // Variable assertions
      await dbg.assert.variable("count", 5);
      console.log("✓ Variable count === 5");

      await dbg.assert.variableType("count", "int");
      console.log("✓ Variable count is int");

      await dbg.assert.variableSatisfies("count", (v) => v > 0, "count should be positive");
      console.log("✓ count > 0");

      // Expression assertions
      await dbg.assert.expression("count + 1", 6);
      console.log("✓ Expression count + 1 === 6");

      await dbg.assert.expressionThrows("1 / 0", /division/);
      console.log("✓ Expression 1/0 throws division error");

      // State assertions
      await dbg.assert.paused();
      console.log("✓ Debugger is paused");

      await dbg.assert.topFrame("App.main");
      console.log("✓ Top frame is App.main");

      await dbg.assert.stackDepth(5);
      console.log("✓ Stack depth is 5");

      console.log("\nAll assertions passed!");
    } catch (err: any) {
      console.error("Assertion failed:", err.message);
    }

    await dbg.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);