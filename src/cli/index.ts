#!/usr/bin/env node

/**
 * CLI-Debugger - Main CLI entry point
 *
 * Commander-based CLI for multi-language debugging.
 * Supports auto-context mode (every command returns full context).
 */

import process from "node:process";
import { Command } from "commander";
import { SessionManager } from "../session/manager.js";
import type { OutputMode } from "../session/manager.js";
import type { AutoContext } from "../session/manager.js";
import type { DebugConfig } from "../types/config.js";
import type { BreakpointInfo } from "../types/debug.js";
import { detectProtocol } from "../sdk/config/index.js";
import { readSourceContext } from "../sdk/query/index.js";
import {
  writeContext,
  writeMessage,
  writeError,
  writeSuccess,
  writeResult,
  writeTable,
} from "./formatter.js";

// ─── Global State ────────────────────────────────────────────────────────────

const sessionManager = new SessionManager();
let outputMode: OutputMode = "text";
let contextLines = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the current client or exit with error
 */
function requireClient(): NonNullable<ReturnType<typeof sessionManager.getCurrentClient>> {
  const client = sessionManager.getCurrentClient();
  if (!client) {
    writeError("No active debug session. Use `dap debug <protocol>` first.", outputMode);
    process.exit(1);
  }
  return client;
}

/**
 * Get the active thread ID or the first available one
 */
async function resolveThreadId(threadId?: string): Promise<string> {
  if (threadId) {
    sessionManager.setActiveThread(threadId);
    return threadId;
  }

  const existing = sessionManager.getActiveThread();
  if (existing) return existing;

  const client = requireClient();
  const threads = await client.threads();
  if (threads.length === 0) {
    writeError("No threads available", outputMode);
    process.exit(1);
  }

  const first = threads[0];
  if (first) {
    sessionManager.setActiveThread(first.id);
    return first.id;
  }

  writeError("No threads available", outputMode);
  process.exit(1);
}

async function buildAutoContext(
  threadId?: string,
  options?: { includeSource?: boolean; includeLocals?: boolean; includeStack?: boolean },
): Promise<AutoContext> {
  const client = requireClient();
  const ctx: AutoContext = {};

  const tid = threadId ?? sessionManager.getActiveThread();
  const opts = {
    includeSource: true,
    includeLocals: true,
    includeStack: true,
    ...options,
  };

  try {
    // Threads list
    const threads = await client.threads();
    ctx.threads = threads;

    // Current thread info
    if (tid) {
      const currentThread = threads.find((t) => t.id === tid);
      if (currentThread) {
        ctx.thread = currentThread;
      }

      // Stack frames
      if (opts.includeStack) {
        const frames = await client.stack(tid);
        ctx.stack = frames;

        // Location from top frame
        const topFrame = frames[0];
        if (topFrame) {
          ctx.location = {
            file: topFrame.location,
            line: topFrame.line,
            method: topFrame.method,
          };

          // Source context (uses shared SDK utility)
          if (opts.includeSource && topFrame.location !== "<unknown>") {
            ctx.sourceContext = readSourceContext(
              topFrame.location,
              topFrame.line,
              contextLines,
            );
          }

          // Locals
          if (opts.includeLocals) {
            const frameIndex = sessionManager.getActiveFrameIndex();
            ctx.locals = await client.locals(tid, frameIndex);
          }
        }
      }
    }
  } catch {
    // Partial context is fine
  }

  return ctx;
}

/**
 * After a mutation command, output auto-context
 */
async function emitAutoContext(threadId?: string): Promise<void> {
  const ctx = await buildAutoContext(threadId);
  writeContext(ctx, outputMode);
}

// ─── Program Setup ───────────────────────────────────────────────────────────

const program = new Command();

program
  .name("dap")
  .description("Multi-language debugging CLI")
  .version("0.1.0")
  .option("--json", "Output in JSON format")
  .option("--context-lines <number>", "Number of source context lines", "5")
  .option("--session <id>", "Session ID to use")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals() as Record<string, unknown>;
    outputMode = opts["json"] ? "json" : "text";
    contextLines = parseInt((opts["contextLines"] as string) ?? "5", 10) || 5;
    const sessionId = opts["session"] as string | undefined;
    if (sessionId) {
      sessionManager.setCurrentSession(sessionId);
    }
  });

