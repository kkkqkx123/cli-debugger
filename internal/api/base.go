package api

import (
	"context"
	"time"

	"cli-debugger/pkg/types"
)

// DebugProtocol Unified debugging protocol interface
// All language plug-ins must implement this interface
type DebugProtocol interface {
	// lifecycle management
	Connect(ctx context.Context) error
	Close() error
	IsConnected() bool

	// underlying query
	Version(ctx context.Context) (*types.VersionInfo, error)
	Capabilities(ctx context.Context) (*types.Capabilities, error)

	// thread management
	GetThreads(ctx context.Context) ([]*types.ThreadInfo, error)
	GetThreadStack(ctx context.Context, threadID string) ([]*types.StackFrame, error)
	GetThreadState(ctx context.Context, threadID string) (string, error)

	// execution control
	Suspend(ctx context.Context, threadID string) error
	Resume(ctx context.Context, threadID string) error
	StepInto(ctx context.Context, threadID string) error
	StepOver(ctx context.Context, threadID string) error
	StepOut(ctx context.Context, threadID string) error

	// breakpoint management
	SetBreakpoint(ctx context.Context, location string, condition string) (string, error)
	RemoveBreakpoint(ctx context.Context, breakpointID string) error
	ClearBreakpoints(ctx context.Context) error
	GetBreakpoints(ctx context.Context) ([]*types.BreakpointInfo, error)

	// variable check
	GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error)
	GetFields(ctx context.Context, objectID string) ([]*types.Variable, error)

	// event processing
	WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error)

	// metadata
	ProtocolName() string
	SupportedLanguages() []string
}

// PluginFactory Plug-in Factory Function Type
type PluginFactory func() DebugProtocol

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