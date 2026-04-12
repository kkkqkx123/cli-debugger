# JDWP CLI 客户端基础设施设计

## 1. 概述

本文档详细描述了支撑JDWP CLI客户端运行所需的基础设施组件。这些基础设施是实现需求文档中定义的功能和非功能需求的基础，确保客户端能够稳定、高效地与JDWP服务端通信，并提供良好的用户体验。

### 1.1 设计目标

- **可构建性**：支持跨平台构建，生成单一可执行文件
- **可测试性**：提供完善的测试基础设施，确保功能正确性
- **可维护性**：清晰的基础设施分层，便于后续维护和扩展
- **可部署性**：简化部署流程，支持多种分发方式
- **可观测性**：提供必要的调试和诊断能力

### 1.2 基础设施范围

本文档涵盖以下基础设施组件：

2. 测试基础设施
3. 错误处理与日志
4. 命令行参数解析
5. 输出格式化
6. 网络连接管理
7. 协议编解码
8. 命令注册与执行

---

## 3. 测试基础设施设计

### 3.1 测试层次

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                            测试层次结构                                       │
├───────────────────┬───────────────────┬───────────────────┬───────────────────┤
│   单元测试        │   集成测试        │   端到端测试     │   性能测试        │
│ (Protocol层)     │ (Client层)        │ (CLI层)         │ (关键路径)        │
└───────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

### 3.2 测试框架选择

- **单元测试**：Go标准库`testing`包
- **测试覆盖率**：Go内置`go test -cover`工具
- **测试模拟**：Go标准库`net/http/httptest`和自定义TCP模拟器
- **测试数据生成**：Go标准库`testing/quick`和自定义生成器

### 3.3 测试JVM环境

#### 3.3.1 测试JVM启动器

```go
// test/jvm.go - 测试JVM管理
package test

import (
    "context"
    "fmt"
    "os/exec"
    "time"
)

// StartTestJVM 启动测试用JVM
func StartTestJVM(ctx context.Context, port int) (cleanup func(), err error) {
    cmd := exec.CommandContext(ctx, "java",
        "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=" + fmt.Sprintf("%d", port),
        "-jar", "test-app.jar")

    if err := cmd.Start(); err != nil {
        return nil, err
    }

    // 等待JVM启动
    time.Sleep(2 * time.Second)

    cleanup = func() {
        cmd.Process.Kill()
    }

    return cleanup, nil
}
```

#### 3.3.2 测试JVM配置

- **测试应用**：使用简单的Java应用作为测试目标
- **测试端口**：动态分配端口，避免冲突
- **测试超时**：设置合理的测试超时时间
- **测试清理**：确保测试后JVM进程被正确终止

### 3.4 测试用例设计

#### 3.4.1 单元测试用例

- **协议编解码测试**：验证JDWP包的正确编解码
- **握手协议测试**：验证握手过程的正确性
- **错误处理测试**：验证各种错误场景的处理

#### 3.4.2 集成测试用例

- **连接测试**：验证与真实JVM的连接
- **命令执行测试**：验证各种JDWP命令的执行
- **断点测试**：验证断点设置和触发
- **执行控制测试**：验证挂起、恢复、单步执行等

#### 3.4.3 端到端测试用例

- **CLI命令测试**：验证所有CLI命令的正确执行
- **JSON输出测试**：验证JSON格式输出的正确性
- **错误场景测试**：验证各种错误场景的用户反馈

### 3.5 测试覆盖率目标

| 组件       | 最低覆盖率 | 目标覆盖率 |
| ---------- | ---------- | ---------- |
| Protocol层 | 85%        | 95%        |
| Client层   | 80%        | 90%        |
| CLI层      | 75%        | 85%        |
| 全局       | 80%        | 90%        |

---

## 6. 错误处理与日志基础设施

### 6.1 错误处理设计

#### 6.1.1 错误分类

```go
// ErrorType 表示错误类型
type ErrorType int

const (
    ConnectionError ErrorType = iota + 1
    ProtocolError
    CommandError
    InputError
    InternalError
)

// Error 包含详细的错误信息
type Error struct {
    Type    ErrorType
    Code    int
    Message string
    Cause   error
}
```

