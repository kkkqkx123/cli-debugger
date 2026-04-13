# JDWP CLI 客户端实现计划

本计划将功能实现分解为可独立执行的编码任务，采用测试驱动的开发方式，逐步构建并集成各个模块。

---

## 1. 项目初始化与协议层基础

### 1.1 初始化 Go 项目结构

- 创建 `go.mod` 文件，定义模块名为 `jdwp-cli`
- 创建目录结构：`cmd/jdwp-cli/`, `internal/protocol/`, `internal/client/`, `internal/cli/`
- 创建空的 `main.go` 入口文件，仅输出 "JDWP CLI Client"
- 验证 `go build` 能成功编译
- 参考: Design Document - Architecture 章节

### 1.2 实现 JDWP 数据类型定义

- 创建 `internal/protocol/types.go`
- 定义 JDWP ID 类型：`ObjectID`, `ThreadID`, `ReferenceTypeID`, `MethodID`, `FieldID`, `FrameID`, `RequestID`, `StringID`（均为 uint64）
- 定义值标签常量：`TagByte`, `TagChar`, `TagInt`, `TagObject` 等
- 定义 `Location`, `ClassInfo`, `Value` 等结构体
- 编写单元测试验证类型定义和常量值
- 参考: Design Document - Data Models 章节

### 1.3 实现 JDWP 包编解码

- 创建 `internal/protocol/packet.go`
- 实现 `CommandPacket` 结构体及其 `Encode()` 方法
  - 格式：[4字节长度][4字节ID][1字节标志][1字节命令集][1字节命令][数据]
  - 使用大端序编码
- 实现 `ReplyPacket` 结构体及其 `Decode()` 方法
  - 格式：[4字节长度][4字节ID][1字节标志][2字节错误码][数据]
- 实现 JDWP 错误码常量定义（`ErrNone`, `ErrInvalidThread`, `ErrVmDead` 等）
- 创建 `internal/protocol/packet_test.go`
- 编写测试用例：
  - 测试 CommandPacket 编码后的字节序列正确性
  - 测试 ReplyPacket 解码后的字段正确性
  - 测试错误码非零时返回错误
- 参考: Design Document - Data Models 章节, Requirements 1.2, 1.3, 1.4

### 1.4 实现 JDWP 握手协议

- 创建 `internal/protocol/handshake.go`
- 实现 `PerformHandshake(conn net.Conn) error` 函数
  - 读取 VM 发送的 "JDWP-Handshake" (14字节)
  - 验证读取的字符串是否为 "JDWP-Handshake"
  - 回写相同的 "JDWP-Handshake" 字符串
- 创建 `internal/protocol/handshake_test.go`
- 编写测试用例：
  - 使用 `net.Pipe()` 模拟握手过程
  - 测试正常握手成功场景
  - 测试 VM 发送错误字符串时的失败场景
- 参考: Design Document - Protocol Layer 章节, Requirements 1.1

---

## 2. 客户端核心与基础命令

### 2.1 实现 JDWP 客户端核心

- 创建 `internal/client/client.go`
- 定义 `Client` 结构体：包含 `conn`, `idSizes`, `packetID` 字段
- 实现 `NewClient(host string, port int) (*Client, error)` 函数
  - 建立 TCP 连接到指定 host:port
  - 执行握手协议
  - 获取 IDSizes（调用 VirtualMachine/7 命令）
- 实现 `Close() error` 方法关闭连接
- 实现 `sendCommand(cmdSet byte, cmd byte, data []byte) ([]byte, error)` 私有方法
  - 递增 packetID
  - 编码 CommandPacket 并发送
  - 接收并解码 ReplyPacket
  - 检查错误码，非零时返回 `JdwpError`
- 实现 `GetIDSizes() (*IDSizes, error)` 方法解析 IDSizes 响应
- 创建 `internal/client/client_test.go`
- 编写测试用例：
  - 测试 NewClient 连接失败时返回错误
  - 测试 sendCommand 发送命令并接收成功响应
  - 测试 sendCommand 接收错误码时返回 JdwpError
