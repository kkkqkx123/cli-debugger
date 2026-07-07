# cli-debugger Skills

本目录包含面向 AI Agent 的 cli-debugger 项目开发指南。每个文件聚焦一个主题，帮助 Agent 快速掌握项目结构、协议实现和开发约定。

## 如何使用

AI Agent 在处理 cli-debugger 项目相关任务时，应首先加载本 skills 目录下的对应指南文件。建议按以下顺序阅读：

1. **[architecture.md](architecture.md)** — 项目架构概览（必读）
2. **[dlv-protocol.md](dlv-protocol.md)** — Delve (Go) 协议实现
3. **[jdwp-protocol.md](jdwp-protocol.md)** — JDWP (Java) 协议实现
4. **[lldb-protocol.md](lldb-protocol.md)** — LLDB (C/C++/Rust) 协议实现
5. **[cli-commands.md](cli-commands.md)** — CLI 命令指南
6. **[testing-guide.md](testing-guide.md)** — 测试编写指南
7. **[common-patterns.md](common-patterns.md)** — 常见模式与陷阱

## 快速参考

| 文件 | 内容 | 适用场景 |
|------|------|----------|
| architecture.md | 项目结构、模块依赖、核心接口 `DebugProtocol` | 理解整体架构，添加新协议 |
| dlv-protocol.md | DLV RPC API、JSON-RPC 通信、goroutine/stacktrace/breakpoint | Go 调试相关开发 |
| jdwp-protocol.md | JDWP 包格式、事件机制、断点类型 | Java 调试相关开发 |
| lldb-protocol.md | LLDB Python Bridge、eval 参数结构 | C/C++/Rust 调试相关开发 |
| cli-commands.md | Commander 命令定义、auto-context 模式 | CLI 命令修改或新增 |
| testing-guide.md | Vitest 配置、Mock 模式、RPC 测试陷阱 | 编写或修复测试 |
| common-patterns.md | RPC 返回封装、?? 运算符陷阱、LLDB eval 结构 | 调试疑难问题 |

## 项目状态

- `DebugProtocol` 核心接口：✅ 稳定
- DLV 协议：✅ 完整实现
- JDWP 协议：✅ 完整实现
- LLDB 协议：✅ 完整实现
- DebugPy 协议：🚧 桩实现（未完成）
- js-debug 协议：🚧 桩实现（未完成）

## 快速命令

```bash
npm install          # 安装依赖
npm run build        # 编译
npm test             # 运行所有测试
npm run test:unit    # 仅单元测试
npm run typecheck    # 类型检查
```