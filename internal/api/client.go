package api

import (
	"errors"
	"fmt"
	"sync"

	"github.com/spf13/viper"
)

var (
	// registry 插件注册表
	registry = make(map[string]PluginFactory)
	// registryMutex 保护注册表的互斥锁
	registryMutex sync.RWMutex
)

// RegisterPlugin 注册插件
func RegisterPlugin(name string, factory PluginFactory) error {
	if name == "" {
		return errors.New("插件名称不能为空")
	}
	if factory == nil {
		return errors.New("插件工厂函数不能为空")
	}

	registryMutex.Lock()
	defer registryMutex.Unlock()

	if _, exists := registry[name]; exists {
		return fmt.Errorf("插件 '%s' 已注册", name)
	}

	registry[name] = factory
	return nil
}

// CreateClient 创建调试客户端
func CreateClient(protocolName string) (DebugProtocol, error) {
	if protocolName == "" {
		// 尝试自动检测
		protocolName = AutoDetect()
		if protocolName == "" {
			return nil, errors.New("未指定协议且无法自动检测")
		}
	}

	registryMutex.RLock()
	factory, exists := registry[protocolName]
	registryMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("协议 '%s' 未注册", protocolName)
	}

	return factory(), nil
}

// AutoDetect 自动检测协议
func AutoDetect() string {
	// 从配置获取主机和端口
	host := viper.GetString("host")
	port := viper.GetInt("port")

	// 简单的端口检测策略
	// 5005 是 Java JDWP 常用端口
	if port == 5005 {
		return "jdwp"
	}

	// 未来可以添加更多检测逻辑：
	// 1. 连接到端口并尝试握手
	// 2. 检查进程名称
	// 3. 检查服务响应特征

	// 默认返回空字符串，表示无法检测
	return ""
}

// GetRegisteredProtocols 获取已注册的协议列表
func GetRegisteredProtocols() []string {
	registryMutex.RLock()
	defer registryMutex.RUnlock()

	protocols := make([]string, 0, len(registry))
	for name := range registry {
		protocols = append(protocols, name)
	}
	return protocols
}

// HasProtocol 检查协议是否已注册
func HasProtocol(protocolName string) bool {
	registryMutex.RLock()
	_, exists := registry[protocolName]
	registryMutex.RUnlock()
	return exists
}

// init 初始化默认插件
func init() {
	// 注册 JDWP 插件（将在后续实现）
	// 这里先注册一个空工厂，后续在 jdwp 包中实现
	RegisterPlugin("jdwp", func() DebugProtocol {
		// 返回一个占位实现，后续会被真正的 JDWP 插件替换
		return &placeholderProtocol{name: "jdwp"}
	})
}

// placeholderProtocol 占位协议实现
// 用于在 JDWP 插件实现前提供基本的协议支持
type placeholderProtocol struct {
	name string
}

func (p *placeholderProtocol) Connect(ctx context.Context) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) Close() error {
	return nil
}

func (p *placeholderProtocol) IsConnected() bool {
	return false
}

func (p *placeholderProtocol) Version(ctx context.Context) (*types.VersionInfo, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) Capabilities(ctx context.Context) (*types.Capabilities, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) GetThreads(ctx context.Context) ([]*types.ThreadInfo, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) GetThreadStack(ctx context.Context, threadID string) ([]*types.StackFrame, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) GetThreadState(ctx context.Context, threadID string) (string, error) {
	return "", errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) Suspend(ctx context.Context, threadID string) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) Resume(ctx context.Context, threadID string) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) StepInto(ctx context.Context, threadID string) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) StepOver(ctx context.Context, threadID string) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) StepOut(ctx context.Context, threadID string) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) SetBreakpoint(ctx context.Context, location string, condition string) (string, error) {
	return "", errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) RemoveBreakpoint(ctx context.Context, breakpointID string) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) ClearBreakpoints(ctx context.Context) error {
	return errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) GetBreakpoints(ctx context.Context) ([]*types.BreakpointInfo, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) GetFields(ctx context.Context, objectID string) ([]*types.Variable, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error) {
	return nil, errors.New("JDWP 插件尚未实现")
}

func (p *placeholderProtocol) ProtocolName() string {
	return p.name
}

func (p *placeholderProtocol) SupportedLanguages() []string {
	return []string{"java"}
}