- 参考: Design Document - Client Layer 章节, Requirements 1.5, 1.6

### 2.2 定义 CLI 命令接口与注册表

- 创建 `internal/cli/command.go`
- 定义 `Command` 接口：
  ```go
  type Command interface {
      Name() string
      Description() string
      RegisterFlags(fs *flag.FlagSet)
      Execute(client *client.Client) error
  }
  ```
- 实现 `CommandRegistry` 全局变量（`map[string]Command`）
- 实现 `RegisterCommand(cmd Command)` 函数
- 实现 `ExecuteCommand(name string, args []string) error` 函数
  - 查找命令
  - 解析参数
  - 创建 Client 并执行命令
- 参考: Design Document - CLI Layer 章节, Requirements 2.1, 2.2

### 2.3 实现 CLI 入口与命令路由

- 创建 `cmd/jdwp-cli/main.go`
- 实现主函数：
  - 检查命令行参数
  - 第一个参数为命令名
  - 剩余参数传递给命令处理
  - 调用 `cli.ExecuteCommand()`
  - 根据错误类型设置退出码（0/1/2/3）
- 实现 `--help` 标志：列出所有已注册命令及其描述
- 参考: Requirements 2.3, 2.4, 2.5

### 2.4 实现 version 命令

- 创建 `internal/cli/version.go`
- 实现 `VersionCommand` 结构体，包含 `--host`, `--port`, `--json` 标志
- 在 `internal/client/vm.go` 实现 `Version() (*VersionInfo, error)` 方法
  - 发送 VirtualMachine/1 命令（cmdSet=1, cmd=1）
  - 解析响应：jdwpMajor, jdwpMinor, vmVersion, vmName
- 在 `VersionCommand.Execute()` 中调用 `client.Version()` 并格式化输出
- 注册 version 命令
- 手动测试：
  - 启动测试 JVM（`java -agentlib:jdwp=...`）
  - 运行 `jdwp-cli version --host 127.0.0.1 --port 8000`
  - 验证输出包含 JDWP 版本、JVM 版本、JVM 名称
- 参考: Requirements 3.1

### 2.5 实现输出格式化器

- 创建 `internal/cli/output.go`
- 定义 `OutputFormatter` 接口：`Format(data interface{}) error`
- 实现 `TextFormatter`：输出人类可读的文本
- 实现 `JSONFormatter`：输出 JSON 格式
- 修改 `VersionCommand` 使用输出格式化器
- 测试 `--json` 标志输出 JSON 格式
- 参考: Requirements 2.6, 10.2, 10.3, 10.5

---

## 3. 虚拟机信息查询命令

### 3.1 实现 threads 命令

- 创建 `internal/cli/threads.go`
- 在 `internal/client/vm.go` 实现 `AllThreads() ([]ThreadInfo, error)` 方法
  - 发送 VirtualMachine/4 命令（cmdSet=1, cmd=4）
  - 解析线程 ID 列表
- 在 `internal/client/thread.go` 实现 `ThreadName(threadID ThreadID) (string, error)` 方法
  - 发送 ThreadReference/1 命令（cmdSet=11, cmd=1）
- 在 `internal/client/thread.go` 实现 `ThreadStatus(threadID ThreadID) (*ThreadStatus, error)` 方法
  - 发送 ThreadReference/4 命令（cmdSet=11, cmd=4）
- 创建 `internal/cli/threads.go` 实现 `ThreadsCommand`
  - 获取所有线程
  - 获取每个线程的名称和状态
  - 使用输出格式化器打印
- 注册 threads 命令
- 手动测试验证线程列表输出
- 参考: Requirements 3.2

### 3.2 实现 classes 命令

