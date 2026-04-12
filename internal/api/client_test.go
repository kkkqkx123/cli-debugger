package api

import (
	"context"
	"testing"
	"time"

	"cli-debugger/pkg/types"
)

func TestRegisterPlugin(t *testing.T) {
	// 测试插件注册
	factory := func() DebugProtocol { return &testProtocol{} }
	
	err := RegisterPlugin("test", factory)
	if err != nil {
		t.Errorf("注册插件失败：%v", err)
	}
}

func TestCreateClient(t *testing.T) {
	// 测试客户端创建
	client, err := CreateClient("jdwp")
	if err != nil {
		t.Errorf("创建客户端失败：%v", err)
	}
	if client == nil {
		t.Error("客户端不应为 nil")
	}
}

func TestAutoDetect(t *testing.T) {
	// 测试自动检测
	protocol := AutoDetect()
	// 默认情况下应该返回 "jdwp"（端口 5005）
	if protocol != "jdwp" && protocol != "" {
		t.Errorf("自动检测协议异常：%s", protocol)
	}
}

func TestGetRegisteredProtocols(t *testing.T) {
	// 测试获取已注册协议列表
	protocols := GetRegisteredProtocols()
	if len(protocols) == 0 {
		t.Error("至少应该有一个已注册的协议")
	}
}

func TestHasProtocol(t *testing.T) {
	// 测试检查协议是否存在
	if !HasProtocol("jdwp") {
		t.Error("JDWP 协议应该已注册")
	}
	if HasProtocol("nonexistent") {
		t.Error("不存在的协议不应该被找到")
	}
}

// testProtocol 测试用协议实现
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