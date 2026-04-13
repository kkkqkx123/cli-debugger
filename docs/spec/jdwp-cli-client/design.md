# JDWP CLI 客户端设计文档

## Overview

本项目使用 **Go 语言**实现一个无状态的 JDWP CLI 客户端。客户端采用命令式操作模式，每次命令执行都是独立的、无状态的（连接→执行→断开），状态由目标 JVM 的 JDWP 服务端维护。

### 设计原则

- **无状态**: 每次命令执行都是独立的 TCP 连接，不保存会话状态
- **命令式**: 单条命令对应单次 JDWP 操作，同步返回结果
- **简洁性**: 最小化依赖，仅使用 Go 标准库
- **可扩展性**: 清晰的分层架构，便于后续添加新命令

### 技术栈

- **语言**: Go 1.21+
- **依赖**: 仅使用 Go 标准库（`net`, `encoding/binary`, `flag` 等）
- **构建**: Go 原生构建工具链 (`go build`)
- **目标平台**: Windows, macOS, Linux (通过 Go 交叉编译)

---

## Architecture

### 分层架构

```
┌─────────────────────────────────────────┐
│           CLI Layer (cmd)               │  ← 命令解析、参数验证、输出格式化
├─────────────────────────────────────────┤
│         Client Layer (client)           │  ← JDWP 会话管理、命令执行编排
├─────────────────────────────────────────┤
│       Protocol Layer (protocol)         │  ← JDWP 包编解码、握手协议
├─────────────────────────────────────────┤
│         Transport Layer (net)           │  ← TCP 连接管理
└─────────────────────────────────────────┘
```

### 目录结构

```
jdwp-cli/
├── cmd/
│   └── jdwp-cli/
│       └── main.go              # CLI 入口、命令注册
├── internal/
│   ├── protocol/
│   │   ├── packet.go            # JDWP 包定义与编解码
│   │   ├── types.go             # JDWP 数据类型定义
│   │   └── handshake.go         # JDWP 握手协议
│   ├── client/
│   │   ├── client.go            # JDWP 客户端核心
│   │   ├── vm.go                # VirtualMachine 命令集
│   │   ├── reference_type.go    # ReferenceType 命令集
│   │   ├── thread.go            # ThreadReference 命令集
│   │   ├── event.go             # EventRequest 命令集
│   │   └── stackframe.go        # StackFrame 命令集
│   └── cli/
│       ├── command.go           # 命令接口定义
│       ├── version.go           # version 命令实现
│       ├── threads.go           # threads 命令实现
│       ├── breakpoint.go        # breakpoint 命令实现
│       ├── execution.go         # cont/step/next 命令实现
│       └── inspect.go           # stack/locals 命令实现
├── go.mod
└── README.md
```

---

## Components and Interfaces

### 1. Protocol Layer (协议层)

#### 1.1 数据包定义 (`packet.go`)

```go
// CommandPacket: JDWP 命令包
// [4字节长度][4字节ID][1字节标志][1字节命令集][1字节命令][数据]
type CommandPacket struct {
    ID         uint32
    Flags      byte  // 0x00 = 命令包
    CommandSet byte
    Command    byte
    Data       []byte
}

// ReplyPacket: JDWP 应答包
// [4字节长度][4字节ID][1字节标志][2字节错误码][数据]
type ReplyPacket struct {
    ID        uint32
    Flags     byte  // 0x80 = 应答包
    ErrorCode uint16
    Data      []byte
}
```

#### 1.2 数据类型定义 (`types.go`)

```go
// JDWP ID 类型（大小由 VM.IDSizes 命令决定）
type (
    ObjectID       uint64
    ThreadID       uint64
    ReferenceTypeID uint64
    MethodID       uint64
    FieldID        uint64
    FrameID        uint64
    RequestID      uint32
    StringID       uint64
)

// JDWP 值类型
type Value struct {
    Tag   byte  // 值类型标记
    Value interface{}
}

// 位置信息
type Location struct {
    MethodID   MethodID
    CodeIndex  uint64
}

// 类信息
type ClassInfo struct {
    ReferenceTypeID ReferenceTypeID
    RefTypeTag      byte
    Signature       string
    Status          uint32
}
```

#### 1.3 握手协议 (`handshake.go`)

