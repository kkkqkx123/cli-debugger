# Error Handling Migration Guide

## Overview

This document provides a phased migration plan for transitioning from the existing error handling system to the new unified error handling framework in `pkg/errors`.

## Migration Goals

1. **Reduce Code Duplication**: Eliminate 70% of repetitive error handling code
2. **Unify Error Format**: Consistent error messages and exit codes across the codebase
3. **Improve Maintainability**: Centralized error code and message management
4. **Enhance User Experience**: Better error reporting with verbose mode support
5. **Enable Observability**: Foundation for logging, monitoring, and tracing
6. **Integrate with Output Module**: Use the existing output formatting system for error display

## Current Error Handling Issues

### 1. Code Duplication

**Command Layer** (10+ files affected):

- Each command file has identical error handling patterns
- 60+ instances of `fmt.Fprintf(os.Stderr, "Error: %v\n", err); os.Exit(1)`

**JDWP Plugin** (15+ files affected):

- Each method wraps errors with similar `api.APIError` structures
- 50+ instances of error wrapping code

### 2. Inconsistent Error Messages

- Some use `fmt.Sprintf`, others use direct strings
- Missing context information in many errors
- No standardized error codes

### 3. Hardcoded Exit Codes

- Exit codes (1, 2, 3) scattered across commands
- No central definition of exit code meanings

### 4. Missing Features

- No verbose error mode
- No error logging
- No error tracing
- No internationalization support
- **Error output not integrated with output formatting system**

### 5. Output Module Integration Issues

**Current Problem**:

- `pkg/errors/handler.go` directly writes to `os.Stderr` using `fmt.Fprintf()`
- Error output bypasses the `internal/output` formatting system
- Inconsistent with successful output (which uses formatters)
- Cannot leverage existing formatter features (color, JSON, table formats)

**Impact**:

- Errors always go to stderr, regardless of output format setting
- JSON mode doesn't structure error output properly
- Table mode doesn't display errors in table format
- Color settings not respected for error output
- Cannot redirect error output to custom writers

## New Error Handling Framework

### Structure

```
pkg/errors/
├── errors.go          # Error types and utility functions
├── handler.go         # Error handlers and validators
├── errors_test.go     # Unit tests for error types
└── handler_test.go    # Unit tests for handlers
```

### Key Components

#### 1. Error Types

```go
type ErrorCode int

const (
    // General errors (0-99)
    ErrSuccess ErrorCode = 0
    ErrUnknown ErrorCode = 1
    ErrInternal ErrorCode = 2

    // Input errors (100-199)
    ErrInvalidInput ErrorCode = 100
    ErrMissingRequiredField ErrorCode = 101
    ErrInvalidFormat ErrorCode = 102
    ErrOutOfRange ErrorCode = 103

    // Connection errors (200-299)
    ErrConnectionFailed ErrorCode = 200
    ErrConnectionTimeout ErrorCode = 201
    ErrConnectionRefused ErrorCode = 202
    ErrConnectionClosed ErrorCode = 203
    ErrHandshakeFailed ErrorCode = 204

    // Protocol errors (300-399)
    ErrProtocolError ErrorCode = 300
    ErrInvalidResponse ErrorCode = 301
    ErrUnsupportedCommand ErrorCode = 302
    ErrPacketFormatError ErrorCode = 303

    // Command errors (400-499)
    ErrCommandFailed ErrorCode = 400
    ErrCommandTimeout ErrorCode = 401
    ErrResourceNotFound ErrorCode = 402
    ErrPermissionDenied ErrorCode = 403
    ErrOperationNotSupported ErrorCode = 404
)

type ErrorType int

const (
    ErrorTypeUnknown ErrorType = iota
    ErrorTypeInput
    ErrorTypeConnection
    ErrorTypeProtocol
    ErrorTypeCommand
    ErrorTypeInternal
)

type APIError struct {
    Type    ErrorType
    Code    ErrorCode
    Message string
    Cause   error
}
```

#### 2. Error Wrapping Functions

```go
// Wrap errors with context
WrapConnectionError(err error, code ErrorCode, message string) error
WrapProtocolError(err error, code ErrorCode, message string) error
WrapCommandError(err error, code ErrorCode, message string) error
WrapInputError(err error, code ErrorCode, message string) error
WrapInternalError(err error, code ErrorCode, message string) error

// Create new errors
NewInputError(code ErrorCode, message string) error
NewConnectionError(code ErrorCode, message string) error
NewProtocolError(code ErrorCode, message string) error
NewCommandError(code ErrorCode, message string) error
NewInternalError(code ErrorCode, message string) error
```

