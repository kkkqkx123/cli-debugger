# 多语言调试 CLI - 设计文档

## 概述

本文档定义了多语言调试 CLI 客户端的架构设计。系统采用**轻量插件化架构**，将核心命令框架与协议特定实现分离，通过统一的调试协议接口支持多种语言。JDWP 作为首个插件实现，后续语言通过实现相同接口无缝集成。

### 设计原则

- **协议抽象**: 所有调试协议统一为 DebugProtocol 接口，核心命令逻辑与协议无关
- **轻量插件化**: 插件为 Go 包形式，编译时集成，生成单一二进制文件
- **无状态默认**: 每次命令独立连接，可选的监控模式通过 watch 标志启用
- **配置驱动**: 通过配置文件管理连接参数和插件选择
- **渐进式扩展**: 新增语言只需实现插件接口，无需修改核心代码

### 技术栈

**CLI 框架**:

- cobra: 命令框架（子命令、帮助、自动完成）
- viper: 配置管理（YAML/TOML、环境变量、CLI 参数优先级）

**输出格式化**:

- fatih/color: 终端彩色输出
- olekukonko/tablewriter: 表格格式化
- schollz/progressbar: 监控模式进度指示

**网络与系统**:

- gorilla/websocket: WebSocket 支持（监控模式流式数据）
- golang.org/x/net: 网络工具
- golang.org/x/sys: 系统调用（进程管理）
- BurntSushi/toml: TOML 配置解析
- gopkg.in/yaml.v3: YAML 配置解析

### 架构概览

```
┌─────────────────────────────────────────────────────┐
│              CLI 命令层 (cobra)                      │  ← 用户交互、参数解析
├─────────────────────────────────────────────────────┤
│           命令执行层 (cmd/)                          │  ← 命令路由、客户端创建、格式化输出
├─────────────────────────────────────────────────────┤
│          协议插件层 (internal/api/)                  │  ← 协议特定实现（JDWP、DAP...）
├─────────────────────────────────────────────────────┤
│         统一调试接口 (internal/api/base.go)          │  ← DebugProtocol 接口定义
├─────────────────────────────────────────────────────┤
│          传输层 (net.TCP / WebSocket)                │  ← 通信抽象
└─────────────────────────────────────────────────────┘
```

---

## 目录结构

```
cli-debugger/
├── cmd/
│   ├── root.go                        # 根命令、全局标志、初始化
│   ├── version.go                     # version 命令
│   ├── threads.go                     # threads 命令
│   ├── stack.go                       # stack 命令
│   ├── locals.go                      # locals 命令
│   ├── breakpoint.go                  # breakpoint 命令（add/remove/clear 子命令）
│   ├── execution.go                   # suspend/resume/cont/step/next/finish 命令
│   └── monitor.go                     # monitor 命令（traffic/memory 风格的监控）
├── internal/
│   ├── api/
│   │   ├── base.go                    # DebugProtocol 接口定义
│   │   ├── client.go                  # 客户端工厂（根据配置创建协议实例）
│   │   ├── jdwp/
│   │   │   ├── plugin.go              # JDWP 插件入口（实现接口）
│   │   │   ├── protocol.go            # JDWP 包编解码
│   │   │   ├── handshake.go           # JDWP 握手协议
│   │   │   ├── vm.go                  # VirtualMachine 命令集
│   │   │   ├── thread.go              # ThreadReference 命令集
│   │   │   ├── event.go               # EventRequest 命令集
│   │   │   └── stackframe.go          # StackFrame 命令集
│   │   └── dap/                       # DAP 插件（未来扩展）
│   ├── config/
│   │   ├── config.go                  # 配置结构定义
│   │   ├── loader.go                  # 配置加载（viper 集成）
│   │   └── paths.go                   # 配置路径解析
│   ├── output/
│   │   ├── formatter.go               # 输出格式化接口
│   │   ├── text.go                    # 文本格式化（彩色输出）
│   │   ├── json.go                    # JSON 格式化
│   │   ├── table.go                   # 表格格式化
│   │   └── stream.go                  # 监控模式流式输出
│   ├── monitor/
│   │   ├── stream.go                  # WebSocket 流式客户端
│   │   └── poller.go                  # HTTP 轮询监控器
│   └── platform/
│       ├── process.go                 # 进程发现接口
│       ├── process_unix.go            # Unix 实现
│       └── process_windows.go         # Windows 实现
├── pkg/
│   └── types/                         # 通用调试类型定义
├── configs/
│   └── example.yaml                   # 示例配置
├── go.mod
└── README.md
```