```go
// PerformHandshake 执行 JDWP 握手
// 1. 读取 VM 发送的 "JDWP-Handshake" (14字节)
// 2. 调试器回写相同的 "JDWP-Handshake" 字符串
func PerformHandshake(conn net.Conn) error
```

### 2. Client Layer (客户端层)

#### 2.1 客户端核心 (`client.go`)

```go
type Client struct {
    conn     net.Conn
    idSizes  *IDSizes
    packetID uint32
}

// NewClient 创建新客户端并执行握手
func NewClient(host string, port int) (*Client, error)

// Close 关闭连接
func (c *Client) Close() error

// sendCommand 发送 JDWP 命令并接收响应
func (c *Client) sendCommand(cmdSet byte, cmd byte, data []byte) ([]byte, error)

// GetIDSizes 获取各类 ID 的字节长度
func (c *Client) GetIDSizes() (*IDSizes, error)
```

#### 2.2 VirtualMachine 操作 (`vm.go`)

```go
// Version 获取 VM 版本信息
func (c *Client) Version() (*VersionInfo, error)

// AllThreads 获取所有线程
func (c *Client) AllThreads() ([]ThreadInfo, error)

// AllClasses 获取所有已加载类
func (c *Client) AllClasses() ([]ClassInfo, error)

// Suspend 挂起整个 VM
func (c *Client) Suspend() error

// Resume 恢复整个 VM
func (c *Client) Resume() error

// ClassesBySignature 按签名查找类
func (c *Client) ClassesBySignature(signature string) ([]ReferenceTypeID, error)
```

#### 2.3 ThreadReference 操作 (`thread.go`)

```go
// ThreadName 获取线程名称
func (c *Client) ThreadName(threadID ThreadID) (string, error)

// ThreadStatus 获取线程状态
func (c *Client) ThreadStatus(threadID ThreadID) (*ThreadStatus, error)

// ThreadFrames 获取线程栈帧
func (c *Client) ThreadFrames(threadID ThreadID, startFrame int, length int) ([]FrameInfo, error)

// ThreadFrameCount 获取栈帧总数
func (c *Client) ThreadFrameCount(threadID ThreadID) (int, error)
```

#### 2.4 EventRequest 操作 (`event.go`)

```go
// SetBreakpoint 设置行断点
// 参数: 类签名, 行号, 挂起策略
// 返回: 请求 ID
func (c *Client) SetBreakpoint(classSignature string, line int, suspendPolicy byte) (RequestID, error)

// SetMethodBreakpoint 设置方法断点
func (c *Client) SetMethodBreakpoint(classSignature string, methodName string, suspendPolicy byte) (RequestID, error)

// ClearBreakpoint 清除指定断点
func (c *Client) ClearBreakpoint(requestID RequestID) error

// ClearAllBreakpoints 清除所有断点
func (c *Client) ClearAllBreakpoints() error

// WaitForEvent 等待事件（用于 cont/step/next）
func (c *Client) WaitForEvent(timeout time.Duration) (*CompositeEvent, error)
```

#### 2.5 StackFrame 操作 (`stackframe.go`)

```go
// GetLocalVariables 获取栈帧局部变量
func (c *Client) GetLocalVariables(threadID ThreadID, frameID FrameID) ([]LocalVariable, error)
```

### 3. CLI Layer (命令行层)

#### 3.1 命令接口 (`command.go`)

```go
type Command interface {
    Name() string
    Description() string
    RegisterFlags(fs *flag.FlagSet)
    Execute(client *client.Client) error
}

// CommandRegistry 命令注册表
var CommandRegistry = make(map[string]Command)

func RegisterCommand(cmd Command)
```

#### 3.2 命令输出格式

```go
type OutputFormatter interface {
    Format(data interface{}) error
}

type TextFormatter struct{}
type JSONFormatter struct{}
```

---

## Data Models

### JDWP 命令包编码规则

```
[4字节长度][4字节ID][1字节标志][1字节命令集][1字节命令][数据]
- 长度: 大端序, 包含自身的总字节数
- ID: 大端序, 由调试器递增分配
- 标志: 0x00=命令包, 0x80=应答包
- 命令集: 1-127
- 命令: 1-255
```