#### 6.1.2 错误处理策略

| 错误类型 | 处理方式   | 用户提示                | 退出码 |
| -------- | ---------- | ----------------------- | ------ |
| 连接错误 | 重试或终止 | "无法连接到JVM: [详情]" | 2      |
| 协议错误 | 终止       | "JDWP协议错误: [详情]"  | 3      |
| 命令错误 | 终止       | "命令执行失败: [详情]"  | 3      |
| 输入错误 | 终止       | "参数错误: [详情]"      | 1      |
| 内部错误 | 终止       | "内部错误: [详情]"      | 1      |

#### 6.1.3 错误格式化

```go
func (e *Error) Error() string {
    if e.Cause != nil {
        return fmt.Sprintf("%s: %s (cause: %v)", e.Type, e.Message, e.Cause)
    }
    return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// FormatError 格式化错误输出
func FormatError(err error, isJSON bool) {
    if isJSON {
        // JSON格式输出
        jsonErr := map[string]interface{}{
            "error": map[string]interface{}{
                "type":    errType(err),
                "code":    errCode(err),
                "message": err.Error(),
            },
        }
        jsonBytes, _ := json.Marshal(jsonErr)
        fmt.Fprintln(os.Stderr, string(jsonBytes))
    } else {
        // 文本格式输出
        fmt.Fprintf(os.Stderr, "错误: %s\n", err.Error())
    }
}
```

### 6.2 日志基础设施

#### 6.2.1 日志级别

| 级别  | 用途                 | 生产环境 | 开发环境 |
| ----- | -------------------- | -------- | -------- |
| Fatal | 致命错误，程序将退出 | 启用     | 启用     |
| Error | 错误，但程序可继续   | 启用     | 启用     |
| Warn  | 潜在问题             | 禁用     | 启用     |
| Info  | 重要操作信息         | 禁用     | 启用     |
| Debug | 调试信息             | 禁用     | 启用     |
| Trace | 详细跟踪信息         | 禁用     | 禁用     |

#### 6.2.2 日志实现

```go
// Logger 日志接口
type Logger interface {
    Fatal(v ...interface{})
    Error(v ...interface{})
    Warn(v ...interface{})
    Info(v ...interface{})
    Debug(v ...interface{})
    Trace(v ...interface{})
}

// CLILogger CLI专用日志实现
type CLILogger struct {
    level  LogLevel
    writer io.Writer
}

func (l *CLILogger) Error(v ...interface{}) {
    if l.level >= ErrorLevel {
        l.write("ERROR", v...)
    }
}

// 其他方法实现...

// NewLogger 创建新日志器
func NewLogger(level LogLevel, writer io.Writer) Logger {
    return &CLILogger{level: level, writer: writer}
}
```

#### 6.2.3 调试模式

- **启用方式**：`--debug`命令行参数
- **效果**：
  - 启用Debug和Trace日志
  - 显示详细的协议交互
  - 保留临时文件用于诊断
- **输出**：日志输出到stderr，不影响正常输出

---

## 7. 命令行参数解析基础设施

### 7.1 参数解析设计

#### 7.1.1 核心参数

| 参数        | 类型     | 必需 | 描述             |
| ----------- | -------- | ---- | ---------------- |
| `--host`    | string   | 是   | 目标JVM主机地址  |
| `--port`    | int      | 是   | 目标JVM JDWP端口 |
| `--json`    | bool     | 否   | JSON格式输出     |
| `--debug`   | bool     | 否   | 启用调试模式     |
| `--timeout` | duration | 否   | 操作超时时间     |

#### 7.1.2 参数解析流程

```
┌───────────────────┐
│  命令行参数解析   │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  全局参数处理     │
│  - host           │
│  - port           │
│  - json           │
│  - debug          │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  命令参数处理     │
│  - 特定命令参数   │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  参数验证         │
│  - 必填参数检查   │
│  - 参数值验证     │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  参数传递给命令   │
└───────────────────┘
```

### 7.2 参数解析实现