- 在 `internal/client/vm.go` 实现 `AllClasses() ([]ClassInfo, error)` 方法
  - 发送 VirtualMachine/3 命令（cmdSet=1, cmd=3）
  - 解析类信息：referenceTypeID, refTypeTag, signature, status
- 在 `internal/client/vm.go` 实现 `ClassesBySignature(signature string) ([]ReferenceTypeID, error)` 方法
  - 发送 VirtualMachine/2 命令（cmdSet=1, cmd=2）
- 创建 `internal/cli/classes.go` 实现 `ClassesCommand`
  - 支持 `--name` 标志进行模糊搜索
  - 获取所有类并过滤匹配项
  - 输出类签名和状态
- 注册 classes 命令
- 手动测试验证类搜索功能
- 参考: Requirements 3.3

### 3.3 实现 capabilities 命令

- 在 `internal/client/vm.go` 实现 `Capabilities() (*Capabilities, error)` 方法
  - 发送 VirtualMachine/12 命令（cmdSet=1, cmd=12）
  - 解析能力标志位（是否可以重新定义类、是否支持字段监控等）
- 创建 `internal/cli/capabilities.go` 实现 `CapabilitiesCommand`
  - 输出各项能力的开启/关闭状态
- 注册 capabilities 命令
- 参考: Requirements 3.4

### 3.4 实现 classpath 命令

- 在 `internal/client/vm.go` 实现 `ClassPaths() (*ClassPaths, error)` 方法
  - 发送 VirtualMachine/13 命令（cmdSet=1, cmd=13）
  - 解析 classpath 和 bootclasspath 字符串
- 创建 `internal/cli/classpath.go` 实现 `ClassPathCommand`
  - 输出类路径信息
- 注册 classpath 命令
- 参考: Requirements 3.5

---

## 4. 断点管理功能

### 4.1 实现断点设置核心逻辑

- 创建 `internal/client/event.go`
- 实现 `SetBreakpoint(classSignature string, line int, suspendPolicy byte) (RequestID, error)` 方法
  - 步骤 1: 调用 `ClassesBySignature()` 获取类的 referenceTypeID
  - 步骤 2: 获取类的源文件（ReferenceType/7）
  - 步骤 3: 获取方法列表（ReferenceType/5）
  - 步骤 4: 查找包含指定行号的方法（Method/1 获取 LineTable）
  - 步骤 5: 发送 EventRequest/Set 命令（cmdSet=15, cmd=1）
    - eventKind: BREAKPOINT (1)
    - suspendPolicy: 根据参数
    - 过滤器：LocationOnly（指定类和方法）
  - 返回 requestID
- 创建 `internal/client/event_test.go`
- 编写测试用例（使用 mock 连接）：
  - 测试 SetBreakpoint 成功时返回 requestID
  - 测试类不存在时返回错误
- 参考: Requirements 4.1, 4.5, 4.6

### 4.2 实现 breakpoint add 命令

- 创建 `internal/cli/breakpoint.go`
- 实现 `BreakpointAddCommand` 结构体
  - 支持 `--class` 标志指定类名
  - 支持 `--line` 标志指定行号
  - 支持 `--method` 标志指定方法名
  - 支持 `--suspend` 标志指定挂起策略（all/thread/none）
- 在 `Execute()` 中调用 `client.SetBreakpoint()` 并输出断点 ID
- 注册 `breakpoint add` 子命令
- 手动测试：
  - 设置行断点并验证返回 ID
  - 设置方法断点并验证返回 ID
  - 测试不存在的类返回错误
- 参考: Requirements 4.1, 4.2, 4.5

### 4.3 实现断点清除功能

- 在 `internal/client/event.go` 实现 `ClearBreakpoint(requestID RequestID) error` 方法
  - 发送 EventRequest/Clear 命令（cmdSet=15, cmd=2）
- 在 `internal/client/event.go` 实现 `ClearAllBreakpoints() error` 方法
  - 发送 EventRequest/ClearAllBreakpoints 命令（cmdSet=15, cmd=3）