### JDWP 应答包编码规则

```
[4字节长度][4字节ID][1字节标志][2字节错误码][数据]
- 错误码: 大端序, 0=成功
```

### IDSizes 结构

```go
type IDSizes struct {
    FieldIDSize         int
    MethodIDSize        int
    ObjectIDSize        int
    ReferenceTypeIDSize int
    FrameIDSize         int
}
```

### 值标签映射

```go
const (
    TagByte       byte = 66  // 'B'
    TagChar       byte = 67  // 'C'
    TagFloat      byte = 70  // 'F'
    TagDouble     byte = 68  // 'D'
    TagInt        byte = 73  // 'I'
    TagLong       byte = 74  // 'J'
    TagShort      byte = 83  // 'S'
    TagBoolean    byte = 90  // 'Z'
    TagVoid       byte = 86  // 'V'
    TagArray      byte = 91  // '['
    TagObject     byte = 108 // 'L'
    TagString     byte = 115 // 's'
    TagThread     byte = 116 // 't'
    TagThreadGroup byte = 103 // 'g'
    TagClassLoader byte = 108 // 'l'
)
```

---

## Error Handling

### 错误类型定义

```go
type JdwpError struct {
    ErrorCode uint16
    Message   string
}

func (e *JdwpError) Error() string

// 常见 JDWP 错误码
const (
    ErrNone             = 0
    ErrInvalidThread    = 101
    ErrInvalidObject    = 202
    ErrThreadNotSuspended = 503
    ErrVmDead           = 100
    ErrNotImplemented   = 99
)
```

### 错误处理策略

1. **连接错误**: 返回明确的连接失败信息，exit code = 2
2. **JDWP 协议错误**: 解析错误码并转换为可读信息，exit code = 3
3. **输入验证错误**: 参数校验失败时提前退出，exit code = 1
4. **超时处理**: 事件等待命令支持超时，超时后返回提示

### 退出码规范

| 退出码 | 含义                           |
| ------ | ------------------------------ |
| 0      | 成功                           |
| 1      | 一般错误（参数错误、输入错误） |
| 2      | 连接错误（无法连接、连接断开） |
| 3      | JDWP 协议错误（VM 返回错误码） |

---

## Key Design Decisions

### 1. 无状态设计

**决策**: 每次命令执行都重新建立 TCP 连接，执行完毕后立即断开。

**理由**:

- 简化客户端实现，不需要维护会话状态
- 支持脚本化使用，每条命令独立执行
- 避免连接泄漏和状态不一致问题
- 符合 CLI 工具的使用习惯

**权衡**:

- 频繁执行命令时连接开销较大
- 断点设置等操作需要在 VM 端维护状态

### 2. 仅使用标准库

**决策**: 不引入第三方 Go 依赖。

**理由**:

- 简化构建和分发，单一二进制文件
- 减少依赖漏洞风险
- JDWP 协议相对简单，标准库足够
- 跨平台编译更容易

### 3. 同步阻塞模型

**决策**: 使用同步阻塞 I/O 而非异步模型。

**理由**:

- CLI 工具天然是同步的（等待命令完成后退出）
- 简化实现逻辑，避免 goroutine 管理复杂性
- 事件等待命令天然需要阻塞等待

### 4. 命令式事件处理

**决策**: 执行控制命令（cont/step/next）通过等待事件来实现。

**实现**:

```
1. 发送执行命令（如 Resume）
2. 设置对应的事件过滤器（如单步完成事件）
3. 阻塞等待事件到达
4. 解析事件并返回结果
```

### 5. 平台特定操作处理

**决策**: 采取统一抽象+具体实现来处理平台特定操作（例如进程控制）。

**理由**:

- 保持架构的清晰性、对称性
- 出问题时方便独立调试
- 方便直接使用文件级的条件编译

**实现**:

```go
// 平台特定操作接口
type PlatformOps interface {
    FindJavaProcess() ([]ProcessInfo, error)
    KillProcess(pid int) error
    GetProcessEnv(pid int) (map[string]string, error)
}

// 各平台独立实现（使用构建标签）
// platform_unix.go  // +build linux darwin
// platform_windows.go  // +build windows
```

### 6. 高频操作的流式监控模式