// ─── debug - Start a debug session ──────────────────────────────────────────

program
  .command("debug")
  .description("Start a new debug session")
  .argument("[protocol]", "Debug protocol (dlv, jdwp, lldb, py-debug, js-debug) - auto-detected if not specified based on program extension")
  .option("-H, --host <host>", "Debug adapter host", "127.0.0.1")
  .option("-p, --port <port>", "Debug adapter port", "5005")
  .option("-t, --timeout <ms>", "Connection timeout", "30000")
  .option("-e, --break-on-exception", "Set breakpoint on exception")
  .option("--program <path>", "Program/binary path to debug")
  .option("--attach <host:port>", "Remote attach to existing debug adapter")
  .option("--pid <pid>", "Attach to running process by PID (requires lldb/dlv)")
  .argument("[args...]", "Program arguments (passed after --)")
  .action(async (protocol: string | undefined, args: string[], options: { host: string; port: string; timeout: string; breakOnException?: boolean; program?: string; attach?: string; pid?: string }) => {
    try {
      const programArgs = args ?? [];

      // Detect protocol from program path if not specified
      let resolvedProtocol = protocol;
      if (!resolvedProtocol && options.program) {
        resolvedProtocol = detectProtocol(options.program);
        writeMessage(`Auto-detected protocol: ${resolvedProtocol}`, outputMode);
      }
      if (!resolvedProtocol) {
        writeError("Protocol is required. Specify it or use --program for auto-detection.", outputMode);
        process.exit(1);
      }

      // Handle --attach option (format: host:port)
      if (options.attach) {
        const match = options.attach.match(/^(.+):(\d+)$/);
        if (match) {
          options.host = match[1]!;
          options.port = match[2]!;
          writeMessage(`Remote attach mode: connecting to ${options.attach}`, outputMode);
        } else {
          writeError("Invalid --attach format. Use host:port (e.g., 192.168.1.100:5005)", outputMode);
          process.exit(1);
        }
      }

      const config: Record<string, unknown> = {
        protocol: resolvedProtocol,
        host: options.host,
        port: parseInt(options.port, 10) || 5005,
        timeout: parseInt(options.timeout, 10) || 30000,
      };

      // Handle --pid option
      if (options.pid) {
        const pid = parseInt(options.pid, 10);
        if (isNaN(pid) || pid <= 0) {
          writeError("Invalid PID value", outputMode);
          process.exit(1);
        }
        config["attachPid"] = pid;
        if (resolvedProtocol === "lldb") {
          config["target"] = options.program ?? "";
        }
        writeMessage(`Attach to PID mode: ${pid}`, outputMode);
      }

      // For LLDB, pass program as target
      if (resolvedProtocol === "lldb" && options.program && !options.pid) {
        config["target"] = options.program;
      }

      const sessionId = await sessionManager.createSession(config as DebugConfig);
      const targetInfo = options.program ?? `${config["host"]}:${config["port"]}`;
      writeSuccess(`Debug session started: ${sessionId} (${resolvedProtocol}://${targetInfo})`, outputMode);

      if (programArgs.length > 0) {
        writeResult("Program Args", programArgs.join(" "), outputMode);
      }

      const client = sessionManager.getCurrentClient();
      if (client) {
        // Show version info
        try {
          const ver = await client.version();
          writeResult("Protocol Version", ver.protocolVersion, outputMode);
          writeResult("Runtime", `${ver.runtimeName} ${ver.runtimeVersion}`, outputMode);
        } catch {
          // Version info is optional
        }

        // Set exception breakpoint if requested
        if (options.breakOnException) {
          try {
            const bpId = await client.setBreakpoint("exception", undefined, "exception");
            writeSuccess(`Exception breakpoint set (${bpId})`, outputMode);
          } catch {
            writeMessage("Exception breakpoints not supported by this protocol", outputMode);
          }
        }
      }

      await emitAutoContext();
    } catch (err) {
      writeError(`Failed to start debug session: ${err instanceof Error ? err.message : String(err)}`, outputMode);
      process.exit(1);
    }
  });

