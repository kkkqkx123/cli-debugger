/**
 * Headless Debug Automation Example
 *
 * Demonstrates programmatic debugging without a CLI,
 * using the SDK's query and format modules to
 * extract structured debug information.
 *
 * Usage:
 *   npx tsx examples/headless-automation.ts
 */

import {
  Debugger,
  detectProtocol,
  ConfigBuilder,
} from "../src/sdk/index.js";

async function main() {
  // 1. Auto-detect protocol from program path
  const program = "/path/to/myapp.jar";
  const detectedProtocol = detectProtocol(program);
  console.log(`Detected protocol for ${program}: ${detectedProtocol}`);

  // 2. Build configuration programmatically
  const config = new ConfigBuilder()
    .protocol(detectedProtocol ?? "jdwp")
    .host("remote-server.example.com")
    .port(5005)
    .timeout(60000)
    .build();

  console.log("Config:", config);

  // 3. Create and connect
  const dbg = await Debugger.connect(config);
  console.log("Connected to:", dbg.info);

  // 4. Set breakpoints from a list
  const breakpoints = ["App.java:10", "App.java:42", "App.java:100"];
  for (const loc of breakpoints) {
    const bp = await dbg.breakpoint(loc);
    console.log(`Set: ${bp} @ ${loc}`);
  }

  // 5. Listen for events and collect data
  const events: any[] = [];
  dbg.on("breakpoint", async (event) => {
    events.push(event);

    const ctx = {
      location: event.location,
      locals: await dbg.locals(),
      stack: await dbg.stack(),
      threads: await dbg.threads(),
    };
    console.log("Context:", ctx);
  });

  // 6. Resume and let automation run
  await dbg.continue();

  // 7. After timeout, generate report
  setTimeout(async () => {
    console.log("\n=== Automation Report ===");
    console.log("Events captured:", events.length);

    const bps = await dbg.breakpoints();
    console.log("Breakpoint hits:", bps.map((b) => `${b.location} → ${b.hitCount} hits`));

    const threads = await dbg.threads();
    console.log("Threads:", threads.length);

    await dbg.disconnect();
    console.log("Automation complete.");
    process.exit(0);
  }, 60000);
}

main().catch(console.error);