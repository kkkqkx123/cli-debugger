package api

import (
	"context"
	"time"

	"cli-debugger/pkg/types"
)

// DebugProtocol 统一调试协议接口
// 所有语言插件必须实现此接口
type DebugProtocol interface {
	// 生命周期管理
	Connect(ctx context.Context) error
	Close() error
	IsConnected() bool

	// 基础查询
	Version(ctx context.Context) (*types.VersionInfo, error)
	Capabilities(ctx context.Context) (*types.Capabilities, error)

	// 线程管理
	GetThreads(ctx context.Context) ([]*types.ThreadInfo, error)
	GetThreadStack(ctx context.Context, threadID string) ([]*types.StackFrame, error)
	GetThreadState(ctx context.Context, threadID string) (string, error)

	// 执行控制
	Suspend(ctx context.Context, threadID string) error
	Resume(ctx context.Context, threadID string) error
	StepInto(ctx context.Context, threadID string) error
	StepOver(ctx context.Context, threadID string) error
	StepOut(ctx context.Context, threadID string) error

	// 断点管理
	SetBreakpoint(ctx context.Context, location string, condition string) (string, error)
	RemoveBreakpoint(ctx context.Context, breakpointID string) error
	ClearBreakpoints(ctx context.Context) error
	GetBreakpoints(ctx context.Context) ([]*types.BreakpointInfo, error)

	// 变量检查
	GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error)
	GetFields(ctx context.Context, objectID string) ([]*types.Variable, error)

	// 事件处理
	WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error)

	// 元数据
	ProtocolName() string
	SupportedLanguages() []string
}

// PluginFactory 插件工厂函数类型
type PluginFactory func() DebugProtocol

// APIError 统一API错误类型
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

// ErrorType 错误类型
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