**决策**: 对于需要高频查询的监控类操作（如线程状态、变量值监控），提供可选的流式监控模式，通过维持一个带超时的连接流来实现，同时保持无状态设计的默认行为。

**理由**:

- 避免频繁创建/销毁连接带来的性能开销
- 适合实时监控场景（如持续观察线程状态、变量变化）
- 通过超时机制保证连接不会永久挂起
- 保持默认无状态模式，流式监控为可选增强

**实现方案**:

```go
// 监控模式命令
type MonitorConfig struct {
    Interval time.Duration  // 查询间隔
    Timeout  time.Duration  // 总超时时间
    Command  string         // 要监控的命令
}

// 流式监控器
type StreamMonitor struct {
    client     *Client
    config     MonitorConfig
    done       chan struct{}
}

// Start 启动流式监控
func (m *StreamMonitor) Start(ctx context.Context) error {
    ticker := time.NewTicker(m.config.Interval)
    defer ticker.Stop()

    timeout := time.After(m.config.Timeout)

    for {
        select {
        case <-timeout:
            fmt.Println("监控超时，连接已关闭")
            return nil
        case <-ctx.Done():
            return nil
        case <-ticker.C:
            // 执行监控命令并输出结果
            result, err := m.executeCommand()
            if err != nil {
                fmt.Printf("执行失败: %v\n", err)
                continue
            }
            m.formatOutput(result)
        }
    }
}
```

**使用示例**:

```bash
# 普通模式（无状态，每次连接）
jdwp-cli threads --host 127.0.0.1 --port 8000

# 流式监控模式（维持连接，每2秒刷新，60秒超时）
jdwp-cli monitor threads --host 127.0.0.1 --port 8000 --interval 2s --timeout 60s

# 监控特定变量
jdwp-cli monitor locals --host 127.0.0.1 --port 8000 --thread 1 --frame 0 --interval 1s --timeout 30s
```

**设计权衡**:

- **默认模式**: 无状态，每次连接→执行→断开
- **监控模式**: 保持连接，定时查询，超时自动断开
- **状态管理**: 连接状态由流式监控器内部管理，对外仍表现为无状态命令
- **资源清理**: 超时或 Ctrl+C 时自动关闭连接

---

## Testing Strategy

### 1. 单元测试

- **协议编解码测试**: 验证 CommandPacket/ReplyPacket 的编码和解码正确性
- **数据类型测试**: 验证 JDWP 值类型的编码和解码
- **握手协议测试**: 模拟握手过程

### 2. 集成测试

- **真实 JVM 连接测试**: 使用测试 JVM 验证实际命令执行
- **断点设置与命中测试**: 验证断点能正确设置和触发
- **执行控制测试**: 验证 cont/step/next 命令的行为

### 3. 测试夹具

```go
// 启动测试 JVM
func setupTestJVM() (port int, cleanup func(), err error)

// 连接到测试 JVM
func setupTestClient() (*client.Client, func(), error)
```

### 4. 测试用例覆盖

- 正常路径：成功连接、执行命令、获取结果
- 错误路径：连接失败、无效参数、VM 返回错误
- 边界情况：空线程列表、无类加载、超时事件

---

## Implementation Notes

### Go 版本要求

Go 1.21+ （使用标准库即可）

### 构建命令

```bash
# 构建当前平台
go build -o jdwp-cli ./cmd/jdwp-cli

# 交叉编译
GOOS=linux GOARCH=amd64 go build -o jdwp-cli-linux ./cmd/jdwp-cli
GOOS=windows GOARCH=amd64 go build -o jdwp-cli.exe ./cmd/jdwp-cli
GOOS=darwin GOARCH=amd64 go build -o jdwp-cli-macos ./cmd/jdwp-cli
```

### 使用示例

```bash
# 查询版本
jdwp-cli version --host 127.0.0.1 --port 8000

# 列出线程
jdwp-cli threads --host 127.0.0.1 --port 8000

# 设置断点
jdwp-cli breakpoint add --host 127.0.0.1 --port 8000 --class com.example.Main --line 10

# 查看调用栈
jdwp-cli stack --host 127.0.0.1 --port 8000 --thread 1

# JSON 输出
jdwp-cli version --host 127.0.0.1 --port 8000 --json
```
