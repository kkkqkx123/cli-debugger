# 多语言调试 CLI - 任务计划

本计划将多语言调试 CLI 的实现分解为可独立执行的编码任务。采用渐进式实现策略，优先保证核心架构和 JDWP 功能可用，再逐步完善用户体验和测试。

---

## 阶段 1: 项目初始化与基础架构

目标：建立插件化架构基础，定义核心接口和项目结构。

### 1.1 初始化 Go 项目

- 创建 go.mod 文件，定义模块名为 `cli-debugger`
- 添加依赖：cobra、viper、color、tablewriter、progressbar、websocket、toml、yaml
- 创建目录结构（cmd/、internal/api/、internal/config/、internal/output/、internal/monitor/、internal/platform/、pkg/types/）
- 创建空的 main.go 入口文件
- 验证 `go build` 能成功编译
- 参考: Design Document - 目录结构

### 1.2 定义统一调试协议接口

- 创建 `internal/api/base.go`
- 定义 DebugProtocol 接口（生命周期、查询、线程、执行、断点、变量、事件、元数据）
- 定义通用数据类型（ThreadInfo、StackFrame、BreakpointInfo、Variable、DebugEvent 等）于 `pkg/types/`
- 定义能力结构（Capabilities），声明插件支持的命令集合
- 创建单元测试验证接口定义和数据类型
- 参考: Design Document - 核心组件设计 第1节

### 1.3 实现插件注册与客户端工厂

- 创建 `internal/api/client.go`
- 定义插件注册表（协议名称到工厂函数的映射）
- 实现 CreateClient 方法（根据协议名称创建实例）
- 实现 AutoDetect 方法（基于端口、进程特征推断协议）
- 注册 JDWP 为默认协议
- 创建注册表单元测试
- 参考: Design Document - 核心组件设计 第2节

### 1.4 实现配置系统

- 创建 `internal/config/config.go` 定义配置结构
- 创建 `internal/config/loader.go` 实现配置加载（viper 集成）
- 创建 `internal/config/paths.go` 定义配置路径（全局、项目）
- 支持 YAML 和 TOML 配置文件
- 支持环境变量覆盖（DEBUGGER\_\* 前缀）
- 实现配置验证逻辑
- 创建配置加载测试
- 参考: Design Document - 配置系统 第6节

### 1.5 实现输出格式化器

- 创建 `internal/output/formatter.go` 定义格式化接口
- 实现 `internal/output/text.go` 文本格式化（集成 color，支持彩色输出）
- 实现 `internal/output/json.go` JSON 格式化
- 实现 `internal/output/table.go` 表格格式化（集成 tablewriter）
- 实现格式化器工厂（根据 --output 标志选择）
- 创建格式化器单元测试
- 参考: Design Document - 核心组件设计 第4节

---

## 阶段 2: CLI 命令框架

目标：使用 cobra 实现根命令和全局标志，建立命令执行模式。

### 2.1 实现根命令

- 创建 `cmd/root.go`
- 定义根命令（Use: debugger, Short/Long 描述）
- 实现全局标志（--config、--protocol、--host、--port、--timeout、--output、--json、--watch、--interval、--verbose、--no-color）
- 实现 PersistentPreRunE：加载配置、选择协议、创建客户端、建立连接
- 实现 PersistentPostRunE：关闭连接、清理资源
- 实现配置初始化（viper 集成）
- 手动测试：验证 `debugger --help` 输出
- 参考: Design Document - 核心组件设计 第3节

### 2.2 实现命令上下文传递

- 定义命令上下文结构（DebugProtocol 实例、配置、格式化器）
- 使用 cobra 的 Context 或全局变量传递调试器实例
- 实现错误处理与退出码映射（0/1/2/3）
- 实现 verbose 模式（显示协议级详细信息）
- 创建命令执行测试（使用 mock 协议）
- 参考: Design Document - 核心组件设计 第3节

### 2.3 实现 version 命令

- 创建 `cmd/version.go`
- 实现 version 命令结构（嵌入全局配置）
- 在 JDWP 插件中实现 Version() 方法
- 调用协议接口获取版本信息
- 使用输出格式化器显示结果（支持 text/json）
- 注册 version 子命令到根命令
- 手动测试：连接真实 JVM 验证版本查询
- 参考: Requirements 5.1, 5.2

