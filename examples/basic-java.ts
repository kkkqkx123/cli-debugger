/**
 * Basic Java Debugging Example
 *
 * Demonstrates connecting to a JDWP target, setting breakpoints,
 * stepping through code, and inspecting variables.
 *
 * Usage:
 *   npx tsx examples/basic-java.ts
 *
 * Prerequisites:
 *   Java application running with JDWP agent:
 *     java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:5005 App
 */

import { Debugger, Presets } from "../src/sdk/index.js";

async function main() {
  // 1. Create a Debugger instance with JDWP preset
  const dbg = new Debugger(Presets.jdwp(5005, "127.0.0.1"));

  // 2. Connect to the Java process
  console.log("Connecting to Java process...");
  await dbg.connect();
  console.log("Connected!", dbg.info);

  // 3. Set breakpoints
  const bp1 = await dbg.breakpoint("App.java:42");
  console.log(`Breakpoint set: ${bp1}`);

  // 4. Resume execution and wait for breakpoint
  await dbg.continue();

  // 5. When breakpoint is hit, inspect state
  dbg.on("breakpoint", async (event) => {
    console.log("Breakpoint hit:", event.location);

    // Get local variables
    const locals = await dbg.locals();
    console.log("Locals:", locals);

    // Get stack trace
    const stack = await dbg.stack();
    console.log("Stack:", stack);

    // Evaluate expression
    const result = await dbg.evaluate("someVariable");
    console.log("Expression:", result);

    // Continue execution
    await dbg.continue();
  });

  // 6. Disconnect after some time
  setTimeout(async () => {
    await dbg.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  }, 30000);
}

main().catch(console.error);