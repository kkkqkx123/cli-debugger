# Delve 调试器架构与行为

## 概述

Delve 是 Go 语言的调试器，设计为简单、功能完整且非侵入式的调试工具。本文档描述 Delve 的进程行为、无状态执行模式以及 JSON-RPC API 的使用方式。

## 启动模式

### 1. 交互式终端模式

直接在终端中启动 Delve，提供交互式命令行界面：

```bash
# 调试当前目录的 main 包
dlv debug [package]

# 调试测试
dlv test [package]

# 执行预编译的二进制文件
dlv exec <path/to/binary>

# 附加到运行中的进程
dlv attach <pid>

# 分析 core dump
dlv core <exe> <core>

# 重放 rr trace
dlv replay <rr trace>
```

### 2. Headless 模式（无头模式）

Headless 模式下，Delve 作为后端服务器运行，不提供交互式终端，外部客户端通过 JSON-RPC 或 DAP 协议连接：

```bash
# 基本语法
dlv --headless <command> <target> <args>

# 示例：启动调试服务器
dlv debug --headless --api-version=2 --log --log-output=debugger,dap,rpc --listen=127.0.0.1:8181

# 允许多客户端连接
dlv debug --headless --accept-multiclient --listen=127.0.0.1:8181
```

### 3. 命令对比

| 命令 | 用途 | 目标 |
|------|------|------|
| `dlv debug` | 编译并调试 main 包 | 源代码 |
| `dlv test` | 编译测试二进制并调试 | 测试代码 |
| `dlv exec` | 执行预编译的二进制文件 | 已编译的二进制 |
| `dlv attach` | 附加到运行中的进程 | 进程 ID |
| `dlv core` | 分析 core dump | core 文件 |
| `dlv replay` | 重放 rr trace | trace 目录 |

## 全局选项

```bash
--accept-multiclient       # 允许 headless 服务器接受多个客户端连接
--api-version int          # JSON-RPC API 版本（唯一有效值是 2，默认 2）
--check-go-version         # 检查 Go 版本兼容性（默认 true）
--headless                 # 以 headless 模式运行
--listen string            # 监听地址（默认 "127.0.0.1:0"）
--log                      # 启用调试日志
--log-dest string          # 日志输出目标
--log-output string        # 日志输出组件（debugger,dap,rpc）
--only-same-user           # 只允许相同用户连接（默认 true）
```

## 进程生命周期

### 启动流程

1. **初始化阶段**
   - Delve 解析命令行参数
   - 验证 Go 版本兼容性
   - 设置日志和监听地址

2. **目标加载阶段**
   - `debug`: 编译源代码，生成临时调试二进制
   - `exec`: 加载预编译的二进制
   - `attach`: 附加到已运行的进程
   - 启动目标进程（处于暂停状态）

3. **服务启动阶段**
   - 启动 JSON-RPC/DAP 服务器
   - 监听指定地址
   - 等待客户端连接

### 调试会话

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │◄───────►│   Delve     │◄───────►│  Target     │
│  (JSON-RPC) │         │   Server    │         │  Process    │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      │  1. Connect           │                       │
      │──────────────────────►│                       │
      │                       │                       │
      │  2. GetState          │                       │
      │──────────────────────►│                       │
      │                       │                       │
      │  3. SetBreakpoint     │                       │
      │──────────────────────►│                       │
      │                       │                       │
      │  4. Continue          │                       │
      │──────────────────────►│───────Resume─────────►│
      │                       │                       │
      │  5. WaitForEvent      │                       │
      │◄──────────────────────│◄───Breakpoint────────│
      │                       │                       │
      │  6. Inspect           │                       │
      │──────────────────────►│                       │
      │                       │                       │
      │  7. Detach            │                       │
      │──────────────────────►│                       │
      │                       │                       │
```

### 终止流程

**正确清理资源的方式：**

1. **暂停目标进程**（如果正在运行）
   ```json
   {"jsonrpc": "2.0", "id": 1, "method": "RPCServer.Command", "params": [{"Name": "halt"}]}
   ```

2. **调用 Detach 清理资源**
   ```json
   {"jsonrpc": "2.0", "id": 2, "method": "RPCServer.Detach", "params": [{}]}
   ```

**Disconnect 行为：**

| 场景 | Launched Process | Attached Process |
|------|------------------|------------------|
| 客户端断开（单客户端模式） | 终止 | 继续运行 |
| 客户端断开（多客户端模式） | 保持 | 保持 |
| SIGTERM 信号 | 终止 | 继续运行 |
| 程序正常退出 | - | - |

## JSON-RPC API

### 核心 API 方法

#### 执行控制

```typescript
// 控制目标进程执行
RPCServer.Command(name: string): DebuggerState

// 可用的命令名称：
// - "halt": 暂停执行
// - "continue": 继续执行
// - "next": 单步跳过（在选定的 goroutine 上操作）
// - "step": 单步进入（跳过未导出的运行时函数）
// - "stepout": 单步跳出（直到函数返回）
// - "switchGoroutine": 切换选定的 goroutine
```

#### 状态查询

```typescript
// 获取当前调试器状态
RPCServer.State(): DebuggerState

// 列出所有 goroutines
RPCServer.ListGoroutines(start: number, count: number): GoroutinesResult

// 获取堆栈跟踪
RPCServer.Stacktrace(id: number, depth: number): StacktraceResult
```

#### 断点管理

```typescript
// 创建断点
RPCServer.CreateBreakpoint(location: Location): Breakpoint

// 清除断点
RPCServer.ClearBreakpoint(id: number): void

// 列出所有断点
RPCServer.ListBreakpoints(): Breakpoint[]

