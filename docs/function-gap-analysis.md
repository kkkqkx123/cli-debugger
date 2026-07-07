# cli-debugger 功能差距分析报告

> 参考项目: [debug-skill](https://github.com/AlmogBaku/debug-skill) (Go-based DAP CLI Debugger)
> 目标项目: [cli-debugger](https://github.com/kkkqkx123/cli-debugger) (TypeScript Multi-language Debugging CLI)

## 1. 概述

本报告对比分析 `cli-debugger` 与 `debug-skill` 的功能差异，找出 `cli-debugger` 需要补充的功能。`debug-skill` 是一个成熟的 DAP 调试 CLI 工具，而 `cli-debugger` 目前处于早期开发阶段，核心接口和部分协议实现已完成，但缺少完整的 CLI 层、会话管理和许多调试功能。

---

## 2. 项目架构对比

| 维度 | debug-skill (参考) | cli-debugger (现状) |
|------|-------------------|---------------------|
| 语言 | Go | TypeScript |
| 架构 | Daemon + CLI (cobra) | 插件化协议库 |
| 通信 | Unix Socket IPC (length-prefixed JSON) | 直接 TCP 连接 |
| 调试协议 | DAP (Debug Adapter Protocol) - 统一协议 | DLV / JDWP / LLDB - 各自协议 |
| 部署 | 独立二进制 (dap CLI) | npm 包 |
| 成熟度 | 生产可用 | 早期开发 (v0.1.0) |

---

## 3. 功能完整对比

### 3.1 CLI 命令层

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| CLI 入口 (`dap debug`) | ✅ cobra 完整 CLI | ❌ 无 CLI 层 | 缺少 |
| 多命令子命令系统 | ✅ 14 个子命令 | ❌ 无 | 缺少 |
| --json 输出模式 | ✅ | ❌ | 缺少 |
| --session 多会话隔离 | ✅ | ❌ | 缺少 |
| --context-lines 控制 | ✅ | ❌ | 缺少 |
| 全局 --help / 各子命令帮助 | ✅ | ❌ | 缺少 |

### 3.2 调试会话生命周期

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| 启动调试会话 (`dap debug`) | ✅ | ❌ | 缺少 |
| 结束会话 (`dap stop`) | ✅ | ❌ | 缺少 |
| 重启会话保留断点 (`dap restart`) | ✅ | ❌ | 缺少 |
| Daemon 自动启动 | ✅ 自动 fork 后台进程 | ❌ | 缺少 |
| Daemon 空闲超时自动退出 | ✅ 10 min idle timeout | ❌ | 缺少 |
| Unix Socket IPC | ✅ 长度前缀 JSON | ❌ | 缺少 |

### 3.3 执行控制

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| Step Over | ✅ `dap step` | ⚡ 接口定义 (stepOver) | 未实现 CLI |
| Step Into | ✅ `dap step in` | ⚡ 接口定义 (stepInto) | 未实现 CLI |
| Step Out | ✅ `dap step out` | ⚡ 接口定义 (stepOut) | 未实现 CLI |
| Continue | ✅ `dap continue` | ⚡ 接口定义 (resume) | 未实现 CLI |
| Continue --to (临时断点) | ✅ | ❌ | 缺少 |
| Pause (中断运行中程序) | ✅ `dap pause` | ⚡ 接口定义 (suspend) | 未实现 CLI |
| 程序参数传递 (--) | ✅ | ❌ | 缺少 |

### 3.4 断点管理

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| 设置断点 (file:line) | ✅ | ⚡ 接口定义 | 未实现 CLI |
| 条件断点 (file:line:condition) | ✅ | ⚡ 接口定义 | 未实现 CLI |
| 异常断点 (--break-on-exception) | ✅ | ❌ | 缺少 |
| 断点列表 | ✅ `dap break list` | ⚡ 接口定义 | 未实现 CLI |
| 断点添加 | ✅ `dap break add` | ❌ | 缺少 |
| 断点删除 | ✅ `dap break remove` | ⚡ 接口定义 | 未实现 CLI |
| 清空断点 | ✅ `dap break clear` | ⚡ 接口定义 | 未实现 CLI |
| 中途添加/删除断点 | ✅ continue/step 时可同时操作 | ❌ | 缺少 |

### 3.5 状态检查与表达式

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| 获取上下文 (`dap context`) | ✅ | ❌ | 缺少 |
| 表达式求值 (`dap eval`) | ✅ | ❌ | 缺少 |
| 变量检查 (`dap inspect --depth N`) | ✅ | ❌ | 缺少 |
| 获取局部变量 | ✅ 自动包含在上下文中 | ⚡ 接口定义 | 未实现 CLI |
| 切换栈帧 (--frame) | ✅ | ❌ | 缺少 |
| 源码上下文展示 | ✅ 自动返回 | ❌ | 缺少 |
| 调用栈展示 | ✅ 自动返回 | ⚡ 接口定义 | 未实现 CLI |

### 3.6 输出管理

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| 输出排空 (`dap output`) | ✅ 缓冲 stdout/stderr | ❌ | 缺少 |
| 输出截断策略 | ✅ 200 行上限, 5 个元素预览 | ❌ | 缺少 |

### 3.7 线程管理

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| 线程列表 (`dap threads`) | ✅ | ⚡ 接口定义 | 未实现 CLI |
| 切换线程 (`dap thread <id>`) | ✅ | ⚡ 接口定义 | 未实现 CLI |
| 当前线程标记 | ✅ * 标记 | ❌ | 缺少 |

### 3.8 调试后端支持

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| Python (debugpy) | ✅ 完整实现 | ❌ 不支持 | 缺少 |
| Go (dlv/delve) | ✅ 完整实现, 含源码预编译 | ⚡ 部分实现 | 不完整 |
| Node.js/TypeScript (js-debug) | ✅ 完整实现 | ❌ 不支持 | 缺少 |
| Rust/C/C++ (lldb-dap) | ✅ 完整实现, 含源码预编译 | ⚡ 部分实现 | 不完整 |
| Java (JDWP) | ❌ 不支持 | ⚡ 部分实现 | N/A |
| 后端自动检测 | ✅ 文件扩展名自动判断 | ❌ | 缺少 |
| Remote Attach | ✅ `--attach host:port` | ❌ | 缺少 |
| PID Attach | ✅ `--pid <PID>` | ❌ | 缺少 |

### 3.9 Auto-Context (自动上下文)

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| 执行命令后自动返回完整上下文 | ✅ | ❌ | 缺少 |
| 包含位置信息 | ✅ file, line, function | ❌ | 缺少 |
| 包含源码上下文 | ✅ 当前行前后 N 行 | ❌ | 缺少 |
| 包含局部变量 | ✅ 名称 + 类型 + 值 + 长度 | ❌ | 缺少 |
| 包含调用栈 | ✅ 帧索引 + 函数 + 文件 + 行号 | ❌ | 缺少 |
| 包含程序输出 | ✅ | ❌ | 缺少 |
| JSON 格式输出 | ✅ | ❌ | 缺少 |

### 3.10 安装与部署

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| 一键安装脚本 | ✅ install-dap.sh | ❌ | 缺少 |
| Homebrew 安装 | ✅ | ❌ | 缺少 |
| GitHub Actions CI/CD | ✅ release.yml | ❌ | 缺少 |
| Makefile 构建 | ✅ | ❌ | 缺少 |

### 3.11 AI Agent 集成

| 功能 | debug-skill | cli-debugger | 差距 |
|------|:-----------:|:------------:|:----:|
| SKILL.md 技能定义 | ✅ | ❌ | 缺少 |
| 调试方法论文档 | ✅ | ❌ | 缺少 |
| Architecture 文档 | ✅ claudedocs/design.md | ❌ | 缺少 |
| 多 Agent 会话隔离 | ✅ --session | ❌ | 缺少 |

---

## 4. 需要补充的核心功能清单

按优先级从高到低排列：

### P0 - 必须实现 (核心缺失)

1. **CLI 命令行层**
   - 基于 commander 实现完整 CLI 子命令系统
   - 全局 flags: --json, --session, --socket, --context-lines
   - 各子命令的 --help 文档

2. **调试会话生命周期管理**
   - `debug` - 启动调试会话
   - `stop` - 结束会话, 清理资源
   - `restart` - 重启会话保留断点
   - Daemon 后台进程 + Unix Socket IPC

3. **执行控制命令**
   - `step [in|out|over]` - 单步执行
   - `continue` - 继续执行
   - `continue --to file:line` - 执行到指定行
   - `pause` - 暂停运行中的程序

4. **断点管理 CLI**
   - `break list` - 列出断点
   - `break add file:line[:condition]` - 添加断点
   - `break remove file:line` - 删除断点
   - `break clear` - 清空断点
   - 条件断点支持
   - 异常断点支持

5. **状态检查**
   - `context` - 获取当前上下文
   - `eval <expr>` - 表达式求值
   - `inspect <var> [--depth N]` - 变量检查

6. **线程管理**
   - `threads` - 列出线程
   - `thread <id>` - 切换线程

7. **输出管理**
   - `output` - 排空缓冲输出
   - 输出截断策略

8. **Auto-Context 模式**
   - 执行命令自动返回完整上下文
   - 结构化输出 (JSON)

### P1 - 重要功能

9. **调试后端完整实现**
   - DLV 后端: 完成所有 API 实现, 支持源码预编译
   - LLDB 后端: 完善 bridge 集成
   - 新增 debugpy 后端
   - 新增 js-debug 后端
   - 后端自动检测 (文件扩展名)

10. **远程调试**
    - `--attach host:port` 远程连接
    - `--pid <PID>` 进程附加

11. **多会话支持**
    - `--session <name>` 会话隔离
    - 独立 daemon 进程

### P2 - 增强功能

12. **安装与部署**
    - 安装脚本
    - GitHub Actions 构建与发布
    - Makefile

13. **AI Agent 集成**
    - SKILL.md / skill.json 定义
    - 调试方法论文档
    - Architecture 文档

14. **测试覆盖**
    - 单元测试完善
    - 集成测试 (端到端调试流程)
    - E2E 测试

---

## 5. 具体实现建议

### 5.1 架构演进建议

```
当前架构 (库模式):
  Node.js 应用 → DebugProtocol (TypeScript) → TCP → Debugger Backend (DLV/JDWP/LLDB)

目标架构 (Daemon + CLI 模式):
  CLI (commander) → Unix Socket IPC → Daemon (后台进程) → DAP Protocol → Debug Adapter (debugpy/dlv/js-debug/lldb-dap)
```

### 5.2 技术选型建议

| 组件 | 建议选型 | 说明 |
|------|---------|------|
| CLI 框架 | commander (已在依赖中) | 已引入 commander@14 |
| IPC 通信 | Unix Socket + 长度前缀 JSON | 参考 debug-skill 设计 |
| 输出格式化 | chalk (已在依赖中) | 支持彩色输出 |
| 协议实现 | DAP (Debug Adapter Protocol) | 统一调试协议, 替代各自为政 |

### 5.3 文件结构建议

```
cli-debugger/
├── src/
│   ├── index.ts              # CLI 入口 + 应用启动
│   ├── cli/                  # CLI 命令层 (新建)
│   │   ├── index.ts          # 根命令
│   │   ├── debug.ts          # debug 子命令
│   │   ├── step.ts           # step 子命令
│   │   ├── continue.ts       # continue 子命令
│   │   ├── break.ts          # break 子命令组
│   │   ├── eval.ts           # eval 子命令
│   │   ├── inspect.ts        # inspect 子命令
│   │   ├── context.ts        # context 子命令
│   │   ├── threads.ts        # threads 子命令
│   │   ├── thread.ts         # thread 子命令
│   │   ├── pause.ts          # pause 子命令
│   │   ├── output.ts         # output 子命令
│   │   ├── restart.ts        # restart 子命令
│   │   └── stop.ts           # stop 子命令
│   ├── daemon/               # Daemon 进程 (新建)
│   │   ├── index.ts          # Daemon 入口
│   │   ├── session.ts        # 会话管理
│   │   ├── ipc.ts            # IPC 协议
│   │   └── timeout.ts        # 空闲超时
│   ├── protocol/             # 协议层 (已有)
│   │   └── ...               # 保留并扩展
│   ├── types/                # 类型定义 (已有)
│   ├── output/               # 输出格式化 (已有)
│   ├── monitor/              # 监控模块 (已有)
│   └── platform/             # 平台适配 (已有)
├── skills/                   # AI Agent 技能定义 (新建)
│   └── debugging-code/
│       ├── SKILL.md
│       └── skill.json
├── scripts/                  # 安装脚本 (新建)
│   └── install-dap.sh
├── docs/                     # 文档
├── Makefile                  # 构建系统 (新建)
└── .github/                  # CI/CD (新建)
    └── workflows/
        └── release.yml
```

---

## 6. 总结

`cli-debugger` 拥有良好的插件化架构设计和清晰的核心接口定义, 但目前缺乏一个完整的调试工具所必需的 CLI 层、会话管理和丰富的调试功能。参考 `debug-skill` 的设计, 建议按照以下阶段实施：

- **第一阶段**: 实现 CLI 层 + Daemon 架构 + 核心调试命令 (debug/step/continue/stop)
- **第二阶段**: 完善断点管理 + 状态检查 + 线程管理 + Auto-Context
- **第三阶段**: 完整后端支持 + 远程调试 + 多会话 + 部署自动化
- **第四阶段**: AI Agent 集成 + 测试覆盖 + 文档完善