### 2.4 实现 threads 命令

- 创建 `cmd/threads.go`
- 在 JDWP 插件中实现 GetThreads() 方法
- 在 JDWP 插件中实现 GetThreadState() 方法
- 获取线程列表和状态
- 使用表格格式化器输出（ID、名称、状态）
- 注册 threads 子命令
- 手动测试：验证线程列表输出
- 参考: Requirements 5.3

---

## 阶段 3: JDWP 插件核心功能

目标：实现 JDWP 协议插件，完成所有核心调试命令。

### 3.1 实现 JDWP 协议层基础

- 创建 `internal/api/jdwp/plugin.go` 实现 DebugProtocol 接口
- 创建 `internal/api/jdwp/protocol.go` 实现 JDWP 包编解码
  - CommandPacket/ReplyPacket 定义
  - 大端序二进制编码/解码
  - JDWP 错误码定义
- 创建 `internal/api/jdwp/handshake.go` 实现握手协议
  - 读取并验证 "JDWP-Handshake"
  - 回写握手字符串
- 创建 JDWP 插件元数据声明（ProtocolName、SupportedLanguages）
- 创建协议层单元测试（编解码、握手）
- 参考: Design Document - JDWP 插件设计

### 3.2 实现 JDWP VirtualMachine 命令集

- 创建 `internal/api/jdwp/vm.go`
- 实现 IDSizes 获取（解析 ID 长度）
- 实现 Version 方法（获取 JDWP/JVM 版本）
- 实现 AllThreads 方法（获取线程列表）
- 实现 Suspend/Resume 方法（挂起/恢复 VM）
- 实现 AllClasses 方法（获取已加载类）
- 创建方法单元测试（mock 连接）
- 参考: Design Document - JDWP 插件设计

### 3.3 实现 JDWP ThreadReference 命令集

- 创建 `internal/api/jdwp/thread.go`
- 实现 ThreadName 方法
- 实现 ThreadStatus 方法
- 实现 ThreadFrames 方法（获取调用栈）
- 实现 GetThreadStack 接口方法（适配统一返回类型）
- 创建方法单元测试
- 参考: Design Document - JDWP 插件设计

### 3.4 实现 JDWP EventRequest 命令集

- 创建 `internal/api/jdwp/event.go`
- 实现 SetBreakpoint 方法（行断点、方法断点）
- 实现 RemoveBreakpoint 方法
- 实现 ClearBreakpoints 方法
- 实现 WaitForEvent 方法（等待调试事件）
- 创建方法单元测试
- 参考: Design Document - JDWP 插件设计

### 3.5 实现 JDWP StackFrame 命令集

- 创建 `internal/api/jdwp/stackframe.go`
- 实现 GetLocalVariables 方法
- 实现字段值获取方法
- 创建方法单元测试
- 参考: Design Document - JDWP 插件设计

---

## 阶段 4: 核心调试命令实现

目标：实现所有核心调试命令，完成 CLI 功能。

### 4.1 实现 stack 命令

- 创建 `cmd/stack.go`
- 支持 --thread 参数指定线程
- 调用 GetThreadStack() 获取调用栈
- 使用表格格式化输出（帧号、类名、方法名、行号）
- 手动测试：验证调用栈输出
- 参考: Requirements 6.1, 6.2

### 4.2 实现 locals 命令

- 创建 `cmd/locals.go`
- 支持 --thread 和 --frame 参数
- 调用 GetLocalVariables() 获取局部变量
- 格式化输出（名称、类型、值）
- 手动测试：验证局部变量输出
- 参考: Requirements 6.3, 6.4, 6.5

### 4.3 实现 breakpoint 命令

- 创建 `cmd/breakpoint.go`
- 实现子命令结构：
  - breakpoint add: 设置断点（--class、--line、--method）
  - breakpoint remove: 移除断点（--id）
  - breakpoint clear: 清除所有断点
- 调用协议接口执行断点操作
- 输出断点 ID 或操作结果
- 手动测试：验证断点设置、移除、清除
- 参考: Requirements 4.1-4.6

### 4.4 实现执行控制命令

- 创建 `cmd/execution.go`
- 实现子命令：
  - suspend: 挂起 VM
  - resume: 恢复 VM
  - cont: 继续执行（等待事件）
  - step: 单步进入（等待事件）
  - next: 单步跳过（等待事件）
  - finish: 单步跳出（等待事件）
