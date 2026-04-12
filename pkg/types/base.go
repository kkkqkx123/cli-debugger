package types

import (
	"time"
)

// ThreadInfo ThreadInfo
type ThreadInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	State       string    `json:"state"`
	Status      string    `json:"status"`
	IsSuspended bool      `json:"is_suspended"`
	IsDaemon    bool      `json:"is_daemon"`
	Priority    int       `json:"priority"`
	CreatedAt   time.Time `json:"created_at"`
}

// StackFrame Call StackFrame
type StackFrame struct {
	ID        string `json:"id"`
	Location  string `json:"location"`
	Method    string `json:"method"`
	Line      int    `json:"line"`
	IsNative  bool   `json:"is_native"`
}

// BreakpointInfo Breakpoint Information
type BreakpointInfo struct {
	ID       string `json:"id"`
	Location string `json:"location"`
	Enabled  bool   `json:"enabled"`
	HitCount int    `json:"hit_count"`
	Condition string `json:"condition,omitempty"`
}

// Variable Variable information
type Variable struct {
	Name      string      `json:"name"`
	Type      string      `json:"type"`
	Value     interface{} `json:"value"`
	IsPrimitive bool      `json:"is_primitive"`
	IsNull    bool        `json:"is_null"`
}

// DebugEvent Debug event
type DebugEvent struct {
	Type      string      `json:"type"`
	ThreadID  string      `json:"thread_id"`
	Location  string      `json:"location"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data,omitempty"`
}

// VersionInfo Version Information
type VersionInfo struct {
	ProtocolVersion string `json:"protocol_version"`
	RuntimeVersion  string `json:"runtime_version"`
	RuntimeName     string `json:"runtime_name"`
	Description     string `json:"description"`
}

// Capabilities Plug-in Capabilities Statement
type Capabilities struct {
	SupportsVersion      bool `json:"supports_version"`
	SupportsThreads      bool `json:"supports_threads"`
	SupportsStack        bool `json:"supports_stack"`
	SupportsLocals       bool `json:"supports_locals"`
	SupportsBreakpoints  bool `json:"supports_breakpoints"`
	SupportsSuspend      bool `json:"supports_suspend"`
	SupportsResume       bool `json:"supports_resume"`
	SupportsStep         bool `json:"supports_step"`
	SupportsCont         bool `json:"supports_cont"`
	SupportsNext         bool `json:"supports_next"`
	SupportsFinish       bool `json:"supports_finish"`
	SupportsEvents       bool `json:"supports_events"`
	SupportsWatchMode    bool `json:"supports_watch_mode"`
	SupportsStreaming    bool `json:"supports_streaming"`
}