```go
// GlobalFlags 全局命令行参数
type GlobalFlags struct {
    Host    string
    Port    int
    JSON    bool
    Debug   bool
    Timeout time.Duration
}

// ParseGlobalFlags 解析全局参数
func ParseGlobalFlags() (*GlobalFlags, error) {
    flags := &GlobalFlags{
        Timeout: 30 * time.Second, // 默认超时
    }

    flag.StringVar(&flags.Host, "host", "", "目标JVM主机地址")
    flag.IntVar(&flags.Port, "port", 0, "目标JVM JDWP端口")
    flag.BoolVar(&flags.JSON, "json", false, "JSON格式输出")
    flag.BoolVar(&flags.Debug, "debug", false, "启用调试模式")

    // 自定义超时解析
    timeoutStr := flag.String("timeout", "30s", "操作超时时间")

    flag.Parse()

    // 验证必填参数
    if flags.Host == "" || flags.Port == 0 {
        return nil, errors.New("必须指定--host和--port参数")
    }

    // 解析超时
    timeout, err := time.ParseDuration(*timeoutStr)
    if err != nil {
        return nil, fmt.Errorf("无效的超时值: %v", err)
    }
    flags.Timeout = timeout

    return flags, nil
}
```

### 7.3 命令参数注册

```go
// Command 接口定义
type Command interface {
    Name() string
    Description() string
    RegisterFlags(*flag.FlagSet)
    Execute(*client.Client, *GlobalFlags) error
}

// VersionCommand version命令实现
type VersionCommand struct{}

func (c *VersionCommand) Name() string {
    return "version"
}

func (c *VersionCommand) Description() string {
    return "显示JVM版本信息"
}

func (c *VersionCommand) RegisterFlags(fs *flag.FlagSet) {
    // version命令无特定参数
}

func (c *VersionCommand) Execute(client *client.Client, global *GlobalFlags) error {
    version, err := client.Version()
    if err != nil {
        return err
    }

    if global.JSON {
        return json.NewEncoder(os.Stdout).Encode(version)
    }

    fmt.Printf("JDWP版本: %s\n", version.JdwpVersion)
    fmt.Printf("JVM版本: %s\n", version.JvmVersion)
    fmt.Printf("JVM名称: %s\n", version.JvmName)
    return nil
}
```

---

## 8. 输出格式化基础设施

### 8.1 输出格式设计

#### 8.1.1 格式类型

| 格式 | 用途     | 适用场景               |
| ---- | -------- | ---------------------- |
| 文本 | 人类可读 | 默认输出，交互式使用   |
| JSON | 机器可读 | 脚本集成，自动化处理   |
| CSV  | 表格数据 | 数据导出，电子表格处理 |

#### 8.1.2 格式化策略

- **默认格式**：文本格式，简洁易读
- **JSON格式**：完整数据结构，保留所有信息
- **错误输出**：始终使用文本格式，输出到stderr

### 8.2 输出格式化实现

```go
// OutputFormatter 输出格式化接口
type OutputFormatter interface {
    Format(data interface{}) error
    SetWriter(writer io.Writer)
}

// TextFormatter 文本格式化器
type TextFormatter struct {
    writer io.Writer
}

func (f *TextFormatter) SetWriter(writer io.Writer) {
    f.writer = writer
}

func (f *TextFormatter) Format(data interface{}) error {
    switch v := data.(type) {
    case *client.VersionInfo:
        return f.formatVersion(v)
    case []*client.ThreadInfo:
        return f.formatThreads(v)
    // 其他类型...
    default:
        return fmt.Errorf("不支持的输出类型: %T", data)
    }
}

// JSONFormatter JSON格式化器
type JSONFormatter struct {
    writer io.Writer
}

func (f *JSONFormatter) SetWriter(writer io.Writer) {
    f.writer = writer
}

func (f *JSONFormatter) Format(data interface{}) error {
    encoder := json.NewEncoder(f.writer)
    encoder.SetIndent("", "  ")
    return encoder.Encode(data)
}
```

### 8.3 格式化示例

#### 8.3.1 文本格式输出

```
JDWP版本: 1.8
JVM版本: 17.0.8+7-LTS
JVM名称: OpenJDK 64-Bit Server VM
```

#### 8.3.2 JSON格式输出

```json
{
  "jdwpVersion": "1.8",
  "jvmVersion": "17.0.8+7-LTS",
  "jvmName": "OpenJDK 64-Bit Server VM"
}
```

