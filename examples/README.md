# CLI Debugger SDK Examples

This directory contains example scripts demonstrating how to use the CLI Debugger SDK.

## Prerequisites

- Node.js 18+
- A running debug target (JDWP, DebugPy, Delve, LLDB, or js-debug)

## Running Examples

```bash
# Install dependencies first
npm install

# Run a TypeScript example
npx tsx examples/basic-java.ts
```

## Examples Overview

### Basic Usage

| Example | Description | Protocol |
|---|---|---|
| [basic-java.ts](./basic-java.ts) | Connect to a Java JDWP target, set breakpoints, step through code | JDWP |
| [basic-python.ts](./basic-python.ts) | Connect to a Python debugpy target, use assertions | DebugPy |

### Advanced Features

| Example | Description | Features |
|---|---|---|
| [advanced-watch.ts](./advanced-watch.ts) | Variable watching and expression monitoring with change detection | Watch, Monitoring |
| [advanced-assert.ts](./advanced-assert.ts) | Using all assertion types for automated verification | Assertions |
| [headless-automation.ts](./headless-automation.ts) | Programmatic debugging without CLI, using query/format modules | Query, Format, Automation |

## SDK API Quick Reference

```typescript
import { Debugger, Presets, ConfigBuilder, detectProtocol } from "./src/sdk/index.js";

// Create and connect
const dbg = new Debugger(Presets.jdwp(5005));
await dbg.connect();

// Execution control
await dbg.continue();
await dbg.pause();
await dbg.stepInto();
await dbg.stepOver();
await dbg.stepOut();

// Breakpoints
const bp = await dbg.breakpoint("App.java:42");
await dbg.removeBreakpoint(bp);
const allBps = await dbg.breakpoints();

// Data inspection
const locals = await dbg.locals();
const stack = await dbg.stack();
const threads = await dbg.threads();
const result = await dbg.evaluate("someExpression");

// Events
dbg.on("breakpoint", (event) => console.log(event));
dbg.on("output", (event) => console.log(event));
dbg.on("error", (event) => console.error(event));

// Watch (Phase 4 features)
const watch = await dbg.watchVariable("count", (oldVal, newVal) => {
  console.log(`count: ${oldVal} → ${newVal}`);
});
dbg.unwatch(watch);

// Assertions (Phase 4 features)
await dbg.assert.variable("count", 5);
await dbg.assert.expression("count + 1", 6);
await dbg.assert.paused();
await dbg.assert.topFrame("App.main");

// Formatting
console.log(dbg.format.variable({ name: "x", type: "int", value: 42 }));
console.log(dbg.format.stack(await dbg.stack()));

// Configuration
const config = new ConfigBuilder()
  .protocol("jdwp")
  .host("10.0.0.1")
  .port(5005)
  .timeout(60000)
  .build();

// Protocol auto-detection
const protocol = detectProtocol("main.go"); // "dlv"

// Disconnect
await dbg.disconnect();
```

## CI/CD Integration

These examples can be used in CI/CD pipelines for automated debugging:

```bash
# Start target with debugger, run tests, collect results
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:5005 App &
npx tsx examples/headless-automation.ts
```