- 创建 `internal/cli/breakpoint.go` 中的 `BreakpointRemoveCommand` 和 `BreakpointClearCommand`
- 注册 `breakpoint remove` 和 `breakpoint clear` 子命令
- 手动测试验证断点清除功能
- 参考: Requirements 4.3, 4.4

---

## 5. 执行控制功能

### 5.1 实现 suspend/resume 命令

- 在 `internal/client/vm.go` 实现 `Suspend() error` 方法
  - 发送 VirtualMachine/8 命令（cmdSet=1, cmd=8）
- 在 `internal/client/vm.go` 实现 `Resume() error` 方法
  - 发送 VirtualMachine/9 命令（cmdSet=1, cmd=9）
- 创建 `internal/cli/execution.go` 实现 `SuspendCommand` 和 `ResumeCommand`
- 注册 suspend 和 resume 命令
- 手动测试验证 VM 挂起和恢复
- 参考: Requirements 5.1, 5.2

### 5.2 实现事件等待机制

- 在 `internal/client/event.go` 实现 `WaitForEvent(timeout time.Duration) (*CompositeEvent, error)` 方法
  - 设置 socket 读取超时
  - 等待 Event/Composite 事件（cmdSet=64）
  - 解析事件集合
  - 超时返回错误
- 定义 `CompositeEvent` 结构体包含事件类型、线程 ID、位置等信息
- 创建 `internal/client/event_test.go` 添加测试：
  - 测试接收事件成功
  - 测试超时时返回错误
- 参考: Requirements 5.7, 5.8, 8.1, 8.2, 8.3

### 5.3 实现 cont 命令

- 创建 `internal/cli/execution.go` 实现 `ContCommand`
- 实现逻辑：
  - 调用 `client.Resume()` 恢复执行
  - 等待断点命中事件或其他挂起事件
  - 事件到达后解析事件信息并输出
  - 超时输出提示信息
- 手动测试：
  - 设置断点后启动程序
  - 执行 cont 命令等待断点命中
  - 验证输出包含断点位置和线程信息
- 参考: Requirements 5.3

### 5.4 实现 step/next/finish 命令

- 在 `internal/client/event.go` 实现单步执行相关方法：
  - `StepInto(threadID ThreadID) error`
    - 发送 EventRequest/Set 设置 STEP 事件（eventKind=STEP）
    - 过滤器：ThreadOnly（指定线程）
    - 深度：STEP_INTO
  - `StepOver(threadID ThreadID) error`
    - 类似，深度：STEP_OVER
  - `StepOut(threadID ThreadID) error`
    - 深度：STEP_OUT
- 在 `internal/client/event.go` 实现 `WaitForStepEvent(timeout time.Duration) (*StepEvent, error)` 方法
- 创建 `internal/cli/execution.go` 实现 `StepCommand`, `NextCommand`, `FinishCommand`
  - 支持 `--thread` 标志指定线程
  - 发送单步命令后等待事件完成
  - 输出新位置信息
- 手动测试验证单步执行功能
- 参考: Requirements 5.4, 5.5, 5.6

---

## 6. 栈帧与变量查看

### 6.1 实现栈帧查看功能

- 在 `internal/client/thread.go` 实现 `ThreadFrameCount(threadID ThreadID) (int, error)` 方法
  - 发送 ThreadReference/7 命令（cmdSet=11, cmd=7）
- 在 `internal/client/thread.go` 实现 `ThreadFrames(threadID ThreadID, startFrame int, length int) ([]FrameInfo, error)` 方法
  - 发送 ThreadReference/6 命令（cmdSet=11, cmd=6）
  - 解析栈帧信息：frameID, location（classID, methodID, codeIndex）
- 创建 `internal/cli/inspect.go` 实现 `StackCommand`
  - 支持 `--thread` 标志（必填）
  - 获取线程的栈帧列表
  - 获取每个栈帧的位置信息（类名、方法名、行号）
  - 输出调用栈
