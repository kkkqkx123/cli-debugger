# 阶段 1: 项目初始化与基础架构 - 完成总结

## 完成情况

### ✅ 1.1 初始化 Go 项目

- [x] 创建 `go.mod` 文件，定义模块名为 `cli-debugger`
- [x] 添加依赖：cobra、viper、color、tablewriter、progressbar、websocket、toml、yaml
- [x] 创建目录结构（cmd/、internal/api/、internal/config/、internal/output/、internal/monitor/、internal/platform/、pkg/types/）
- [x] 创建 `main.go` 入口文件
- [x] 创建构建脚本（build.sh 和 build.bat）

**文件列表**:

- `go.mod` - Go 模块定义
- `main.go` - 程序入口
- `build.sh` - Linux/macOS 构建脚本
- `build.bat` - Windows 构建脚本
- `.gitignore` - Git 忽略规则

### ✅ 1.2 定义统一调试协议接口

- [x] 创建 `internal/api/base.go`
- [x] 定义 DebugProtocol 接口（生命周期、查询、线程、执行、断点、变量、事件、元数据）
- [x] 定义通用数据类型于 `pkg/types/base.go`
  - ThreadInfo
  - StackFrame
  - BreakpointInfo
  - Variable
  - DebugEvent
  - VersionInfo
- [x] 定义能力结构 Capabilities
- [x] 定义 APIError 错误类型
- [x] 创建单元测试 `internal/api/client_test.go`

**文件列表**:

- `internal/api/base.go` - DebugProtocol 接口定义
- `pkg/types/base.go` - 通用数据类型定义
- `internal/api/client_test.go` - 插件注册测试

### ✅ 1.3 实现插件注册与客户端工厂

- [x] 创建 `internal/api/client.go`
- [x] 定义插件注册表（协议名称到工厂函数的映射）
- [x] 实现 CreateClient 方法
- [x] 实现 AutoDetect 方法（基于端口特征推断协议）
- [x] 注册 JDWP 为默认协议（占位实现）
- [x] 创建注册表单元测试

**功能特性**:

- 支持动态注册插件
- 支持根据端口自动检测协议（5005 → jdwp）
- 提供 GetRegisteredProtocols() 获取已注册协议列表
- 提供 HasProtocol() 检查协议是否存在
- 包含占位协议实现，确保编译通过

### ✅ 1.4 实现配置系统

- [x] 创建 `internal/config/config.go` 定义配置结构
- [x] 创建 `internal/config/loader.go` 实现配置加载（viper 集成）
- [x] 创建 `internal/config/paths.go` 定义配置路径
- [x] 支持 YAML 和 TOML 配置文件
- [x] 支持环境变量覆盖（DEBUGGER\_\* 前缀）
- [x] 实现配置验证逻辑
- [x] 创建配置加载测试

**配置层级** (优先级从低到高):

1. 内置默认值
2. 全局配置文件 (~/.config/debugger/config.yaml)
3. 项目配置文件 (.debugger.yaml)
4. 环境变量 (DEBUGGER\_\* 前缀)
5. CLI 参数标志

**支持的配置项**:

- protocol, host, port, timeout
- output, color
- watch, interval
- verbose
- plugins (插件特定配置)

### ✅ 1.5 实现输出格式化器

- [x] 创建 `internal/output/formatter.go` 定义格式化接口
- [x] 实现 `internal/output/text.go` 文本格式化（集成 color）
- [x] 实现 `internal/output/json.go` JSON 格式化
- [x] 实现 `internal/output/table.go` 表格格式化（集成 tablewriter）
- [x] 实现格式化器工厂（根据 --output 标志选择）
- [x] 创建格式化器单元测试

**格式化器类型**:

- TextFormatter - 彩色文本输出，适合交互式使用
- JSONFormatter - 标准 JSON 输出，适合脚本集成
- TableFormatter - 表格输出，适合列表数据展示

**支持的格式化内容**:

- 版本信息
- 线程列表
- 调用栈
- 变量列表
- 断点列表
- 调试事件
- 错误消息

## 项目结构

