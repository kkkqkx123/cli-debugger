# CLI Debugger - Project Context Documentation

## Language

Always use English in code, comments, logging, error info or other string literal. Use Chinese in docs (except code block)
**Never use any Chinese in any code files.**

## Project Overview

`cli-debugger` is a **multi-language debugging CLI client with DSL support** built with TypeScript. The core objective of this project is to provide a lightweight, programmable debugging tool that supports various debugging protocols (such as JDWP, DAP, etc.) and offers both command-line interface and programmatic API for debugging scenarios across different programming languages.

### Key Features

- **Programmable API**: Provides TypeScript/JavaScript API for scripting debug workflows
- **DSL Support**: Chainable API builder for fluent debug operation sequences
- **Multi-Protocol Support**: Unified `DebugProtocol` interface with protocol-specific implementations (JDWP, DAP, etc.)
- **Stateless Execution**: Each command establishes an independent connection, ideal for scripting and automation
- **Optional Watch Mode**: Supports real-time observation of debugging state changes
- **Flexible Output Formats**: Offers text, JSON, and table output formats
- **Configuration Management**: Supports config files and environment variables
- **Cross-Platform Compatibility**: Compatible with Windows, macOS, and Linux (Node.js 22+)

---

## Technology Stack

### Programming Language

**TypeScript 5.9+** (ESM)

### Core Dependencies

- **zod v4.3.6**: Runtime validation for configuration and inputs
- **commander v12.0.0**: CLI framework for building the command structure
- **chalk v5.3.0**: Colored terminal output
- **ws v8.16.0**: WebSocket support for streaming mode

### Dev Dependencies

- **typescript v5.9.3**: TypeScript compiler
- **vitest v4.0.18**: Unit testing framework
- **@vitest/coverage-v8 v4.0.18**: Code coverage
- **eslint v10.0.0**: Code linting
- **prettier v3.8.1**: Code formatting
- **rimraf v6.1.2**: Directory cleanup

### Project Architecture

- Single package structure with organized directory hierarchy
- Layered design: `protocol/` (Interface Layer) → `jdwp/` (Implementation Layer) → `dsl/` (DSL Layer) → `cli/` (Command Layer)
- ESM module system with NodeNext resolution

## Project Structure

```
cli-debugger/
├── src/                           # Source code root
│   ├── index.ts                   # Public API exports
│   ├── protocol/                  # Protocol layer
│   │   ├── index.ts               # Protocol module exports
│   │   ├── base.ts                # DebugProtocol interface definition
│   │   ├── types.ts               # Type definitions (ThreadInfo, StackFrame, etc.)
│   │   ├── client.ts              # Client factory function + protocol registry
│   │   ├── errors.ts              # Error types (APIError, ErrorType, ErrorCodes)
│   │   └── jdwp/                  # JDWP protocol implementation
│   │       ├── index.ts           # JDWP module exports
│   │       ├── client.ts          # JDWP client (implements DebugProtocol)
│   │       ├── codec.ts           # JDWP packet encode/decode
│   │       ├── handshake.ts       # JDWP handshake protocol
│   │       ├── vm.ts              # VirtualMachine command set
│   │       ├── thread.ts          # ThreadReference command set
│   │       ├── breakpoint.ts      # EventRequest command set
│   │       ├── stack.ts           # StackFrame queries
│   │       ├── variable.ts        # Variable inspection
│   │       └── event.ts           # Event handling
│   ├── dsl/                       # DSL layer
│   │   ├── index.ts               # DSL module exports
│   │   ├── builder.ts             # Chainable API builder
│   │   └── interpreter.ts         # Script interpreter
│   ├── cli/                       # CLI implementation
│   │   ├── index.ts               # CLI entry point
│   │   ├── commands/              # Command implementations
│   │   │   ├── threads.ts         # Thread listing command
│   │   │   ├── stack.ts           # Stack trace command
│   │   │   ├── breakpoints.ts     # Breakpoint management
│   │   │   ├── variables.ts       # Variable inspection
│   │   │   ├── control.ts         # Suspend/Resume commands
│   │   │   └── step.ts            # Step Into/Over/Out commands
│   │   └── utils/
│   │       ├── formatter.ts       # Output formatting (text/json/table)
│   │       └── config.ts          # Configuration loading
│   └── monitor/                   # Watch mode
│       ├── index.ts
│       ├── poller.ts              # HTTP polling monitor
│       └── stream.ts              # WebSocket streaming
│
├── ref/                           # Reference implementation (Go version)
│   └── ...
│
├── package.json                   # Project configuration
├── tsconfig.json                  # TypeScript configuration
└── vitest.config.ts               # Vitest configuration
```