- 手动测试验证调用栈输出
- 参考: Requirements 6.1, 6.2, 6.6

### 6.2 实现局部变量查看功能

- 在 `internal/client/stackframe.go` 实现 `GetLocalVariables(threadID ThreadID, frameID FrameID) ([]LocalVariable, error)` 方法
  - 步骤 1: 获取方法的 VariableTable（Method/2）
  - 步骤 2: 发送 StackFrame/GetValues 命令（cmdSet=16, cmd=1）
  - 解析变量名、槽位、签名和值
- 创建 `internal/cli/inspect.go` 实现 `LocalsCommand`
  - 支持 `--thread` 和 `--frame` 标志（必填）
  - 获取指定栈帧的局部变量
  - 输出变量名、类型和值
- 手动测试验证局部变量输出
- 参考: Requirements 6.3, 6.4, 6.5

### 6.3 实现字段值查看功能

- 在 `internal/client/reference_type.go` 实现 `GetFields(refTypeID ReferenceTypeID) ([]FieldInfo, error)` 方法
  - 发送 ReferenceType/4 命令（cmdSet=2, cmd=4）
- 在 `internal/client/reference_type.go` 实现 `GetStaticValues(refTypeID ReferenceTypeID, fieldIDs []FieldID) ([]Value, error)` 方法
  - 发送 ReferenceType/6 命令（cmdSet=2, cmd=6）
- 在 `internal/client/object.go` 实现 `GetInstanceValues(objectID ObjectID, fieldIDs []FieldID) ([]Value, error)` 方法
  - 发送 ObjectReference/2 命令（cmdSet=9, cmd=2）
- 创建 `internal/cli/field.go` 实现 `FieldListCommand` 和 `FieldGetCommand`
  - `field list`：列出类的所有字段
  - `field get`：获取静态字段或实例字段的值
- 手动测试验证字段值输出
- 参考: Requirements 7.1, 7.2, 7.3, 7.4

---

## 7. 流式监控模式

### 7.1 实现流式监控器核心

- 创建 `internal/client/monitor.go`
- 定义 `MonitorConfig` 结构体：`Interval`, `Timeout`, `Command`
- 定义 `StreamMonitor` 结构体：包含 `client`, `config`, `done` 字段
- 实现 `NewStreamMonitor(client *Client, config MonitorConfig) *StreamMonitor` 构造函数
- 实现 `Start(ctx context.Context) error` 方法
  - 创建定时器按间隔触发
  - 每次触发执行监控命令并输出结果
  - 监听超时和上下文取消信号
  - 错误时继续重试，不中断监控
- 实现信号处理：监听 SIGINT (Ctrl+C) 优雅退出
- 创建 `internal/client/monitor_test.go`
- 编写测试用例：
  - 测试定时器按间隔触发
  - 测试超时后正常退出
  - 测试上下文取消后退出
- 参考: Design Document - Key Design Decisions 第6点

### 7.2 实现 monitor 命令

- 创建 `internal/cli/monitor.go`
- 实现 `MonitorCommand` 作为子命令路由器
  - `monitor threads`：持续监控线程列表
  - `monitor locals`：持续监控局部变量
  - `monitor stack`：持续监控调用栈
- 支持标志：
  - `--interval`：查询间隔（默认 2s）
  - `--timeout`：总超时（默认 60s）
  - `--thread`, `--frame`：根据子命令需要
- 在 `Execute()` 中创建 `StreamMonitor` 并启动
- 手动测试：
  - 运行 `monitor threads` 观察定时输出
  - 测试 Ctrl+C 优雅退出
  - 测试超时自动退出
- 参考: Requirements 2.3, 5.8

---

## 8. 错误处理与完善

### 8.1 完善错误处理与退出码

- 创建 `internal/errors/errors.go`
- 定义错误类型：
  ```go
  type JdwpError struct{ ErrorCode uint16 }
  type ConnectionError struct{ Msg string }
  type ValidationError struct{ Msg string }
  ```