---

## 9. 网络连接管理基础设施

### 9.1 连接管理设计

#### 9.1.1 连接生命周期

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  连接创建   │   │  握手协议   │   │  命令执行   │   │  连接关闭   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
       │                │                │                │
       ▼                ▼                ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  TCP连接    │   │  交换       │   │  发送命令   │   │  关闭TCP    │
│  建立       │   │  JDWP-     │   │  包         │   │  连接       │
└─────────────┘   │  Handshake  │   │  接收响应   │   └─────────────┘
                  └─────────────┘   └─────────────┘
```

#### 9.1.2 连接参数

| 参数             | 默认值 | 描述               |
| ---------------- | ------ | ------------------ |
| DialTimeout      | 5s     | 建立TCP连接超时    |
| HandshakeTimeout | 5s     | 握手协议超时       |
| ReadTimeout      | 30s    | 读取数据超时       |
| WriteTimeout     | 30s    | 写入数据超时       |
| KeepAlive        | 30s    | TCP Keep-Alive间隔 |

### 9.2 连接管理实现

```go
// ConnectionConfig 连接配置
type ConnectionConfig struct {
    DialTimeout     time.Duration
    HandshakeTimeout time.Duration
    ReadTimeout     time.Duration
    WriteTimeout    time.Duration
    KeepAlive       time.Duration
}

// DefaultConnectionConfig 默认配置
var DefaultConnectionConfig = ConnectionConfig{
    DialTimeout:     5 * time.Second,
    HandshakeTimeout: 5 * time.Second,
    ReadTimeout:     30 * time.Second,
    WriteTimeout:    30 * time.Second,
    KeepAlive:       30 * time.Second,
}

// Connection 网络连接封装
type Connection struct {
    conn   net.Conn
    config ConnectionConfig
    logger Logger
}

// NewConnection 创建新连接
func NewConnection(host string, port int, config ConnectionConfig, logger Logger) (*Connection, error) {
    // 设置默认配置
    if config.DialTimeout == 0 {
        config = DefaultConnectionConfig
    }

    // 建立TCP连接
    conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), config.DialTimeout)
    if err != nil {
        return nil, &ConnectionError{Op: "dial", Err: err}
    }

    // 设置超时
    if err := conn.SetDeadline(time.Now().Add(config.HandshakeTimeout)); err != nil {
        conn.Close()
        return nil, err
    }

    // 执行握手
    if err := PerformHandshake(conn); err != nil {
        conn.Close()
        return nil, err
    }

    // 重置超时
    conn.SetDeadline(time.Time{})

    return &Connection{
        conn:   conn,
        config: config,
        logger: logger,
    }, nil
}

// Read 读取数据
func (c *Connection) Read(b []byte) (int, error) {
    if c.config.ReadTimeout > 0 {
        if err := c.conn.SetReadDeadline(time.Now().Add(c.config.ReadTimeout)); err != nil {
            return 0, err
        }
    }
    return c.conn.Read(b)
}

// Write 写入数据
func (c *Connection) Write(b []byte) (int, error) {
    if c.config.WriteTimeout > 0 {
        if err := c.conn.SetWriteDeadline(time.Now().Add(c.config.WriteTimeout)); err != nil {
            return 0, err
        }
    }
    return c.conn.Write(b)
}
```

### 9.3 连接池设计（可选）

虽然需求文档要求无状态设计，但为支持监控模式，可实现简单的连接池：

```go
// ConnectionPool 连接池
type ConnectionPool struct {
    host        string
    port        int
    config      ConnectionConfig
    logger      Logger
    connections chan *Connection
    mu          sync.Mutex
    closed      bool
}

// Get 获取连接
func (p *ConnectionPool) Get() (*Connection, error) {
    select {
    case conn := <-p.connections:
        return conn, nil
    default:
        return NewConnection(p.host, p.port, p.config, p.logger)
    }
}