---

## 核心组件设计

### 1. 统一调试协议接口

定义所有协议插件必须实现的接口，位于 `internal/api/base.go`：

**生命周期管理**:

- Connect: 建立连接到目标调试服务器
- Close: 关闭连接
- IsConnected: 查询连接状态

**基础查询**:

- Version: 获取调试协议版本和目标运行时信息
- Capabilities: 获取插件支持的功能集合

**线程管理**:

- GetThreads: 获取所有线程列表
- GetThreadStack: 获取指定线程的调用栈
- GetThreadState: 获取线程状态（运行、挂起、等待等）

**执行控制**:

- Suspend: 挂起整个 VM 或指定线程
- Resume: 恢复执行
- StepInto: 单步进入
- StepOver: 单步跳过
- StepOut: 单步跳出

**断点管理**:

- SetBreakpoint: 设置断点（行断点、方法断点）
- RemoveBreakpoint: 移除指定断点
- ClearBreakpoints: 清除所有断点

**变量检查**:

- GetLocalVariables: 获取栈帧局部变量
- GetFields: 获取类或对象字段

**事件处理**:

- WaitForEvent: 等待调试事件（用于 cont/step/next 命令）

**元数据**:

- ProtocolName: 获取协议名称
- SupportedLanguages: 获取支持的语言列表

### 2. 插件注册与客户端工厂

**插件注册表** (internal/api/client.go):

- 维护协议名称到插件工厂函数的映射
- 提供 CreateClient 方法根据协议名称创建实例
- 提供 AutoDetect 方法根据目标特征推断协议

**客户端创建流程**:

1. 从配置或 CLI 参数获取协议名称（或留空）
2. 如果未指定，调用 AutoDetect 推断协议
3. 从注册表查找协议工厂函数
4. 调用工厂函数创建协议实例
5. 应用配置选项（host、port、timeout）

**自动检测策略**:

- 端口特征: 5005 默认为 JDWP（Java 调试常用端口）
- 进程特征: 检测目标进程名称（java、node、python 等）
- 用户显式指定: --protocol 标志优先级最高

### 3. CLI 命令层

**根命令设计** (cmd/root.go):

- Use: debugger
- PersistentPreRunE: 初始化配置、创建客户端、建立连接
- PersistentPostRunE: 关闭连接、清理资源

**全局标志**:

- --config/-c: 配置文件路径
- --protocol: 调试协议名称（jdwp、dap 等）
- --host: 目标主机地址
- --port: 目标调试端口
- --timeout: 请求超时时间（秒）
- --output/-o: 输出格式（text/json/table）
- --watch/-w: 启用监控模式
- --interval/-i: 监控刷新间隔（秒）
- --json: JSON 格式输出（快捷标志）
- --verbose: 显示协议级详细信息
- --no-color: 禁用彩色输出

**命令执行模式**:

```
用户输入命令
    ↓
解析全局标志，加载配置
    ↓
选择协议插件（显式或自动检测）
    ↓
创建协议实例，建立连接
    ↓
执行命令（委托给协议接口）
    ↓
格式化输出（text/json/table）
    ↓
关闭连接
    ↓
返回退出码
```

**命令与接口映射**:

- version → Version()
- threads → GetThreads() + GetThreadState()
- stack → GetThreadStack()
- locals → GetLocalVariables()
- breakpoint add → SetBreakpoint()
- breakpoint remove → RemoveBreakpoint()
- breakpoint clear → ClearBreakpoints()
- suspend → Suspend()
- resume → Resume()
- cont/step/next/finish → 发送命令 → WaitForEvent()
- monitor → 启动监控模式（watch 标志）

### 4. 输出格式化系统

**格式化接口** (internal/output/formatter.go):

- FormatVersion: 格式化版本信息
- FormatThreads: 格式化线程列表
- FormatStack: 格式化调用栈
- FormatVariables: 格式化变量列表
- FormatBreakpoints: 格式化断点列表
- FormatEvent: 格式化调试事件

**文本格式化器**:

- 使用 fatih/color 实现彩色输出
- 字符串值: 绿色，数字: 黄色，布尔值: 蓝色，错误: 红色
- 支持 --no-color 禁用彩色

**表格格式化器**:

- 使用 tablewriter 渲染表格
- 适用于 threads、classes、breakpoints 等列表数据
- 支持表头、对齐、边框

**JSON 格式化器**:

- 标准 JSON 输出，用于脚本集成
- 保留完整数据结构，无信息丢失

**流式输出** (internal/output/stream.go):

- 监控模式专用输出流
- 终端刷新显示（类似 top 命令）
- 支持进度条和状态指示器

### 5. 监控模式设计

**单次模式** (默认):

```
连接 → 执行命令 → 输出结果 → 断开
```

**监控模式** (--watch 标志):

```
连接 → 循环执行命令 → 刷新输出 → 超时/Ctrl+C → 断开
```

**监控实现策略**:

- 优先尝试 WebSocket 流式连接（如果协议支持）
- WebSocket 不可用时降级为 HTTP 轮询模式
- 使用 context 管理生命周期和超时
- 监听 SIGINT/SIGTERM 信号实现优雅退出

**监控循环**:

1. 创建 context，设置总超时
2. 启动信号监听（Ctrl+C）
3. 按间隔定时执行命令
4. 格式化并刷新输出
5. 超时或取消时退出循环
6. 关闭连接

### 6. 配置系统

**配置层级** (优先级从低到高):

1. 内置默认值
2. 全局配置文件 (~/.config/debugger/config.yaml)
3. 项目配置文件 (.debugger.yaml)
4. 环境变量 (DEBUGGER\_\* 前缀)
5. CLI 参数标志

**配置结构** (internal/config/config.go):

```yaml
# 全局默认值
defaults:
  protocol: jdwp # 默认协议
  timeout: 30 # 超时（秒）
  output: text # 输出格式
  color: true # 彩色输出

# 命名配置文件
profiles:
  dev-java:
    host: 127.0.0.1
    port: 5005
    protocol: jdwp
    timeout: 10

  prod-java:
    host: 192.168.1.100
    port: 5005
    protocol: jdwp

# 插件特定配置
plugins:
  jdwp:
    # JDWP 特定选项（未来扩展）
```

**配置加载流程**:

1. 初始化 viper，设置默认值
2. 查找并加载全局配置文件
3. 查找并加载项目配置文件
4. 绑定环境变量
5. 解析 CLI 参数，覆盖配置
6. 验证配置完整性

---

## 数据流设计

### 命令执行数据流

```
CLI 命令 (cmd/threads.go)
    ↓ 调用
命令执行层 (PersistentPreRunE)
    ├── 加载配置 (viper)
    ├── 选择协议 (AutoDetect 或 --protocol)
    ├── 创建客户端 (api.CreateClient)
    └── 建立连接 (Connect)
    ↓ 委托
协议插件 (internal/api/jdwp/plugin.go)
    ├── 协议特定逻辑
    ├── 发送调试命令
    ├── 接收响应
    └── 转换为统一数据类型
    ↓ 返回
命令执行层
    ↓ 调用
输出格式化 (internal/output/)
    ├── 选择格式化器 (text/json/table)
    └── 输出到 stdout
    ↓ 清理
命令执行层 (PersistentPostRunE)
    └── 关闭连接 (Close)
```

### 监控模式数据流

```
CLI 命令 (cmd/monitor.go --watch)
    ↓
建立连接
    ↓
创建监控器 (internal/monitor/)
    ├── 尝试 WebSocket 流式连接
    └── 失败则使用轮询模式
    ↓
监控循环
    ├── 定时执行命令
    ├── 格式化输出
    ├── 刷新终端显示
    └── 检查退出条件
    ↓
退出条件触发 (超时/Ctrl+C/错误)
    ↓
关闭连接，清理资源
```

---

## 错误处理设计

### 错误分类

**输入错误** (退出码 1):

- 参数验证失败
- 配置文件格式错误
- 协议未找到

**连接错误** (退出码 2):

- 无法连接到目标
- 握手失败
- 连接超时

**协议错误** (退出码 3):

- 目标返回错误码
- 协议解析失败
- 不支持的操作

### 错误传播流程

```
协议层错误
    ↓
包装为统一错误类型 (api.APIError)
    ↓
添加上下文信息（协议名称、命令名称）
    ↓
传递到命令执行层
    ↓
根据错误类型设置退出码
    ↓
格式化错误消息，输出到 stderr
```

### 错误消息格式

**文本模式**:

```
错误: [jdwp] 无法连接到 127.0.0.1:5005: connection refused
提示: 确认 JVM 是否已启动并启用 JDWP 调试
```

**JSON 模式**:

```json
{
  "error": {
    "type": "connection",
    "protocol": "jdwp",
    "message": "无法连接到 127.0.0.1:5005",
    "detail": "connection refused"
  }
}
```

**Verbose 模式**:

```
[DEBUG] 尝试连接到 127.0.0.1:5005
[DEBUG] 协议: jdwp
[ERROR] 连接失败: connection refused
错误: [jdwp] 无法连接到 127.0.0.1:5005
```

---

## JDWP 插件设计

### 插件结构

**plugin.go** - 实现 DebugProtocol 接口:

- 内部持有 JDWP 客户端实例
- 实现所有接口方法，委托给 JDWP 客户端
- 提供 ProtocolName 和 SupportedLanguages 元数据

**protocol.go** - JDWP 协议编解码:

- CommandPacket/ReplyPacket 定义
- 大端序二进制编解码
- JDWP 错误码定义

**handshake.go** - 握手协议:

- 读取 JVM 发送的 "JDWP-Handshake"
- 验证并回写相同字符串

**vm.go** - VirtualMachine 命令集:

- Version: 获取版本信息
- AllThreads: 获取所有线程
- Suspend/Resume: 挂起/恢复
- AllClasses: 获取已加载类
- IDSizes: 获取 ID 长度

**thread.go** - ThreadReference 命令集:

- ThreadName: 获取线程名称
- ThreadStatus: 获取线程状态
- ThreadFrames: 获取调用栈

**event.go** - EventRequest 命令集:

- SetBreakpoint: 设置断点
- RemoveBreakpoint: 移除断点
- WaitForEvent: 等待事件

**stackframe.go** - StackFrame 命令集:

- GetLocalVariables: 获取局部变量

### 数据映射

**JDWP 类型 → 统一类型**:

- JDWP ObjectID/ThreadID → string (格式化为十进制)
- JDWP 值标签 (B/C/I/Z...) → 统一 Value 类型
- JDWP 事件类型 → 统一 DebugEvent 类型
- JDWP 错误码 → 统一 APIError

### 能力声明

**支持的命令**:

- version, threads, stack, locals
- breakpoint add/remove/clear
- suspend, resume, cont, step, next, finish

**不支持的命令**:

- eval (JDWP 协议限制)

**特殊处理**:

- cont/step/next/finish 需要等待事件返回
- 断点 ID 由 JDWP RequestID 映射

---

## 向后兼容设计

### 兼容性保证

**命令兼容**:

- 所有 JDWP 命令保持不变
- 命令参数和标志保持不变
- 默认行为保持不变（JDWP 为默认协议）

**输出兼容**:

- JSON 输出字段名称保持一致
- 文本输出格式保持一致
- 退出码保持一致

**配置兼容**:

- 提供示例配置文件
- 旧配置格式自动转换

### 迁移路径

**阶段一**: 实现插件架构，JDWP 作为首个插件
**阶段二**: 完善 CLI 命令和输出格式化
**阶段三**: 添加监控模式和配置管理
**阶段四**: 完善测试和文档
**阶段五**: 发布首个稳定版本

---

## 测试策略

### 测试层次

**单元测试**:

- 协议接口 mock 测试
- 命令逻辑测试
- 配置解析测试
- 格式化器测试
- 目标覆盖率: 80%

**集成测试**:

- 真实 JVM 连接测试（使用测试 JVM）
- JDWP 插件功能测试
- 配置加载测试
- 目标覆盖率: 70%

**端到端测试**:

- 完整调试会话测试
- CLI 命令组合测试
- 错误场景测试

### 测试基础设施

**Mock 传输**:

- 模拟 TCP 连接
- 模拟 WebSocket 连接
- 预定义响应数据

**Mock 协议**:

- 实现 DebugProtocol 接口用于测试
- 支持错误注入
- 验证命令逻辑正确性

**测试固件**:

- 简单 Java 应用（包含断点、循环、多线程）
- 用于集成测试的真实 JVM 环境

---

## 性能设计

### 连接优化

**无状态模式** (默认):

- 每次命令新建连接
- 执行完毕后立即关闭
- 适合脚本化使用

**监控模式** (可选):

- 保持单一连接
- 定时复用执行命令
- 超时或 Ctrl+C 时关闭

### 超时控制

- 所有操作设置超时（默认 30 秒）
- 监控模式额外设置总超时（默认 60 秒）
- 超时后自动清理资源

### 资源管理

- 使用 defer 确保连接关闭
- 异常退出时清理子进程
- 监控模式使用 context 管理生命周期
