package api

import (
	"context"
	"testing"
	"time"

	"cli-debugger/pkg/types"
)

func TestRegisterPlugin(t *testing.T) {
	// Test Plug-in Registration
	factory := func() DebugProtocol { return &testProtocol{} }
	
	err := RegisterPlugin("test", factory)
	if err != nil {
		t.Errorf("Failed to register plugin: %v", err)
	}
}

func TestCreateClient(t *testing.T) {
	// Test Client Creation
	client, err := CreateClient("jdwp")
	if err != nil {
		t.Errorf("Failed to create client: %v", err)
	}
	if client == nil {
		t.Error("Client should not be nil")
	}
}

func TestAutoDetect(t *testing.T) {
	// Test automated detection
	protocol := AutoDetect()
	// "jdwp" should be returned by default (port 5005)
	if protocol != "jdwp" && protocol != "" {
		t.Errorf("Automatic detection of protocol anomalies: %s", protocol)
	}
}

func TestGetRegisteredProtocols(t *testing.T) {
	// Test to get the list of registered protocols
	protocols := GetRegisteredProtocols()
	if len(protocols) == 0 {
		t.Error("There should be at least one registered agreement")
	}
}

func TestHasProtocol(t *testing.T) {
	// The test checks that the protocol exists
	if !HasProtocol("jdwp") {
		t.Error("The JDWP agreement should be registered")
	}
	if HasProtocol("nonexistent") {
		t.Error("Protocols that don't exist shouldn't be found")
	}
}

// testProtocol Implementation using protocol
type testProtocol struct{}

func (p *testProtocol) Connect(ctx context.Context) error { return nil }
func (p *testProtocol) Close() error                      { return nil }
func (p *testProtocol) IsConnected() bool                 { return false }
func (p *testProtocol) Version(ctx context.Context) (*types.VersionInfo, error) {
	return nil, nil
}
func (p *testProtocol) Capabilities(ctx context.Context) (*types.Capabilities, error) {
	return nil, nil
}
func (p *testProtocol) GetThreads(ctx context.Context) ([]*types.ThreadInfo, error) {
	return nil, nil
}
func (p *testProtocol) GetThreadStack(ctx context.Context, threadID string) ([]*types.StackFrame, error) {
	return nil, nil
}
func (p *testProtocol) GetThreadState(ctx context.Context, threadID string) (string, error) {
	return "", nil
}
func (p *testProtocol) Suspend(ctx context.Context, threadID string) error {
	return nil
}
func (p *testProtocol) Resume(ctx context.Context, threadID string) error {
	return nil
}
func (p *testProtocol) StepInto(ctx context.Context, threadID string) error {
	return nil
}
func (p *testProtocol) StepOver(ctx context.Context, threadID string) error {
	return nil
}
func (p *testProtocol) StepOut(ctx context.Context, threadID string) error {
	return nil
}
func (p *testProtocol) SetBreakpoint(ctx context.Context, location string, condition string) (string, error) {
	return "", nil
}
func (p *testProtocol) RemoveBreakpoint(ctx context.Context, breakpointID string) error {
	return nil
}
func (p *testProtocol) ClearBreakpoints(ctx context.Context) error {
	return nil
}
func (p *testProtocol) GetBreakpoints(ctx context.Context) ([]*types.BreakpointInfo, error) {
	return nil, nil
}
func (p *testProtocol) GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error) {
	return nil, nil
}
func (p *testProtocol) GetFields(ctx context.Context, objectID string) ([]*types.Variable, error) {
	return nil, nil
}
func (p *testProtocol) WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error) {
	return nil, nil
}
func (p *testProtocol) ProtocolName() string { return "test" }
func (p *testProtocol) SupportedLanguages() []string {
	return []string{"test"}
}