#### 3. Error Handlers

```go
// Print errors
PrintError(err error)
PrintVerboseError(err error)
PrintErrorTo(err error, output *os.File)
PrintVerboseErrorTo(err error, output *os.File)

// Exit with error
ExitWithError(err error)
ExitWithVerboseError(err error)

// Get exit code
GetExitCodeFromError(err error) int

// Format error
FormatError(err error, verbose bool) string

// Error handler interface
type ErrorHandler interface {
    Handle(err error)
    SetVerbose(verbose bool)
    SetOutput(output *os.File)
}
```

#### 4. Validation Functions

```go
ValidateRequired(fieldName string, value interface{}) error
ValidateRange(fieldName string, value int, min, max int) error
ValidatePositive(fieldName string, value int) error
ValidateNonNegative(fieldName string, value int) error
```

#### 5. Error Type Checkers

```go
IsConnectionError(err error) bool
IsProtocolError(err error) bool
IsCommandError(err error) bool
IsInputError(err error) bool
IsInternalError(err error) bool
```

## Migration Phases

### Phase 1: Core Library Migration (Priority: HIGH)

**Objective**: Migrate the JDWP plugin and configuration layer to use the new error handling framework.

**Estimated Time**: 2-3 days

**Files to Migrate**:

#### JDWP Plugin (15 files)

1. `internal/api/jdwp/client.go`
2. `internal/api/jdwp/thread.go`
3. `internal/api/jdwp/vm.go`
4. `internal/api/jdwp/event.go`
5. `internal/api/jdwp/protocol.go`
6. `internal/api/jdwp/handshake.go`
7. `internal/api/jdwp/server.go`
8. `internal/api/jdwp/stackframe.go`
9. `internal/api/jdwp/objectreference.go`
10. `internal/api/jdwp/arrayreference.go`
11. `internal/api/jdwp/stringreference.go`
12. `internal/api/jdwp/classobjectreference.go`
13. `internal/api/jdwp/classtype.go`
14. `internal/api/jdwp/referencetype.go`
15. `internal/api/jdwp/modulereference.go`

**Migration Pattern**:

**Before**:

```go
if err != nil {
    return &api.APIError{
        Type:    api.ConnectionError,
        Message: fmt.Sprintf("Unable to connect to %s", address),
        Cause:   err,
    }
}
```

**After**:

```go
import "cli-debugger/pkg/errors"

if err != nil {
    return errors.WrapConnectionError(err, errors.ErrConnectionFailed,
        fmt.Sprintf("Unable to connect to %s", address))
}
```

**Detailed Steps**:

1. **Add import** at the top of each file:

   ```go
   import "cli-debugger/pkg/errors"
   ```

2. **Replace error wrapping**:
   - `api.ConnectionError` → `errors.WrapConnectionError()`
   - `api.ProtocolError` → `errors.WrapProtocolError()`
   - `api.CommandError` → `errors.WrapCommandError()`
   - `api.InputError` → `errors.WrapInputError()`
   - `api.InternalError` → `errors.WrapInternalError()`

3. **Update error codes**:
   - Use predefined `errors.Err*` constants
   - Add new error codes if needed (follow numbering scheme)

4. **Test each file**:
   ```bash
   go test ./internal/api/jdwp/...
   ```

#### Configuration Layer (3 files)

1. `internal/config/config.go`
2. `internal/config/loader.go`
3. `internal/config/paths.go`

**Migration Pattern**:

**Before**:

```go
if c.Protocol == "" {
    return NewValidationError("protocol", "The protocol name cannot be null")
}

if c.Port <= 0 || c.Port > 65535 {
    return NewValidationError("port", "The port number must be in the range 1-65535")
}
```

**After**:

```go
import "cli-debugger/pkg/errors"

if err := errors.ValidateRequired("protocol", c.Protocol); err != nil {
    return err
}

if err := errors.ValidateRange("port", c.Port, 1, 65535); err != nil {
    return err
}
```

**Detailed Steps**:

1. **Replace validation calls**:
   - Use `errors.ValidateRequired()` for required fields
   - Use `errors.ValidateRange()` for numeric ranges
   - Use `errors.ValidatePositive()` for positive numbers
   - Use `errors.ValidateNonNegative()` for non-negative numbers

