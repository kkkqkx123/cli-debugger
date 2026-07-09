/**
 * Advanced Watch & Monitoring Example
 *
 * Demonstrates variable watching, expression monitoring,
 * and change detection features of the SDK.
 *
 * Usage:
 *   npx tsx examples/advanced-watch.ts
 *
 * This script monitors variables and expressions in a
 * running debug session, notifying on changes.
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
  console.log("Connected to debug target");

  // 1. Watch a variable — callback fires on every poll tick
  const varWatch = await dbg.watchVariable(
    "counter",
    (oldVal, newVal) => {
      console.log(`counter changed: ${oldVal} → ${newVal}`);
    },
    { interval: 500, timeout: 60000 },
  );

  // 2. Watch an expression
  const exprWatch = await dbg.watchExpression(
    "counter > 100",
    (oldVal, newVal) => {
      if (newVal === true) {
        console.log("⚠ counter exceeded 100!");
      }
    },
    { interval: 500, timeout: 60000 },
  );

  // 3. Cancel the expression watch after 30s
  setTimeout(() => {
    dbg.unwatch(exprWatch);
    console.log("Expression watch cancelled");
  }, 30000);

  // 4. Continue execution
  await dbg.continue();

  // Cleanup on exit
  setTimeout(async () => {
    dbg.unwatch(varWatch);
    await dbg.disconnect();
    console.log("Done.");
    process.exit(0);
  }, 60000);
}

main().catch(console.error);