---

## Core Architecture

### 1. Protocol System (`src/protocol/`)

The **`DebugProtocol` interface** is the core interface that all protocol implementations must follow, defining complete debugging operations:

| Category              | Methods                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| Lifecycle             | `connect()`, `close()`, `isConnected()`                                        |
| Metadata              | `version()`, `capabilities()`, `protocolName()`, `supportedLanguages()`        |
| Thread Management     | `threads()`, `stack()`, `threadState()`                                        |
| Execution Control     | `suspend()`, `resume()`, `stepInto()`, `stepOver()`, `stepOut()`               |
| Breakpoint Management | `setBreakpoint()`, `removeBreakpoint()`, `clearBreakpoints()`, `breakpoints()` |
| Variable Inspection   | `locals()`, `fields()`                                                         |
| Event Handling        | `waitForEvent()`                                                               |

**Protocol Registration and Creation Flow**:

```typescript
// Register protocol (typically in module initialization)
registerProtocol("jdwp", (config) => new JDWPClient(config));

// Create client
const client = await createClient({
  protocol: "jdwp",
  host: "127.0.0.1",
  port: 5005,
});
```

**Configuration Validation**: Uses Zod schema for runtime validation with automatic type inference.

### 2. DSL System (`src/dsl/`)

The DSL provides a **chainable API builder** for fluent debug operation sequences:

```typescript
const dsl = new DebugDSL({ protocol: "jdwp", port: 5005 });

await dsl.run(async (debug) => {
  await debug
    .thread("main")
    .suspend()
    .breakpointAt("com.example.Main", 42)
    .inspectVariables()
    .resume();
});
```

**Key Features**:

- Thread selection and management
- Chainable operation sequences
- Access to underlying `DebugProtocol` client for advanced operations
- Automatic resource cleanup (connection close on completion)

### 3. Configuration System

**Configuration loading** supports multiple sources with priority:

1. Default values (defined in Zod schema)
2. Configuration files (YAML/TOML)
3. Environment variables (`DEBUGGER_PROTOCOL`, `DEBUGGER_HOST`, etc.)
4. Command-line flags

Configuration validation is enforced at runtime using Zod schemas.

### 4. Output Formatting (`src/cli/utils/formatter.ts`)

The formatter supports unified output methods:

- `formatVersion()`, `formatThreads()`, `formatStack()`, `formatVariables()`, `formatBreakpoints()`, `formatEvent()`, `formatError()`

Formatters are created through factory functions and support text, JSON, and table formats.

## Key Commands and Usage

### check

```powershell
npm run typecheck
```

### Lint & Test

```powershell
npm run lint
npm test
npm test -- <path>
```

### Basic Usage

```powershell
# CLI usage (after build)
debugger --help
debugger version
debugger --host 192.168.1.100 --port 5005 threads
debugger --json stack --thread-id 1
debugger --watch --interval 2 threads

# Programmatic API usage
import { createClient, DebugDSL } from 'cli-debugger';

// Direct API
const client = await createClient({ protocol: 'jdwp', port: 5005 });
const threads = await client.threads();
await client.suspend(threads[0].id);

// DSL
const dsl = new DebugDSL({ protocol: 'jdwp', port: 5005 });
await dsl.run(async (debug) => {
  await debug.thread('main').suspend().inspectVariables().resume();
});
```

---

## Development Conventions

### Code Style

- Follow TypeScript standard formatting (Prettier)
- Interface names should use `-er` or `-able` suffix (e.g., `DebugProtocol`, `Formatter`)
- Factory functions should use `create` or `new` prefix (e.g., `createClient`, `new DebugDSL`)
- Use custom error types for error handling (`APIError` with typed error codes)
- All async functions should use `async/await` pattern (no raw Promises or callbacks)

### Configuration Standards

- All configuration schemas must be defined with Zod for runtime validation
- Environment variables must use the `DEBUGGER_` prefix uniformly
- Configuration validation errors should throw `APIError` with `InputError` type

### Type Safety

- Use strict TypeScript compiler options
- Avoid `any` type; use `unknown` when type is truly dynamic
- Export interfaces and types from `protocol/types.ts`
- Use Zod schema inference for configuration types (`z.infer<typeof Schema>`)

### Testing

- Write unit tests for protocol implementations (mock network operations). Place in `__tests__` in the same path.
- Write e2e tests for CLI commands. Place in `tests` folder.
- Use Vitest's `describe`, `it`, `expect` pattern
- Test coverage should target protocol layer and DSL builder