- cont/step/next/finish 调用 WaitForEvent() 等待事件返回
- 实现超时控制（默认 30 秒）
- 输出事件信息（线程、位置、原因）
- 手动测试：验证执行控制流程
- 参考: Requirements 5.1-5.8

---

## 阶段 5: 监控模式与流式输出

目标：实现 --watch 监控模式，支持实时状态监控。

### 5.1 实现监控基础设施

- 创建 `internal/monitor/poller.go` 实现轮询监控器
- 创建 `internal/monitor/stream.go` 实现 WebSocket 流式客户端（可选，为未来扩展预留）
- 实现监控器接口（Start、Stop、SetInterval、SetTimeout）
- 实现信号监听（SIGINT/SIGTERM）
- 实现 context 管理生命周期
- 创建监控器单元测试
- 参考: Design Document - 核心组件设计 第5节

### 5.2 实现流式输出

- 创建 `internal/output/stream.go`
- 实现终端刷新显示（类似 top 命令）
- 集成 progressbar 显示进度指示器
- 实现监控模式头部和状态行显示
- 手动测试：验证刷新效果
- 参考: Design Document - 输出格式化 第4节

### 5.3 实现 monitor 命令

- 创建 `cmd/monitor.go`
- 实现 --watch/-w 标志支持
- 实现 --interval/-i 标志（刷新间隔）
- 单次模式：执行一次命令并输出
- 监控模式：启动监控器，循环刷新输出
- 实现 Ctrl+C 优雅退出
- 手动测试：验证监控模式
- 参考: Requirements 4.1-4.6

---

## 阶段 6: 输出优化与用户体验

目标：完善输出格式、彩色显示、错误提示等用户体验功能。

### 6.1 完善彩色输出

- 在所有命令中集成彩色输出
- 定义颜色方案：
  - 字符串值: 绿色
  - 数字值: 黄色
  - 布尔值: 蓝色
  - 错误/警告: 红色
- 实现 --no-color 标志禁用彩色
- 手动验证彩色输出效果
- 参考: Requirements 7.4

### 6.2 完善表格输出

- 在 threads、classes、breakpoints 命令中使用表格输出
- 配置表格样式（表头、对齐、边框）
- 支持 JSON 输出时表格自动切换为 JSON 格式
- 手动验证表格输出效果
- 参考: Requirements 7.3

### 6.3 实现命令帮助文档

- 为每个命令编写详细的 Short 和 Long 描述
- 添加使用示例到命令的 Example 字段
- 实现 --help 输出显示可用参数和示例
- 实现主帮助信息列出所有子命令
- 手动验证帮助文档完整性
- 参考: Requirements 2.4, NFR7

### 6.4 完善错误处理

- 实现统一错误类型（APIError）
- 实现错误消息格式化（文本/JSON）
- 实现 verbose 模式显示协议级详细信息
- 实现错误提示和建议（如连接失败时提示检查 JVM 状态）
- 手动测试各错误场景
- 参考: Requirements 8.1-8.5

---

## 阶段 7: 跨平台兼容与配置管理

目标：确保跨平台兼容性，完善配置文件管理。

### 7.1 实现进程发现

- 创建 `internal/platform/process.go` 定义进程发现接口
- 创建 `internal/platform/process_unix.go` 实现 Unix 进程查找
- 创建 `internal/platform/process_windows.go` 实现 Windows 进程查找
- 实现按名称模式查找进程
- 实现附加到运行中进程
- 创建单元测试（mock 进程列表）
- 参考: Requirements 9.3

### 7.2 实现自动检测

- 实现端口特征检测（5005 → JDWP）
- 实现进程特征检测（java 进程 → JDWP）
- 实现检测结果可信度评分
- 实现检测失败时用户提示
- 手动测试自动检测功能
- 参考: Requirements 2.6

### 7.3 实现配置文件管理

- 创建全局配置目录支持（~/.config/debugger/）
- 实现项目配置文件自动发现（.debugger.yaml）
- 实现命名配置文件管理（profiles）
- 实现 CLI 参数覆盖配置文件
- 创建配置验证逻辑
- 手动测试配置加载和覆盖
- 参考: Requirements 6.1-6.6

