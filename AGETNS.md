# Mihomo CLI - Project Context Documentation

## Language

Always use English in code, comments, logging, error info or other string literal. Use Chinese in docs (except code block)
**Never use any Chinese in any code files.**

## Project Overview

`cli`cli-debugger` is a **multi-language debugging CLI client** built with a plugin-based architecture using the Go programming language. The core objective of this project is to provide a lightweight, unified command-line debugging tool that supports various debugging protocols (such as JDWP, DAP, etc.) for debugging scenarios across different programming languages.

### Key Features

- **Plugin-Based Architecture**: Utilizes a unified `DebugProtocol` interface, with language-specific plugins implementing this interface
- **Stateless Execution**: Each command establishes an independent connection, ideal for scripting and automation
- **Optional Watch Mode**: Supports the `--watch` flag for real-time observation of debugging state changes
- **Flexible Output Formats**: Offers three output formats: text, JSON, and table
- **Configuration Management**: Supports YAML/TOML configuration files and environment variables (with `DEBUGGER_*` prefix)
- **Cross-Platform Compatibility**: Compatible with Windows, macOS, and Linux

---

## Technology Stack

### Programming Language

**Go 1.26.1**

### Core Dependencies

- **github.com/spf13/cobra v1.10.2**: CLI framework for building the command structure.
- **github.com/spf13/viper v1.21.0**: Configuration management supporting config files and environment variables.
- **github.com/fatih/color v1.18.0**: Colored terminal output.
- **github.com/olekukonko/tablewriter v0.0.5**: Table formatting output.

### Project Architecture

- Modular design following standard Go project structures.
- Command tree architecture based on Cobra.
- Layered design: `cmd` (Command Layer) → `internal` (Business Logic Layer) → `pkg` (Common Types Layer).

## Project Structure

```
cli-debugger/
├── main.go                  # Program entry point, calls cmd.Execute()
├── cmd/                     # CLI command implementations
│   ├── root.go              # Root command and global flag definitions
│   └── version.go           # version subcommand
├── internal/                # Internal implementation (not exposed externally)
│   ├── api/                 # Protocol plugin layer
│   │   ├── base.go          # DebugProtocol interface definition + APIError error type
│   │   ├── client.go        # Plugin registry, CreateClient factory function, AutoDetect auto-detection
│   │   └── jdwp/            # JDWP plugin (to be implemented)
│   ├── config/              # Configuration management
│   │   ├── config.go        # Config, Profile, GlobalConfig struct definitions + Validate validation
│   │   ├── loader.go        # Loader configuration loader (Viper wrapper)
│   │   └── paths.go         # Cross-platform config path/cache directory/log directory resolution
│   ├── output/              # Output formatting
│   │   ├── formatter.go     # Formatter interface definition + factory function
│   │   ├── text.go          # Text formatting implementation
│   │   ├── json.go          # JSON formatting implementation
│   │   └── table.go         # Table formatting implementation
│   ├── monitor/             # Watch mode (to be implemented)
│   │   └── poller.go        # HTTP polling monitor (skeleton code)
│   └── platform/            # Platform-specific code (to be implemented)
│       └── process.go       # Process discovery interface
├── pkg/
│   └── types/               # Common type definitions
│       └── base.go          # ThreadInfo, StackFrame, BreakpointInfo, Variable, DebugEvent, etc.
└── go.mod                   # Go module definition
```

---

## Core Architecture

### 1. Plugin System (`internal/api/`)

The **`DebugProtocol` interface** is the core interface that all language plugins must implement, defining complete debugging operations:

| Category              | Methods                                                                           |
| --------------------- | --------------------------------------------------------------------------------- |
| Lifecycle             | `Connect()`, `Close()`, `IsConnected()`                                           |
| Metadata              | `Version()`, `Capabilities()`, `ProtocolName()`, `SupportedLanguages()`           |
| Thread Management     | `GetThreads()`, `GetThreadStack()`, `GetThreadState()`                            |
| Execution Control     | `Suspend()`, `Resume()`, `StepInto()`, `StepOver()`, `StepOut()`                  |
| Breakpoint Management | `SetBreakpoint()`, `RemoveBreakpoint()`, `ClearBreakpoints()`, `GetBreakpoints()` |
| Variable Inspection   | `GetLocalVariables()`, `GetFields()`                                              |
| Event Handling        | `WaitForEvent()`                                                                  |

**Plugin Registration and Creation Flow**:

```go
// Register plugin (called in plugin package's init())
api.RegisterPlugin("jdwp", func() api.DebugProtocol { return &JDWPClient{} })

// Create client
client, err := api.CreateClient("jdwp")
```

**Auto-Detection** (`AutoDetect()`): Currently only determines JDWP by port 5005 detection, with potential for more complex detection logic in the future.

### 2. Configuration System (`internal/config/`)

**Multi-layer priority merge** strategy is used for configuration loading:

1. Default values (`NewDefaultConfig()`)
2. Global config file (`~/.config/debugger/config.yaml`)
3. Project config file (`.debugger.yaml` in current directory)
4. Environment variables (`DEBUGGER_PROTOCOL`, `DEBUGGER_HOST`, etc.)
5. Command-line flags

Supports **named profiles** allowing multiple profiles to be defined in the global config file and switched between.

### 3. Output Formatting (`internal/output/`)

The `Formatter` interface defines unified output formatting methods:

- `FormatVersion()`, `FormatThreads()`, `FormatStack()`, `FormatVariables()`, `FormatBreakpoints()`, `FormatEvent()`, `FormatError()`

Corresponding formatters are created through the `NewFormatter(formatterType, color)` factory function.

## Key Commands and Usage

### Build

```powershell
go build -o debugger.exe
```

### Lint

```powershell
go vet
golangci-lint run
```

### Basic Usage

```powershell
debugger --help
debugger version
debugger --host 192.168.1.100 --port 5005 threads
debugger --json stack --thread-id 1
debugger --watch --interval 2 threads
```

### Exit Codes

| Code | Meaning          |
| ---- | ---------------- |
| 0    | Success          |
| 1    | Input Error      |
| 2    | Connection Error |
| 3    | Protocol Error   |

---

## Development Conventions

### Code Style

- Follow Go standard formatting (`gofmt`)
- Interface names should use `-er` suffix (e.g., `DebugProtocol`, `Formatter`)
- Factory functions should use `New` prefix (e.g., `NewDefaultConfig`, `NewFormatter`)
- Use custom error types for error handling (`APIError`, `ValidationError`)

### Configuration Standards

- All configuration fields must include `mapstructure`, `yaml`, and `toml` tags
- Environment variables must use the `DEBUGGER_` prefix uniformly
- Configuration validation should be implemented in the `Validate()` method and return a `ValidationError`