// ─── stop - Stop a debug session ────────────────────────────────────────────

program
  .command("stop")
  .description("Stop the current debug session")
  .argument("[session-id]", "Session ID to stop (defaults to current)")
  .action(async (sessionId?: string) => {
    try {
      const sid = sessionId ?? sessionManager.getCurrentSessionId();
      if (!sid) {
        writeError("No active session to stop", outputMode);
        return;
      }
      await sessionManager.closeSession(sid);
      writeSuccess(`Session ${sid} stopped`, outputMode);
    } catch (err) {
      writeError(`Failed to stop session: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── restart - Restart a debug session ──────────────────────────────────────

program
  .command("restart")
  .description("Restart the current debug session (preserves breakpoints)")
  .argument("[session-id]", "Session ID to restart (defaults to current)")
  .action(async (sessionId?: string) => {
    try {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        writeError("No active session to restart", outputMode);
        return;
      }

      const sid = sessionId ?? sessionManager.getCurrentSessionId() ?? "";
      const client = session.client;

      // Save breakpoints before restart
      let savedBreakpoints: BreakpointInfo[] = [];
      try {
        savedBreakpoints = await client.breakpoints();
      } catch {
        // Ignore
      }

      // Close old session
      await sessionManager.closeSession(sid);

      // Create new session with same config
      const newSessionId = await sessionManager.createSession(session.config);
      const newClient = sessionManager.getCurrentClient();

      // Restore breakpoints
      if (newClient && savedBreakpoints.length > 0) {
        for (const bp of savedBreakpoints) {
          try {
            await newClient.setBreakpoint(bp.location, bp.condition);
          } catch {
            // Ignore individual breakpoint restore failures
          }
        }
        writeMessage(`Restored ${savedBreakpoints.length} breakpoints`, outputMode);
      }

      writeSuccess(`Session restarted: ${sid} -> ${newSessionId}`, outputMode);
      await emitAutoContext();
    } catch (err) {
      writeError(`Failed to restart session: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── sessions - List sessions ───────────────────────────────────────────────

program
  .command("sessions")
  .description("List all active debug sessions")
  .action(async () => {
    try {
      const sessions = sessionManager.listSessions();
      if (sessions.length === 0) {
        writeMessage("No active sessions", outputMode);
        return;
      }

      const currentId = sessionManager.getCurrentSessionId();
      writeTable(
        ["ID", "Protocol", "Target", "Status", "Thread"],
        sessions.map((s) => [
          s.id === currentId ? `${s.id} *` : s.id,
          s.protocol,
          s.target,
          s.status,
          s.activeThreadId ?? "-",
        ]),
        outputMode,
      );
    } catch (err) {
      writeError(`List sessions failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── step - Step execution ──────────────────────────────────────────────────

program
  .command("step")
  .description("Step through code execution")
  .argument("[direction]", "Step direction: in, out, over (default: over)", "over")
  .argument("[thread-id]", "Thread ID (defaults to active thread)")
  .action(async (direction: string, threadId?: string) => {
    try {
      const client = requireClient();
      const tid = await resolveThreadId(threadId);

      switch (direction) {
        case "in":
          await client.stepInto(tid);
          break;
        case "out":
          await client.stepOut(tid);
          break;
        case "over":
        default:
          await client.stepOver(tid);
          break;
      }

      await emitAutoContext(tid);
    } catch (err) {
      writeError(`Step failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── continue - Continue execution ──────────────────────────────────────────

program
  .command("continue")
  .description("Continue execution")
  .argument("[thread-id]", "Thread ID (defaults to active thread)")
  .option("--to <location>", "Run to specified location (file:line)")
  .action(async (threadId: string | undefined, options: { to?: string }) => {
    try {
      const client = requireClient();
      const tid = await resolveThreadId(threadId);

      if (options.to) {
        // Set temporary breakpoint and continue
        const match = options.to.match(/^(.+):(\d+)$/);
        if (match) {
          const [, file, lineStr] = match;
          const bpId = await client.setBreakpoint(`${file}:${lineStr}`);
          await client.resume(tid);
          // The temp breakpoint will be hit naturally; auto-context will show it
          writeMessage(`Running to ${options.to}...`, outputMode);
          await emitAutoContext(tid);
          // Clean up temp breakpoint
          try {
            await client.removeBreakpoint(bpId);
          } catch {
            // Ignore
          }
        } else {
          writeError("Invalid --to format. Use file:line (e.g., src/main.ts:42)", outputMode);
          return;
        }
      } else {
        await client.resume(tid);
        await emitAutoContext(tid);
      }
    } catch (err) {
      writeError(`Continue failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── pause - Pause execution ────────────────────────────────────────────────

program
  .command("pause")
  .description("Pause a running program")
  .argument("[thread-id]", "Thread ID (defaults to active thread)")
  .action(async (threadId?: string) => {
    try {
      const client = requireClient();
      const tid = await resolveThreadId(threadId);
      await client.suspend(tid);
      writeSuccess("Program paused", outputMode);
      await emitAutoContext(tid);
    } catch (err) {
      writeError(`Pause failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── break - Breakpoint management ─────────────────────────────────────────

const breakCmd = program
  .command("break")
  .alias("b")
  .description("Manage breakpoints");

breakCmd
  .command("list")
  .alias("ls")
  .description("List all breakpoints")
  .action(async () => {
    try {
      const client = requireClient();
      const bps = await client.breakpoints();
      if (bps.length === 0) {
        writeMessage("No breakpoints set", outputMode);
        return;
      }
      writeTable(
        ["ID", "Location", "Enabled", "Hits", "Condition"],
        bps.map((bp) => [
          bp.id,
          bp.location,
          bp.enabled ? "Yes" : "No",
          String(bp.hitCount),
          bp.condition ?? "-",
        ]),
        outputMode,
      );
    } catch (err) {
      writeError(`List breakpoints failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

breakCmd
  .command("add")
  .description("Add a breakpoint")
  .argument("<location>", "Breakpoint location (file:line or file:line:condition; use 'exception' for exception breakpoints)")
  .option("--type <type>", "Breakpoint type: line, exception, method-entry, method-exit (default: line)", "line")
  .action(async (location: string, options: { type?: string }) => {
    try {
      const client = requireClient();
      const bpType = (options.type ?? "line") as "line" | "exception" | "method-entry" | "method-exit";

      // Parse optional condition from location (file:line:condition)
      const parts = location.split(":");
      let fileLine: string;
      let condition: string | undefined;

      if (parts.length >= 3) {
        // file:line:condition
        fileLine = `${parts[0]}:${parts[1]}`;
        condition = parts.slice(2).join(":");
      } else {
        fileLine = location;
      }

      const bpId = await client.setBreakpoint(fileLine, condition, bpType);
      writeSuccess(`Breakpoint ${bpId} set at ${location} (type: ${bpType})`, outputMode);
      await emitAutoContext();
    } catch (err) {
      writeError(`Add breakpoint failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

breakCmd
  .command("remove")
  .alias("rm")
  .description("Remove a breakpoint")
  .argument("<id>", "Breakpoint ID to remove")
  .action(async (id: string) => {
    try {
      const client = requireClient();
      await client.removeBreakpoint(id);
      writeSuccess(`Breakpoint ${id} removed`, outputMode);
      await emitAutoContext();
    } catch (err) {
      writeError(`Remove breakpoint failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

breakCmd
  .command("clear")
  .description("Clear all breakpoints")
  .action(async () => {
    try {
      const client = requireClient();
      await client.clearBreakpoints();
      writeSuccess("All breakpoints cleared", outputMode);
      await emitAutoContext();
    } catch (err) {
      writeError(`Clear breakpoints failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── context - Show context ─────────────────────────────────────────────────

program
  .command("context")
  .alias("c")
  .description("Show current debug context")
  .argument("[thread-id]", "Thread ID (defaults to active thread)")
  .option("-l, --lines <number>", "Number of source context lines")
  .action(async (threadId?: string, options?: { lines?: string }) => {
    try {
      const client = requireClient();
      const tid = threadId ?? sessionManager.getActiveThread();

      if (!tid) {
        writeError("No thread available. Start a debug session first.", outputMode);
        return;
      }

      const opts = { ...options };
      if (opts.lines) {
        contextLines = parseInt(opts.lines, 10) || 5;
      }

      const ctx = await buildAutoContext(tid, {
        includeSource: true,
        includeLocals: true,
        includeStack: true,
      });

      // Add breakpoints
      try {
        ctx.breakpoints = await client.breakpoints();
      } catch {
        // Ignore
      }

      writeContext(ctx, outputMode);
    } catch (err) {
      writeError(`Context failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── eval - Evaluate expression ─────────────────────────────────────────────

program
  .command("eval")
  .description("Evaluate an expression in the current context")
  .argument("<expression>", "Expression to evaluate")
  .argument("[thread-id]", "Thread ID (defaults to active thread)")
  .option("--frame <index>", "Stack frame index", "0")
  .action(async (expression: string, threadId?: string, options?: { frame?: string }) => {
    try {
      const client = requireClient();
      const tid = await resolveThreadId(threadId);
      const frameIndex = parseInt(options?.frame ?? "0", 10) || 0;

      // Try extended eval first
      const extClient = sessionManager.getExtendedClient();
      if (extClient && typeof extClient.eval === "function") {
        const result = await extClient.eval(expression, tid, frameIndex);
        if (result.error) {
          writeError(`Eval error: ${result.error}`, outputMode);
        } else {
          writeResult("Result", result.value, outputMode);
          if (result.type) {
            writeResult("Type", result.type, outputMode);
          }
        }
      } else {
        // Fallback: show locals
        writeMessage(`Expression evaluation not supported by this protocol. Showing locals:`, outputMode);
        try {
          const locals = await client.locals(tid, frameIndex);
          writeTable(
            ["Name", "Type", "Value"],
            locals.map((v) => [
              v.name,
              v.type,
              v.isNull ? "null" : String(v.value),
            ]),
            outputMode,
          );
        } catch {
          writeError("Cannot evaluate expression or read locals", outputMode);
        }
      }
    } catch (err) {
      writeError(`Eval failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── inspect - Inspect variable ─────────────────────────────────────────────

program
  .command("inspect")
  .description("Inspect a variable or object")
  .argument("<variable>", "Variable name to inspect")
  .argument("[thread-id]", "Thread ID (defaults to active thread)")
  .option("--depth <number>", "Inspection depth", "1")
  .option("--frame <index>", "Stack frame index", "0")
  .action(async (variable: string, threadId?: string, options?: { depth?: string; frame?: string }) => {
    try {
      const client = requireClient();
      const tid = await resolveThreadId(threadId);
      const frameIndex = parseInt(options?.frame ?? "0", 10) || 0;

      // Show locals and find the requested variable
      const locals = await client.locals(tid, frameIndex);
      const varInfo = locals.find((v) => v.name === variable);

      if (varInfo) {
        writeTable(
          ["Property", "Value"],
          [
            ["Name", varInfo.name],
            ["Type", varInfo.type],
            ["Value", varInfo.isNull ? "null" : String(varInfo.value)],
            ["Primitive", varInfo.isPrimitive ? "Yes" : "No"],
            ["Null", varInfo.isNull ? "Yes" : "No"],
          ],
          outputMode,
        );
      } else {
        writeError(`Variable '${variable}' not found in current scope`, outputMode);
        writeMessage("Available variables:", outputMode);
        writeTable(
          ["Name", "Type", "Value"],
          locals.map((v) => [v.name, v.type, v.isNull ? "null" : String(v.value)]),
          outputMode,
        );
      }
    } catch (err) {
      writeError(`Inspect failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── threads - List threads ─────────────────────────────────────────────────

program
  .command("threads")
  .description("List all threads")
  .action(async () => {
    try {
      const client = requireClient();
      const threads = await client.threads();
      if (threads.length === 0) {
        writeMessage("No threads", outputMode);
        return;
      }
      writeTable(
        ["ID", "Name", "State", "Suspended", "Priority", "Daemon"],
        threads.map((t) => [
          t.id,
          t.name,
          t.state,
          t.isSuspended ? "Yes" : "No",
          String(t.priority),
          t.isDaemon ? "Yes" : "No",
        ]),
        outputMode,
      );
    } catch (err) {
      writeError(`List threads failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── thread - Switch active thread ──────────────────────────────────────────

program
  .command("thread")
  .description("Switch to a specific thread")
  .argument("<id>", "Thread ID")
  .action(async (id: string) => {
    try {
      const client = requireClient();
      const threads = await client.threads();
      const thread = threads.find((t) => t.id === id);
      if (!thread) {
        writeError(`Thread ${id} not found`, outputMode);
        return;
      }
      sessionManager.setActiveThread(id);
      writeSuccess(`Switched to thread ${id}: ${thread.name}`, outputMode);
      await emitAutoContext(id);
    } catch (err) {
      writeError(`Switch thread failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── output - Flush buffered output ─────────────────────────────────────────

program
  .command("output")
  .alias("out")
  .description("Flush and show buffered program output")
  .option("-t, --timeout <ms>", "Wait timeout in milliseconds", "500")
  .option("-f, --follow", "Continuously follow output (Ctrl+C to stop)")
  .action(async (options: { timeout?: string; follow?: boolean }) => {
    try {
      const client = requireClient();
      const timeoutMs = parseInt(options?.timeout ?? "500", 10) || 500;

      // Drain buffered output events
      const events: string[] = [];
      const MAX_DRAIN = 20;

      for (let i = 0; i < MAX_DRAIN; i++) {
        try {
          const event = await client.waitForEvent(timeoutMs);
          if (event && event.data) {
            if (Array.isArray(event.data)) {
              for (const d of event.data) {
                events.push(String(d));
              }
            } else {
              events.push(String(event.data));
            }
          } else {
            break; // No more events
          }
        } catch {
          break; // Timeout or no more events
        }
      }

      if (events.length > 0) {
        writeResult("Output", `${events.length} line(s)`, outputMode);
        for (const line of events) {
          writeMessage(`  ${line}`, outputMode);
        }
      } else {
        writeMessage("No buffered output", outputMode);
      }

      if (options?.follow) {
        writeMessage("Following output... (Ctrl+C to stop)", outputMode);
        // Continuous poll for output (simplified follow mode)
        for (let i = 0; i < 60; i++) {
          try {
            const ev = await client.waitForEvent(1000);
            if (ev && ev.data) {
              const line = Array.isArray(ev.data) ? ev.data.map(String).join(" ") : String(ev.data);
              writeMessage(`  ${line}`, outputMode);
            }
          } catch {
            break;
          }
        }
      }
    } catch (err) {
      writeError(`Output flush failed: ${err instanceof Error ? err.message : String(err)}`, outputMode);
    }
  });

// ─── Parse ──────────────────────────────────────────────────────────────────

/**
 * Run the CLI with the given arguments
 * @param argv - Command-line arguments (defaults to process.argv)
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  try {
    await program.parseAsync(argv);
  } catch (err) {
    writeError(
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      "text",
    );
    process.exit(1);
  } finally {
    await sessionManager.closeAllSessions();
  }
}

// Allow direct execution (shebang)
const isDirectRun = process.argv[1]?.endsWith("cli/index.ts") ||
  process.argv[1]?.endsWith("cli/index.js") ||
  process.argv[1]?.endsWith("dap");
if (isDirectRun) {
  runCli();
}