2. **Remove old ValidationError**:
   - Delete `ValidationError` struct
   - Delete `NewValidationError()` function

3. **Test**:
   ```bash
   go test ./internal/config/...
   ```

**Phase 1 Completion Criteria**:

- [ ] All JDWP plugin files migrated
- [ ] All configuration files migrated
- [ ] All tests passing
- [ ] No references to old `api.APIError` in migrated files
- [ ] No references to old `config.ValidationError` in migrated files

---

## Error Output Integration with Output Module

### Analysis: Should Error Output Use the Output Module?

**Answer: YES - Error output should be integrated with the output module.**

### Rationale

#### 1. **Consistency**

**Current State**:

- Successful output uses `internal/output` formatters (text, JSON, table)
- Error output uses direct `fmt.Fprintf()` to `os.Stderr`
- Inconsistent user experience

**Desired State**:

- All output (success and error) uses the same formatting system
- Consistent color, format, and styling across all output

#### 2. **Format Support**

**Current Limitations**:

```bash
# JSON mode - error is plain text, not JSON
debugger --json threads
# Output: {"type":"threads","count":5,"threads":[...]}
# Error: Error: Connection failed

# Table mode - error is plain text, not table
debugger --table threads
# Output: ┌──────┬───────┐
#         │ ID   │ Name  │
#         └──────┴───────┘
# Error: Error: Connection failed
```

**Desired Behavior**:

```bash
# JSON mode - error should be JSON
debugger --json threads
# Error: {"type":"error","error":{"type":"connection","code":200,"message":"Connection failed"}}

# Table mode - error should be in table format
debugger --table threads
# Error: ┌─────────────┬──────────────────┐
#         │ Attribute   │ Value            │
#         ├─────────────┼──────────────────┤
#         │ Error Type  │ connection       │
#         │ Error Code  │ 200              │
#         │ Message     │ Connection failed│
#         └─────────────┴──────────────────┘
```

#### 3. **Color Support**

**Current State**:

- Successful output respects `--no-color` flag
- Error output ignores color settings
- Inconsistent visual experience

**Desired State**:

- Error output respects `--no-color` flag
- Error output uses same color scheme as successful output
- Consistent visual experience

#### 4. **Output Redirection**

**Current State**:

```go
// Error always goes to stderr
errors.ExitWithError(err)  // writes to os.Stderr
```

**Desired State**:

```go
// Error can be redirected to any writer
formatter := output.NewFormatter(outputType, color)
formatter.SetWriter(os.Stdout)  // or any io.Writer
formatter.FormatError(err)
```

### Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Command Layer                      │
│                    (cmd/*.go)                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   pkg/errors         │
         │  - Error Types        │
         │  - Error Wrapping    │
         │  - Validation        │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  internal/output     │
         │  - TextFormatter     │
         │  - JSONFormatter     │
         │  - TableFormatter    │
         └───────────┬───────────┘
                     │
                     ▼
              ┌──────────────┐
              │  io.Writer   │
              │  - stdout    │
              │  - stderr    │
              │  - custom    │
              └──────────────┘
```

### Implementation Strategy

#### Option 1: Direct Integration (Recommended)

**Approach**: Modify `pkg/errors/handler.go` to use output formatters.

**Pros**:

- Clean separation of concerns
- Errors are formatted consistently with other output
- Easy to maintain

**Cons**:

- Creates circular dependency if not careful (`pkg/errors` → `internal/output`)
- Need to handle the dependency carefully

**Solution**: Use interface injection to avoid circular dependency.

```go
// pkg/errors/handler.go

// ErrorFormatter Interface for error formatting
type ErrorFormatter interface {
    FormatError(err error) error
    SetWriter(writer io.Writer)
}

// ErrorHandler Error handler interface
type ErrorHandler interface {
    Handle(err error)
    SetVerbose(verbose bool)
    SetFormatter(formatter ErrorFormatter)
}

type DefaultErrorHandler struct {
    verbose   bool
    formatter ErrorFormatter
}

func (h *DefaultErrorHandler) SetFormatter(formatter ErrorFormatter) {
    h.formatter = formatter
}

func (h *DefaultErrorHandler) Handle(err error) {
    if err == nil {
        return
    }

    // Use formatter to display error
    if h.formatter != nil {
        h.formatter.FormatError(err)
    } else {
        // Fallback to simple output
        fmt.Fprintf(os.Stderr, "Error: %v\n", err)
    }

    // Get exit code and exit
    exitCode := GetExitCodeFromError(err)
    os.Exit(exitCode)
}
```

**Usage in Commands**:

```go
// cmd/root.go

var (
    verbose      bool
    outputFormat string
    noColor      bool
)

func init() {
    rootCmd.PersistentFlags().BoolVar(&verbose, "verbose", false, "Display protocol level details")
    rootCmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "text", "Output format (text/json/table)")
    rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "Disable color output")
}

// cmd/threads.go

var threadsCmd = &cobra.Command{
    Use:   "threads",
    Short: "List all threads",
    Run: func(cmd *cobra.Command, args []string) {
        // Create error handler with formatter
        errorHandler := errors.NewErrorHandler()
        errorHandler.SetVerbose(verbose)

        formatter := output.NewFormatter(
            output.GetFormatterType(outputFormat),
            !noColor,
        )
        formatter.SetWriter(os.Stderr)
        errorHandler.SetFormatter(formatter)

        // Create client
        client, err := api.CreateClient(viper.GetString("protocol"))
        if err != nil {
            errorHandler.Handle(err)
            return
        }

        // Connect
        ctx := context.Background()
        if err := client.Connect(ctx); err != nil {
            errorHandler.Handle(err)
            return
        }
        defer client.Close()

        // Get threads
        threads, err := client.GetThreads(ctx)
        if err != nil {
            errorHandler.Handle(err)
            return
        }

        // Format success output
        formatter.SetWriter(os.Stdout)
        if err := formatter.FormatThreads(threads); err != nil {
            errorHandler.Handle(err)
            return
        }
    },
}
```

### Recommendation

**Use Option 1 (Direct Integration) with Interface Injection**

**Reasons**:

1. Clean separation of concerns
2. Reusable error handler across all commands
3. Consistent with project architecture
4. Easy to test
5. Future-proof for additional features (logging, metrics)

**Implementation Steps**:

1. **Update `pkg/errors/handler.go`**:
   - Add `ErrorFormatter` interface
   - Modify `ErrorHandler` to accept formatter
   - Update `Handle()` to use formatter

2. **Update `cmd/root.go`**:
   - Export `verbose`, `outputFormat`, `noColor` variables
   - Create global error handler instance

3. **Update all command files**:
   - Use error handler instead of direct error printing
   - Pass formatter to error handler

4. **Update `internal/output/formatter.go`**:
   - Ensure all formatters implement `ErrorFormatter` interface
   - Test error formatting in all formats

### Migration Impact

**Phase 1 (Core Library)**: No changes needed
**Phase 2 (Command Layer)**: Update to use error handler with formatter
**Phase 3 (Output Formatting)**: Ensure formatters handle errors correctly
**Phase 4 (Cleanup)**: Remove direct error printing from commands

---

### Phase 2: Command Layer Migration (Priority: HIGH)

**Objective**: Migrate all command files to use the new error handling framework.

**Estimated Time**: 1-2 days

**Files to Migrate**:

1. `cmd/threads.go`
2. `cmd/stack.go`
3. `cmd/variables.go`
4. `cmd/breakpoints.go`
5. `cmd/control.go`
6. `cmd/step.go`
7. `cmd/version.go`
8. `cmd/root.go`

**Migration Pattern**:

**Before**:

```go
client, err := api.CreateClient(viper.GetString("protocol"))
if err != nil {
    fmt.Fprintf(os.Stderr, "Error: %v\n", err)
    os.Exit(1)
}

ctx := context.Background()
if err := client.Connect(ctx); err != nil {
    fmt.Fprintf(os.Stderr, "Error: %v\n", err)
    os.Exit(2)
}

threads, err := client.GetThreads(ctx)
if err != nil {
    fmt.Fprintf(os.Stderr, "Error: %v\n", err)
    os.Exit(3)
}
```

**After**:

```go
import "cli-debugger/pkg/errors"

client, err := api.CreateClient(viper.GetString("protocol"))
if err != nil {
    errors.ExitWithError(err)
}

ctx := context.Background()
if err := client.Connect(ctx); err != nil {
    errors.ExitWithError(err)
}

threads, err := client.GetThreads(ctx)
if err != nil {
    errors.ExitWithError(err)
}
```

**Verbose Mode Support**:

```go
// In root.go, add verbose flag to context
var verbose bool

rootCmd.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
    verbose = viper.GetBool("verbose")
    return initConfig(cmd)
}

// In command files, use verbose mode
if err != nil {
    if verbose {
        errors.ExitWithVerboseError(err)
    } else {
        errors.ExitWithError(err)
    }
}
```

**Detailed Steps**:

1. **Add import** at the top of each command file:

   ```go
   import "cli-debugger/pkg/errors"
   ```

2. **Replace error handling**:
   - Find all `fmt.Fprintf(os.Stderr, "Error: %v\n", err); os.Exit(1)` patterns
   - Replace with `errors.ExitWithError(err)`
   - For verbose mode, use `errors.ExitWithVerboseError(err)`

3. **Remove redundant error messages**:
   - The new framework provides standardized error messages
   - Only add custom messages when necessary

4. **Test each command**:
   ```bash
   go build -o debugger
   ./debugger threads
   ./debugger stack --thread-id 1
   ./debugger breakpoints list
   ```

**Phase 2 Completion Criteria**:

- [ ] All command files migrated
- [ ] All commands work correctly
- [ ] Verbose mode implemented
- [ ] Exit codes consistent
- [ ] No manual error printing in command files
- [ ] Error output uses output formatters
- [ ] Error output respects --output format
- [ ] Error output respects --no-color flag
- [ ] JSON errors properly formatted
- [ ] Table errors properly formatted

---

### Phase 3: Output Formatting Migration (Priority: MEDIUM)

**Objective**: Update output formatters to support the new error structure.

**Estimated Time**: 1 day

**Files to Migrate**:

1. `internal/output/formatter.go`
2. `internal/output/text.go`
3. `internal/output/json.go`
4. `internal/output/table.go`

**Migration Pattern**:

**Before** (text.go):

```go
func (f *TextFormatter) FormatError(err error) error {
    if f.color {
        errorColor := color.New(color.FgRed, color.Bold).SprintFunc()
        fmt.Fprintf(f.writer, "%s: %v\n", errorColor("incorrect"), err)
    } else {
        fmt.Fprintf(f.writer, "Error: %v\n", err)
    }
    return nil
}
```

**After**:

```go
import "cli-debugger/pkg/errors"

func (f *TextFormatter) FormatError(err error) error {
    var apiErr *errors.APIError
    if !errors.As(err, &apiErr) {
        // Non-API error, use simple format
        if f.color {
            errorColor := color.New(color.FgRed, color.Bold).SprintFunc()
            fmt.Fprintf(f.writer, "%s: %v\n", errorColor("Error"), err)
        } else {
            fmt.Fprintf(f.writer, "Error: %v\n", err)
        }
        return nil
    }

    // API error, use structured format
    if f.color {
        typeColor := color.New(color.FgCyan).SprintFunc()
        codeColor := color.New(color.FgYellow).SprintFunc()
        msgColor := color.New(color.FgRed, color.Bold).SprintFunc()

        fmt.Fprintf(f.writer, "%s [%s:%d]: %s\n",
            msgColor("Error"),
            typeColor(errors.ErrorTypeToString(apiErr.Type)),
            codeColor(apiErr.Code),
            apiErr.Message)
    } else {
        fmt.Fprintf(f.writer, "Error [%s:%d]: %s\n",
            errors.ErrorTypeToString(apiErr.Type),
            apiErr.Code,
            apiErr.Message)
    }

    if apiErr.Cause != nil {
        fmt.Fprintf(f.writer, "Cause: %v\n", apiErr.Cause)
    }

    return nil
}
```

**JSON Formatter**:

```go
func (f *jsonFormatter) FormatError(err error) error {
    var apiErr *errors.APIError
    if !errors.As(err, &apiErr) {
        return f.encodeJSON(map[string]interface{}{
            "type": "error",
            "error": map[string]interface{}{
                "message": err.Error(),
            },
        })
    }

    return f.encodeJSON(map[string]interface{}{
        "type": "error",
        "error": map[string]interface{}{
            "type":    errors.ErrorTypeToString(apiErr.Type),
            "code":    apiErr.Code,
            "message": apiErr.Message,
            "cause":   errCause(apiErr.Cause),
        },
    })
}

func errCause(err error) interface{} {
    if err == nil {
        return nil
    }
    return err.Error()
}
```

**Table Formatter**:

```go
func (f *TableFormatter) FormatError(err error) error {
    var apiErr *errors.APIError
    if !errors.As(err, &apiErr) {
        if f.color {
            errorColor := color.New(color.FgRed, color.Bold).SprintFunc()
            fmt.Fprintf(f.writer, "%s: %v\n", errorColor("Error"), err)
        } else {
            fmt.Fprintf(f.writer, "Error: %v\n", err)
        }
        return nil
    }

    table := tablewriter.NewTable(f.writer,
        tablewriter.WithHeader([]string{"Attribute", "Value"}),
        tablewriter.WithRendition(tw.Rendition{Borders: tw.Border{Top: tw.State(1), Bottom: tw.State(1)}}),
        tablewriter.WithRowAlignment(tw.AlignLeft),
    )

    table.Append([]string{"Error Type", errors.ErrorTypeToString(apiErr.Type)})
    table.Append([]string{"Error Code", fmt.Sprintf("%d", apiErr.Code)})
    table.Append([]string{"Message", apiErr.Message})

    if apiErr.Cause != nil {
        table.Append([]string{"Cause", fmt.Sprintf("%v", apiErr.Cause)})
    }

    table.Render()
    return nil
}
```

**Detailed Steps**:

1. **Update each formatter**:
   - Import `cli-debugger/pkg/errors`
   - Check if error is `*errors.APIError` using `errors.As()`
   - Format error with type, code, message, and cause
   - Maintain color support for text and table formatters

2. **Test each formatter**:
   ```bash
   go test ./internal/output/...
   ```

**Phase 3 Completion Criteria**:

- [ ] All formatters updated
- [ ] Error information properly displayed in all formats
- [ ] Color support maintained
- [ ] JSON output includes error type and code
- [ ] Table output shows error details
- [ ] Verbose mode supported in all formatters
- [ ] Error formatter interface implemented
- [ ] All formatter tests passing

---

### Phase 4: Cleanup and Deprecation (Priority: MEDIUM)

**Objective**: Remove old error handling code and update documentation.

**Estimated Time**: 1 day

**Files to Clean Up**:

1. `internal/api/base.go` - Remove old `APIError` and `ErrorType`
2. `internal/config/config.go` - Remove old `ValidationError`
3. Documentation files

**Cleanup Steps**:

#### 1. Remove Old APIError

**Before** (`internal/api/base.go`):

```go
// APIError Unified API error types
type APIError struct {
	Type    ErrorType
	Code    int
	Message string
	Cause   error
}

func (e *APIError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

// ErrorType Error type
type ErrorType int

const (
	ConnectionError ErrorType = iota + 1
	ProtocolError
	CommandError
	InputError
	InternalError
)

func (t ErrorType) String() string {
	switch t {
	case ConnectionError:
		return "connection"
	case ProtocolError:
		return "protocol"
	case CommandError:
		return "command"
	case InputError:
		return "input"
	case InternalError:
		return "internal"
	default:
		return "unknown"
	}
}
```

**After**:

```go
// This file now only contains the DebugProtocol interface
// Error handling has been moved to pkg/errors
```

#### 2. Remove Old ValidationError

**Before** (`internal/config/config.go`):

```go
// ValidationError Configuration validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("Configuration validation failed [%s]: %s", e.Field, e.Message)
}

func NewValidationError(field, message string) *ValidationError {
	return &ValidationError{
		Field:   field,
		Message: message,
	}
}
```

**After**:

```go
// Validation now uses pkg/errors validators
```

#### 3. Update Import Statements

Search and replace imports across the codebase:

```bash
# Remove old imports
grep -r "internal/api.*APIError" --include="*.go" .
grep -r "internal/config.*ValidationError" --include="*.go" .

# Ensure new imports are present
grep -r "cli-debugger/pkg/errors" --include="*.go" .
```

#### 4. Update Documentation

Update `README.md` and other documentation:

````markdown
## Error Handling

The project uses a unified error handling framework defined in `pkg/errors`.

### Error Types

- **Input Errors** (100-199): Invalid user input
- **Connection Errors** (200-299): Network/connection issues
- **Protocol Errors** (300-399): Debugging protocol errors
- **Command Errors** (400-499): Command execution failures
- **Internal Errors** (0-99): Unexpected internal errors

### Exit Codes

- `0`: Success
- `1`: Input error
- `2`: Connection error
- `3`: Protocol error
- `4`: Command error
- `5`: Internal error

### Usage

```go
import "cli-debugger/pkg/errors"

// Wrap errors
return errors.WrapConnectionError(err, errors.ErrConnectionFailed, "Failed to connect")

// Create errors
return errors.NewInputError(errors.ErrInvalidInput, "Invalid input format")

// Handle errors in commands
if err != nil {
    errors.ExitWithError(err)
}

// Validate input
if err := errors.ValidateRequired("host", host); err != nil {
    return err
}
```
````

### Verbose Mode

Use `--verbose` flag to see detailed error information:

```bash
debugger --verbose threads
```

````

**Phase 4 Completion Criteria**:

- [ ] Old `APIError` removed from `internal/api/base.go`
- [ ] Old `ValidationError` removed from `internal/config/config.go`
- [ ] No remaining references to old error types
- [ ] Documentation updated
- [ ] All tests passing

---

### Phase 5: Enhanced Features (Priority: LOW)

**Objective**: Add advanced error handling features.

**Estimated Time**: 2-3 days

**Features to Implement**:

#### 1. Error Logging

Add structured logging support:

```go
// pkg/errors/logger.go
package errors

import (
    "log/slog"
    "os"
)

var logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))

func LogError(err error) {
    var apiErr *APIError
    if !As(err, &apiErr) {
        logger.Error("error", "message", err.Error())
        return
    }

    logger.Error("error",
        "type", ErrorTypeToString(apiErr.Type),
        "code", apiErr.Code,
        "message", apiErr.Message,
        "cause", apiErr.Cause,
    )
}
````

#### 2. Error Tracing

Add stack trace support:

```go
// pkg/errors/trace.go
package errors

import (
    "runtime/debug"
)

type TracedError struct {
    *APIError
    Stack []byte
}

func (e *TracedError) Error() string {
    return e.APIError.Error() + "\n" + string(e.Stack)
}

func WrapWithTrace(err error, errorType ErrorType, code ErrorCode, message string) error {
    if err == nil {
        return nil
    }
    return &TracedError{
        APIError: NewAPIError(errorType, code, message, err),
        Stack:    debug.Stack(),
    }
}
```

#### 3. Error Metrics

Add error metrics collection:

```go
// pkg/errors/metrics.go
package errors

import (
    "sync"
)

type ErrorMetrics struct {
    mu          sync.Mutex
    counts      map[ErrorCode]int
    typeCounts  map[ErrorType]int
}

var metrics = &ErrorMetrics{
    counts:     make(map[ErrorCode]int),
    typeCounts: make(map[ErrorType]int),
}

func RecordError(err error) {
    var apiErr *APIError
    if !As(err, &apiErr) {
        return
    }

    metrics.mu.Lock()
    defer metrics.mu.Unlock()

    metrics.counts[apiErr.Code]++
    metrics.typeCounts[apiErr.Type]++
}

func GetMetrics() map[string]int {
    metrics.mu.Lock()
    defer metrics.mu.Unlock()

    result := make(map[string]int)
    for code, count := range metrics.counts {
        result[string(code)] = count
    }
    return result
}
```

#### 4. Internationalization

Add i18n support for error messages:

```go
// pkg/errors/i18n.go
package errors

import (
    "sync"
)

var (
    messages sync.Map
)

func init() {
    // Default English messages
    setMessages("en", map[ErrorCode]string{
        ErrConnectionFailed: "Connection failed",
        ErrProtocolError:    "Protocol error",
        ErrCommandFailed:    "Command failed",
        // ...
    })
}

func setMessages(lang string, msgs map[ErrorCode]string) {
    messages.Store(lang, msgs)
}

func GetLocalizedMessage(code ErrorCode, lang string) string {
    val, ok := messages.Load(lang)
    if !ok {
        val, _ = messages.Load("en")
    }

    msgs := val.(map[ErrorCode]string)
    if msg, ok := msgs[code]; ok {
        return msg
    }
    return ErrorMessages[code]
}

func (e *APIError) LocalizedError(lang string) string {
    msg := GetLocalizedMessage(e.Code, lang)
    if e.Cause != nil {
        return msg + ": " + e.Cause.Error()
    }
    return msg
}
```

**Phase 5 Completion Criteria**:

- [ ] Error logging implemented
- [ ] Error tracing implemented (optional)
- [ ] Error metrics implemented (optional)
- [ ] Internationalization support added (optional)
- [ ] Documentation updated

---

## Testing Strategy

### Unit Tests

Each phase should include comprehensive unit tests:

```go
// pkg/errors/errors_test.go
func TestWrapConnectionError(t *testing.T) {
    originalErr := errors.New("network error")
    wrappedErr := errors.WrapConnectionError(originalErr, 0, "Failed to connect")

    if wrappedErr == nil {
        t.Fatal("Expected wrapped error, got nil")
    }
    if !errors.Is(wrappedErr, originalErr) {
        t.Error("Wrapped error should wrap original error")
    }
    if !errors.IsConnectionError(wrappedErr) {
        t.Error("Should be a connection error")
    }
}
```

### Integration Tests

Test the full error flow:

```go
// cmd/threads_test.go
func TestThreadsCommand(t *testing.T) {
    tests := []struct {
        name       string
        args       []string
        wantErr    bool
        errCode    errors.ErrorCode
    }{
        {
            name:    "valid connection",
            args:    []string{"--host", "127.0.0.1", "--port", "5005", "threads"},
            wantErr: false,
        },
        {
            name:    "connection failed",
            args:    []string{"--host", "invalid", "--port", "9999", "threads"},
            wantErr: true,
            errCode: errors.ErrConnectionFailed,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            cmd := rootCmd
            cmd.SetArgs(tt.args)

            err := cmd.Execute()
            if (err != nil) != tt.wantErr {
                t.Errorf("Execute() error = %v, wantErr %v", err, tt.wantErr)
            }

            if tt.wantErr {
                var apiErr *errors.APIError
                if !errors.As(err, &apiErr) {
                    t.Errorf("Expected APIError, got %T", err)
                }
                if apiErr.Code != tt.errCode {
                    t.Errorf("Expected error code %d, got %d", tt.errCode, apiErr.Code)
                }
            }
        })
    }
}
```

### Manual Testing

Test each command with various error scenarios:

```bash
# Test connection errors
debugger --host invalid --port 9999 threads

# Test protocol errors
debugger --host 127.0.0.1 --port 5005 threads

# Test input errors
debugger stack --thread-id ""
debugger stack --thread-id invalid

# Test verbose mode
debugger --verbose stack --thread-id 1

# Test JSON output
debugger --json stack --thread-id 1
```

---

## Rollback Plan

If issues arise during migration, follow these steps:

1. **Identify the problematic phase**:

   ```bash
   git log --oneline
   ```

2. **Revert to the previous phase**:

   ```bash
   git revert <commit-hash>
   ```

3. **Test the reverted code**:

   ```bash
   go test ./...
   go build -o debugger
   ./debugger threads
   ```

4. **Document the issue**:
   - Create a GitHub issue
   - Describe the problem
   - Attach error logs
   - Suggest a fix

---

## Success Metrics

Track the following metrics to ensure migration success:

1. **Code Reduction**:
   - Target: 70% reduction in error handling code
   - Measure: Lines of code before/after

2. **Test Coverage**:
   - Target: 90%+ coverage for `pkg/errors`
   - Measure: `go test -cover ./pkg/errors/...`

3. **Error Consistency**:
   - Target: 100% of errors use new framework
   - Measure: `grep -r "fmt.Fprintf.*os.Stderr" --include="*.go" .`

4. **User Experience**:
   - Target: All errors have clear messages
   - Measure: Manual testing feedback

5. **Performance**:
   - Target: No performance degradation
   - Measure: Benchmark tests

---

## Timeline

| Phase                      | Duration | Start Date | End Date | Status  |
| -------------------------- | -------- | ---------- | -------- | ------- |
| Phase 1: Core Library      | 2-3 days | TBD        | TBD      | Pending |
| Phase 2: Command Layer     | 1-2 days | TBD        | TBD      | Pending |
| Phase 3: Output Formatting | 1 day    | TBD        | TBD      | Pending |
| Phase 4: Cleanup           | 1 day    | TBD        | TBD      | Pending |
| Phase 5: Enhanced Features | 2-3 days | TBD        | TBD      | Pending |

**Total Estimated Time**: 7-12 days

---

## Contributors

- [Your Name] - Lead Developer

---

## References

- [Go Error Handling Best Practices](https://go.dev/blog/error-handling-and-go)
- [pkg/errors Documentation](https://pkg.go.dev/github.com/pkg/errors)
- [Cobra Documentation](https://github.com/spf13/cobra)

---

## Changelog

### v1.0.0 (2024-XX-XX)

- Initial migration plan
- Defined error types and codes
- Implemented core error handling framework