```
cli-debugger/
├── cmd/
│   ├── root.go              # 根命令、全局标志、初始化
│   └── version.go           # version 命令
├── internal/
│   ├── api/
│   │   ├── base.go          # DebugProtocol 接口定义
│   │   ├── client.go        # 插件注册与客户端工厂
│   │   └── client_test.go   # 单元测试
│   ├── config/
│   │   ├── config.go        # 配置结构定义
│   │   ├── loader.go        # 配置加载器
│   │   ├── paths.go         # 配置路径解析
│   │   └── loader_test.go   # 单元测试
│   ├── monitor/
│   │   ├── stream.go        # WebSocket 流式客户端（占位）
│   │   └── poller.go        # HTTP 轮询监控器（占位）
│   ├── output/
│   │   ├── formatter.go     # 格式化器接口
│   │   ├── text.go          # 文本格式化
│   │   ├── json.go          # JSON 格式化
│   │   ├── table.go         # 表格格式化
│   │   └── formatter_test.go # 单元测试
│   └── platform/
│       └── process.go       # 进程发现接口（占位）
├── pkg/
│   └── types/
│       └── base.go          # 通用类型定义
├── configs/
│   └── example.yaml         # 示例配置文件
├── go.mod                   # Go 模块定义
├── main.go                  # 程序入口
├── README.md                # 项目说明
├── build.sh                 # Linux/macOS 构建脚本
├── build.bat                # Windows 构建脚本
└── .gitignore               # Git 忽略规则
```

## 核心设计决策

### 1. 插件化架构

- **设计**: 定义统一的 DebugProtocol 接口，所有语言插件必须实现此接口
- **优势**: 新增语言只需实现接口，无需修改核心代码
- **实现**: 使用工厂函数模式注册插件

### 2. 无状态默认

- **设计**: 每次命令独立连接，可选的监控模式通过 watch 标志启用
- **优势**: 适合脚本和自动化，避免会话状态管理
- **实现**: PersistentPreRunE 建立连接，PersistentPostRunE 关闭连接

### 3. 配置驱动

- **设计**: 多层级配置系统，CLI 参数优先级最高
- **优势**: 灵活适应不同使用场景
- **实现**: Viper 集成，支持 YAML/TOML/环境变量

### 4. 输出格式化

- **设计**: 统一的 Formatter 接口，支持多种输出格式
- **优势**: 用户可根据需求选择合适格式
- **实现**: 工厂模式创建格式化器实例

## 下一步计划

### 阶段 2: JDWP 插件实现

1. 实现 JDWP 协议编解码（protocol.go）
2. 实现 JDWP 握手协议（handshake.go）
3. 实现 VirtualMachine 命令集（vm.go）
4. 实现 ThreadReference 命令集（thread.go）
5. 实现 EventRequest 命令集（event.go）
6. 实现 StackFrame 命令集（stackframe.go）
7. 替换占位协议实现

### 阶段 3: CLI 命令完善

1. 实现 threads 命令
2. 实现 stack 命令
3. 实现 locals 命令
4. 实现 breakpoint 命令（add/remove/clear）
5. 实现 suspend/resume/cont/step/next/finish 命令
6. 实现 monitor 命令

### 阶段 4: 监控模式

1. 实现 WebSocket 流式输出
2. 实现 HTTP 轮询监控
3. 添加终端刷新显示
4. 实现信号处理（Ctrl+C）

### 阶段 5: 测试与文档

1. 编写完整的单元测试
2. 编写集成测试（使用真实 JVM）
3. 完善文档和示例
4. CI/CD 配置

## 技术栈

### CLI 框架

- **cobra**: 命令框架（子命令、帮助、自动完成）
- **viper**: 配置管理（YAML/TOML、环境变量、CLI 参数优先级）

### 输出格式化

- **fatih/color**: 终端彩色输出
- **olekukonko/tablewriter**: 表格格式化
- **encoding/json**: JSON 编码（标准库）

### 网络与系统

- **golang.org/x/net**: 网络工具（待使用）
- **golang.org/x/sys**: 系统调用（进程管理，待使用）
- **gorilla/websocket**: WebSocket 支持（待使用）

### 配置解析

- **BurntSushi/toml**: TOML 配置解析
- **gopkg.in/yaml.v3**: YAML 配置解析

## 测试覆盖率目标

| 组件        | 最低覆盖率 | 目标覆盖率 |
| ----------- | ---------- | ---------- |
| Protocol 层 | 85%        | 95%        |
| Client 层   | 80%        | 90%        |
| CLI 层      | 75%        | 85%        |
| Config 层   | 80%        | 90%        |
| Output 层   | 85%        | 95%        |
| 全局        | 80%        | 90%        |

## 参考资料

- [需求文档](../docs/spec/multi-lang-debugger/requirements.md)
- [设计文档](../docs/spec/multi-lang-debugger/design.md)
- [基础设施设计](../infra.md)