### 7.4 创建示例配置

- 创建 `configs/example.yaml` 示例配置文件
- 包含常用配置项和注释
- 包含命名 profiles 示例
- 更新 README 添加配置说明
- 参考: Requirements 6.3

---

## 阶段 8: 测试与质量保证

目标：完善测试覆盖，确保功能质量。

### 8.1 完善单元测试

- 为核心组件编写单元测试
  - 协议接口 mock 测试
  - 配置加载测试
  - 格式化器测试
  - 插件注册表测试
- 运行 `go test -cover` 验证覆盖率（目标 80%）
- 修复测试失败和覆盖率不足
- 参考: Requirements 10.1

### 8.2 创建测试固件

- 创建简单 Java 测试应用
  - 包含多个线程
  - 包含断点测试代码
  - 包含单步执行测试代码
- 用于集成测试的真实 JVM 环境
- 参考: Requirements 10.3

### 8.3 实现集成测试

- 实现 JDWP 插件集成测试
  - 连接测试
  - 版本查询测试
  - 线程列表测试
  - 断点设置测试
- 使用 `testing.Short()` 标记跳过长时间测试
- 手动运行集成测试验证
- 参考: Requirements 10.2

### 8.4 实现端到端测试

- 实现完整调试会话测试
  - 连接 → 断点 → 执行 → 检查 → 断开
- 实现 CLI 命令组合测试
- 实现错误场景测试（连接失败、无效参数、协议错误）
- 参考: Requirements 10.4

---

## 阶段 9: 文档完善与发布准备

目标：完善所有文档，准备首个版本发布。

### 9.1 编写 README

- 编写项目简介和特性列表
- 编写快速开始指南
- 编写安装说明（从源码构建、预编译二进制）
- 编写命令速查表
- 编写配置示例和使用场景
- 参考: NFR7, NFR8

### 9.2 编写开发者文档

- 编写架构概述
- 编写插件开发指南（如何实现新协议插件）
- 编写贡献指南（代码规范、提交流程）
- 编写测试指南
- 参考: NFR1, NFR2

### 9.3 最终验证

- 运行所有测试（单元、集成、端到端）
- 检查代码格式（gofmt）
- 运行静态分析（go vet）
- 验证交叉编译所有平台（Windows、macOS、Linux）
- 手动验证所有命令功能
- 参考: Requirements 9.1, 9.4, 9.5

### 9.4 发布准备

- 更新 CHANGELOG.md
- 准备发布说明
- 验证二进制文件可正常运行
- 验证配置文件加载正确
- 参考: NFR9

---

## 任务依赖关系

```
阶段 1: 1.1 → 1.2 → 1.3 → 1.4 → 1.5
                                    ↓
阶段 2: 2.1 → 2.2 → 2.3 → 2.4
                                    ↓
阶段 3: 3.1 → 3.2 → 3.3 → 3.4 → 3.5
                                    ↓
阶段 4: 4.1 → 4.2 → 4.3 → 4.4
                                    ↓
阶段 5: 5.1 → 5.2 → 5.3
                                    ↓
阶段 6: 6.1 → 6.2 → 6.3 → 6.4
                                    ↓
阶段 7: 7.1 → 7.2 → 7.3 → 7.4
                                    ↓
阶段 8: 8.1 → 8.2 → 8.3 → 8.4
                                    ↓
阶段 9: 9.1 → 9.2 → 9.3 → 9.4
```

## 推荐执行顺序

**第一批**（核心基础）: 阶段 1 全部 → 阶段 2 全部 → 阶段 3 的 3.1-3.2

- 完成插件架构和 JDWP 基础
- 验证架构可行性

**第二批**（JDWP 功能）: 阶段 3 的 3.3-3.5 → 阶段 4 全部

- 完成所有 JDWP 调试命令
- 验证核心调试功能

**第三批**（用户体验）: 阶段 5 全部 → 阶段 6 全部 → 阶段 7 全部

- 完善监控模式、输出格式、配置管理
- 完善跨平台兼容

**第四批**（质量保证）: 阶段 8 全部 → 阶段 9 全部

- 完善测试和文档
- 准备发布

每个任务完成后应通过 `go test` 验证相关测试，手动验证 CLI 命令功能。