// 切换断点状态
RPCServer.ToggleBreakpoint(id: number): void
```

#### 变量检查

```typescript
// 列出局部变量
RPCServer.ListLocalVars(scope: EvalScope): Variable[]

// 列出函数参数
RPCServer.ListFunctionArgs(scope: EvalScope): Variable[]

// 列出包变量
RPCServer.ListPackageVars(filter: string): Variable[]

// 设置变量值
RPCServer.Set(scope: EvalScope, symbol: string, value: string): void
```

### DebuggerState 对象

```typescript
interface DebuggerState {
  // 当前是否正在运行
  running: boolean;

  // 当前线程信息
  currentThread?: Thread;

  // 当前 goroutine 信息
  currentGoroutine?: Goroutine;

  // 所有线程列表
  Threads: Thread[];

  // 选定的 goroutine（用于 stepping 命令）
  SelectedGoroutine?: Goroutine;

  // 是否有异步 stepping 操作正在进行
  NextInProgress: boolean;

  // 程序是否已退出
  exited: boolean;

  // 退出状态码
  exitStatus: number;
}
```

### Goroutine 对象

```typescript
interface Goroutine {
  // goroutine ID
  id: number;

  // 当前位置
  userCurrentLoc: Location;

  // 系统栈标志
  systemStack: boolean;

  // 线程 ID（如果正在运行）
  threadId: number;

  // 位置信息
  currentLoc: Location;
  goStatementLoc: Location;
  startLoc: Location;
}
```

## 无状态执行模式

### 概念

无状态执行是指每个调试操作都是独立的，不依赖于之前的操作状态。这种模式适合：

- 脚本自动化
- CI/CD 集成
- 远程调试
- 一次性查询

### 实现方式

**1. 每次连接执行一个操作**

```typescript
// 连接 -> 执行操作 -> 断开
async function statelessOperation(config: DebugConfig) {
  const client = new DlvClient(config);
  await client.connect();

  try {
    // 执行单个操作
    const result = await client.threads();
    return result;
  } finally {
    // 确保断开连接
    await client.close();
  }
}
```

**2. 使用 Detach 正确清理**

```typescript
async function safeDisconnect(client: DlvClient) {
  try {
    // 暂停目标进程
    await client.suspend();
  } catch {
    // 可能已经暂停
  }

  // 断开连接（会自动调用 Detach）
  await client.close();
}
```

**3. Headless 服务器持久化**

```bash
# 启动持久的 headless 服务器
dlv debug --headless --accept-multiclient --listen=127.0.0.1:4040

# 多个客户端可以连接和断开
# 服务器保持运行，目标进程保持暂停
```

### 最佳实践

1. **连接管理**
   - 使用 try-finally 确保连接关闭
   - 设置合理的超时时间
   - 处理连接断开的情况

2. **状态检查**
   - 每次操作前检查连接状态
   - 使用 `GetState` 获取最新状态
   - 处理程序已退出的情况

3. **资源清理**
   - 始终调用 `Detach` 或 `close`
   - 暂停后再断开（如果需要）
   - 清除断点（如果需要）

4. **错误处理**
   - 处理 APIError 异常
   - 区分连接错误和命令错误
   - 记录错误信息用于调试

## 与 JDWP 的对比

| 特性 | Delve (Go) | JDWP (Java) |
|------|------------|-------------|
| 协议 | JSON-RPC / DAP | JDWP 二进制协议 |
| 线程模型 | Goroutine | Thread |
| 启动方式 | debug/exec/attach | -agentlib:jdwp |
| 状态管理 | DebuggerState | 事件驱动 |
| 断点类型 | 行/函数/条件 | 多种事件类型 |
| 变量检查 | EvalScope | StackFrame + ObjectReference |

## 常见问题

### 1. Delve 启动后立即退出

**原因：**
- 目标程序立即退出
- 没有使用 `--headless` 模式
- 监听地址配置错误

**解决方案：**
```bash
# 使用 debug 命令而不是 exec
dlv debug --headless --listen=127.0.0.1:4040

# 或者确保程序不会立即退出
# 在 Go 代码中添加 time.Sleep 或等待信号
```

### 2. 连接被拒绝

**原因：**
- Delve 未启动或已退出
- 监听地址不匹配
- 防火墙阻止连接

**解决方案：**
```bash
# 检查 Delve 是否在运行
netstat -an | grep 4040

# 使用 --log 查看详细信息
dlv debug --headless --log --listen=127.0.0.1:4040
```

### 3. Goroutine 列表为空

**原因：**
- 程序尚未开始执行
- 需要先调用 Continue 或检查状态

**解决方案：**
```typescript
// 先获取状态
const state = await client.getState();

// 如果程序未运行，可能需要先继续
if (state.running) {
  // 程序正在运行，可以获取 goroutines
  const goroutines = await client.threads();
}
```

### 4. 断点不生效

**原因：**
- 文件路径不匹配
- 行号不正确
- 程序未编译调试信息

**解决方案：**
```bash
# 编译时禁用优化
go build -gcflags="all=-N -l" -o program

# 使用完整路径设置断点
await client.setBreakpoint("/full/path/to/file.go:42");
```

## 参考资料

- [Delve 官方文档](https://github.com/go-delve/delve/tree/master/Documentation)
- [JSON-RPC API 文档](https://github.com/go-delve/delve/blob/master/Documentation/api/json-rpc/README.md)
- [DAP 协议文档](https://github.com/go-delve/delve/blob/master/Documentation/api/dap/README.md)
- [客户端使用指南](https://github.com/go-delve/delve/blob/master/Documentation/api/ClientHowto.md)