- 实现错误消息格式化
- 修改 `main.go` 根据错误类型设置退出码：
  - 0: 成功
  - 1: ValidationError
  - 2: ConnectionError
  - 3: JdwpError
- 确保所有错误输出到 stderr，正常输出到 stdout
- 参考: Requirements 10.1, 10.4, 10.5

### 8.2 实现跨平台兼容处理

- 创建 `internal/platform/` 目录
- 定义 `PlatformOps` 接口
- 创建 `internal/platform/platform_unix.go`（使用 `//go:build linux || darwin` 标签）
- 创建 `internal/platform/platform_windows.go`（使用 `//go:build windows` 标签）
- 实现各平台的进程查找、环境变量获取等功能
- 测试各平台构建：
  ```bash
  GOOS=linux GOARCH=amd64 go build
  GOOS=windows GOARCH=amd64 go build
  GOOS=darwin GOARCH=amd64 go build
  ```
- 参考: Requirements 11.1, 11.2, 11.3, 11.4, Design Document - Key Design Decisions 第5点

### 8.3 完善帮助文档与命令说明

- 为每个命令实现详细的 `--help` 输出
- 在主帮助信息中列出所有可用命令及简短描述
- 添加 README.md 包含：
  - 项目简介
  - 安装说明
  - 使用示例
  - 命令参考表
- 参考: Requirements 2.4, NFR5

### 8.4 编写集成测试

- 创建 `tests/integration/` 目录
- 创建测试辅助文件 `testutil/jvm_helper.go`
  - 实现 `StartTestJVM()` 启动测试 JVM
  - 实现 `CleanupTestJVM()` 清理测试环境
- 编写集成测试用例：
  - `TestVersionCommand`: 验证版本查询
  - `TestThreadsCommand`: 验证线程列表
  - `TestBreakpointLifecycle`: 验证断点设置和清除
  - `TestStepExecution`: 验证单步执行
- 注意：集成测试需要 JDK 环境，使用 `testing.Short()` 跳过标记
- 参考: Design Document - Testing Strategy

---

## 9. 构建与分发

### 9.1 配置交叉编译脚本

- 创建 `build.sh` (Unix) 和 `build.bat` (Windows)
- 实现多平台构建：

  ```bash
  # Linux AMD64
  GOOS=linux GOARCH=amd64 go build -o dist/jdwp-cli-linux-amd64 ./cmd/jdwp-cli

  # Windows AMD64
  GOOS=windows GOARCH=amd64 go build -o dist/jdwp-cli-windows-amd64.exe ./cmd/jdwp-cli

  # macOS AMD64
  GOOS=darwin GOARCH=amd64 go build -o dist/jdwp-cli-macos-amd64 ./cmd/jdwp-cli
  ```

- 验证生成的二进制文件可以正常运行
- 参考: Requirements 11.4, Design Document - Implementation Notes

### 9.2 最终验证与文档完善

- 运行所有单元测试：`go test ./...`
- 运行集成测试（需要 JDK 环境）
- 检查代码格式：`gofmt -l .`
- 更新 README.md 添加最终使用说明
- 创建 CHANGELOG.md 记录版本历史
- 参考: NFR3, NFR4

---

## 任务依赖关系

```
1.1 → 1.2 → 1.3 → 1.4
                  ↓
2.1 → 2.2 → 2.3 → 2.4 → 2.5
          ↓
3.1 → 3.2 → 3.3 → 3.4
          ↓
4.1 → 4.2 → 4.3
          ↓
5.1 → 5.2 → 5.3 → 5.4
          ↓
6.1 → 6.2 → 6.3
          ↓
7.1 → 7.2
          ↓
8.1 → 8.2 → 8.3 → 8.4
          ↓
9.1 → 9.2
```

**推荐执行顺序**：按编号顺序执行，每个任务完成后应通过 `go test` 验证。
