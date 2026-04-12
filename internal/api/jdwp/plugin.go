package jdwp

import (
	"context"
	"time"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

// Plugin JDWP plugin implementation
type Plugin struct {
	client *Client
}

// NewPlugin creates a new instance of the JDWP plugin.
func NewPlugin() *Plugin {
	return &Plugin{
		client: NewClient(),
	}
}

// Connect establishes a connection to the target JVM
func (p *Plugin) Connect(ctx context.Context) error {
	return p.client.Connect(ctx)
}

// Close closes the connection
func (p *Plugin) Close() error {
	return p.client.Close()
}

// IsConnected Checks the connection status
func (p *Plugin) IsConnected() bool {
	return p.client.IsConnected()
}

// Version Get version information
func (p *Plugin) Version(ctx context.Context) (*types.VersionInfo, error) {
	return p.client.Version(ctx)
}

// Capabilities Get the set of features supported by the plugin
func (p *Plugin) Capabilities(ctx context.Context) (*types.Capabilities, error) {
	return &types.Capabilities{
		SupportsVersion:      true,
		SupportsThreads:      true,
		SupportsStack:        true,
		SupportsLocals:       true,
		SupportsBreakpoints:  true,
		SupportsSuspend:      true,
		SupportsResume:       true,
		SupportsStep:         true,
		SupportsCont:         true,
		SupportsNext:         true,
		SupportsFinish:       true,
		SupportsEvents:       true,
		SupportsWatchMode:    true,
		SupportsStreaming:    true,
	}, nil
}

// GetThreads Get a list of all threads.
func (p *Plugin) GetThreads(ctx context.Context) ([]*types.ThreadInfo, error) {
	return p.client.GetThreads(ctx)
}

// GetThreadStack Get the call stack of the specified thread.
func (p *Plugin) GetThreadStack(ctx context.Context, threadID string) ([]*types.StackFrame, error) {
	return p.client.GetThreadStack(ctx, threadID)
}

// GetThreadState Get Thread State
func (p *Plugin) GetThreadState(ctx context.Context, threadID string) (string, error) {
	return p.client.GetThreadState(ctx, threadID)
}

// Suspend Suspends the entire VM or a specified thread.
func (p *Plugin) Suspend(ctx context.Context, threadID string) error {
	if threadID == "" {
		return p.client.SuspendVM(ctx)
	}
	return p.client.SuspendThread(ctx, threadID)
}

// Resume Resume execution
func (p *Plugin) Resume(ctx context.Context, threadID string) error {
	if threadID == "" {
		return p.client.ResumeVM(ctx)
	}
	return p.client.ResumeThread(ctx, threadID)
}

// StepInto Single StepInto
func (p *Plugin) StepInto(ctx context.Context, threadID string) error {
	return p.client.StepInto(ctx, threadID)
}

// StepOver Single-step skip
func (p *Plugin) StepOver(ctx context.Context, threadID string) error {
	return p.client.StepOver(ctx, threadID)
}

// StepOut
func (p *Plugin) StepOut(ctx context.Context, threadID string) error {
	return p.client.StepOut(ctx, threadID)
}

// SetBreakpoint sets a breakpoint.
func (p *Plugin) SetBreakpoint(ctx context.Context, location string, condition string) (string, error) {
	return p.client.SetBreakpoint(ctx, location, condition)
}

// RemoveBreakpoint Removes the specified breakpoint.
func (p *Plugin) RemoveBreakpoint(ctx context.Context, breakpointID string) error {
	return p.client.RemoveBreakpoint(ctx, breakpointID)
}

// ClearBreakpoints Clears all breakpoints.
func (p *Plugin) ClearBreakpoints(ctx context.Context) error {
	return p.client.ClearBreakpoints(ctx)
}

// GetBreakpoints Get all breakpoints.
func (p *Plugin) GetBreakpoints(ctx context.Context) ([]*types.BreakpointInfo, error) {
	return p.client.GetBreakpoints(ctx)
}

// GetLocalVariables Get Local Variables
func (p *Plugin) GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error) {
	return p.client.GetLocalVariables(ctx, threadID, frameIndex)
}

// GetFields Get object fields
func (p *Plugin) GetFields(ctx context.Context, objectID string) ([]*types.Variable, error) {
	return p.client.GetFields(ctx, objectID)
}

// WaitForEvent Wait for debug event
func (p *Plugin) WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error) {
	return p.client.WaitForEvent(ctx, timeout)
}

// ProtocolName Get protocol name
func (p *Plugin) ProtocolName() string {
	return "jdwp"
}

// SupportedLanguages Get a list of supported languages.
func (p *Plugin) SupportedLanguages() []string {
	return []string{"java", "kotlin", "scala"}
}

// init Register JDWP plugin
func init() {
	api.RegisterPlugin("jdwp", func() api.DebugProtocol {
		return NewPlugin()
	})
}