// Put 归还连接
func (p *ConnectionPool) Put(conn *Connection) {
    p.mu.Lock()
    defer p.mu.Unlock()

    if p.closed {
        conn.Close()
        return
    }

    select {
    case p.connections <- conn:
    default:
        conn.Close()
    }
}
```

---

## 10. 协议编解码基础设施

### 10.1 协议编解码设计

#### 10.1.1 数据包结构

```
┌───────────┬───────────┬───────────┬────────────┬────────────┬──────────┐
│ 长度(4B)  │ ID(4B)    │ 标志(1B)  │ 命令集(1B) │ 命令(1B)   │ 数据     │
└───────────┴───────────┴───────────┴────────────┴────────────┴──────────┘
```

#### 10.1.2 编解码流程

```
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  命令数据         │      │  编码为字节流     │      │  发送网络包       │
│  (Go结构)         │─────▶│  (Protocol层)     │─────▶│  (Connection层)   │
└───────────────────┘      └─────────┬─────────┘      └───────────────────┘
                                   ▼
┌───────────────────┐      ┌─────────┴─────────┐      ┌───────────────────┐
│  接收网络包       │      │  解码为Go结构    │      │  处理响应         │
│  (Connection层)   │─────▶│  (Protocol层)     │─────▶│  (Client层)       │
└───────────────────┘      └───────────────────┘      └───────────────────┘
```

### 10.2 协议编解码实现

#### 10.2.1 基础编解码

```go
// EncodeCommand 编码命令包
func EncodeCommand(id uint32, cmdSet byte, cmd byte, data []byte) ([]byte, error) {
    // 计算总长度: 11字节头部 + 数据长度
    length := 11 + len(data)

    // 创建缓冲区
    buf := make([]byte, length)

    // 写入长度 (大端序)
    binary.BigEndian.PutUint32(buf[0:4], uint32(length))

    // 写入ID (大端序)
    binary.BigEndian.PutUint32(buf[4:8], id)

    // 写入标志 (0x00 = 命令包)
    buf[8] = 0x00

    // 写入命令集和命令
    buf[9] = cmdSet
    buf[10] = cmd

    // 写入数据
    copy(buf[11:], data)

    return buf, nil
}

// DecodeReply 解码应答包
func DecodeReply(data []byte) (*ReplyPacket, error) {
    if len(data) < 11 {
        return nil, errors.New("数据包太短")
    }

    // 读取长度
    length := binary.BigEndian.Uint32(data[0:4])
    if int(length) != len(data) {
        return nil, errors.New("长度不匹配")
    }

    // 读取ID
    id := binary.BigEndian.Uint32(data[4:8])

    // 检查标志 (0x80 = 应答包)
    if data[8] != 0x80 {
        return nil, errors.New("无效的应答包标志")
    }

    // 读取错误码
    errorCode := binary.BigEndian.Uint16(data[9:11])

    // 读取数据
    packetData := data[11:]

    return &ReplyPacket{
        ID:        id,
        Flags:     0x80,
        ErrorCode: errorCode,
        Data:      packetData,
    }, nil
}
```

#### 10.2.2 类型编解码

```go
// EncodeString 编码字符串
func EncodeString(s string) []byte {
    // 字符串长度 (大端序)
    lenBuf := make([]byte, 4)
    binary.BigEndian.PutUint32(lenBuf, uint32(len(s)))

    // 拼接长度和字符串数据
    return append(lenBuf, []byte(s)...)
}

// DecodeString 解码字符串
func DecodeString(data []byte) (string, []byte, error) {
    if len(data) < 4 {
        return "", nil, errors.New("字符串数据太短")
    }

    // 读取长度
    length := binary.BigEndian.Uint32(data[0:4])

    // 检查剩余数据长度
    if uint32(len(data)) < 4+length {
        return "", nil, errors.New("数据不足")
    }

    // 读取字符串
    s := string(data[4 : 4+length])

    // 返回剩余数据
    return s, data[4+length:], nil
}

// EncodeObjectID 编码ObjectID
func EncodeObjectID(id ObjectID, size int) []byte {
    buf := make([]byte, size)
    switch size {
    case 4:
        binary.BigEndian.PutUint32(buf, uint32(id))
    case 8:
        binary.BigEndian.PutUint64(buf, uint64(id))
    default:
        panic("无效的ObjectID大小")
    }
    return buf
}

// DecodeObjectID 解码ObjectID
func DecodeObjectID(data []byte, size int) (ObjectID, []byte, error) {
```
