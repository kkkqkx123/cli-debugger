# CLI 命令指南

## 概述

CLI 使用 **Commander** 库实现，入口在 `src/cli/index.ts`。二进制名称为 `dap`。

## 全局选项

```
--json              JSON 输出格式
--context-lines N   源代码上下文行数（默认 5）
--session <id>      使用指定会话 ID
```

## 命令列表

### `dap debug` — 启动调试会话

```
dap debug [protocol] [args...]
  -H, --host <host>         调试适配器主机（默认 127.0.0.1）
  -p, --port <port>         调试适配器端口（默认 5005）
  -t, --timeout <ms>        连接超时（默认 30000）
  -e, --break-on-exception  设置异常断点
  --program <path>          程序/二进制路径（自动检测协议）
  --attach <host:port>      远程附加到适配器
  --pid <pid>               附加到进程 PID
```

协议自动检测规则（基于 --program 扩展名）：

| 扩展名 | 协议 |
|--------|------|
| `.go` | dlv |
| `.java`, `.class`, `.jar` | jdwp |
| `.py` | debugpy |
| `.js`, `.ts`, `.mjs`, `.cjs` | js-debug |
| 无扩展名, `.out`, `.bin`, `.exe` | lldb |

### `dap stop` — 停止会话

```
dap stop [session-id]
```

### `dap restart` — 重启会话（保留断点）

```
dap restart [session-id]
```

### `dap sessions` — 列出所有会话

```
dap sessions
```

### `dap step` — 单步执行

```
dap step [direction] [thread-id]
  direction: in, out, over（默认 over）
```

### `dap continue` — 继续执行

```
dap continue [thread-id]
  --to <location>  运行到指定位置（file:line）
```

### `dap pause` — 暂停执行

```
dap pause [thread-id]
```

### `dap break` — 断点管理

```
dap break list|ls           列出断点
dap break add <location>    添加断点
  --type <type>             类型: line, exception, method-entry, method-exit
dap break remove|rm <id>    删除断点
dap break clear             清除所有断点
```

### `dap context` — 显示调试上下文

```
dap context [thread-id]
  -l, --lines <number>  上下文行数
```

### `dap eval` — 求值表达式

```
dap eval <expression> [thread-id]
  --frame <index>  栈帧索引（默认 0）
```

### `dap inspect` — 检查变量

```
dap inspect <variable> [thread-id]
  --depth <number>   检查深度（默认 1）
  --frame <index>    栈帧索引（默认 0）
```

### `dap threads` — 列出线程

```
dap threads
```

### `dap thread` — 切换线程

```
dap thread <id>
```

### `dap output` — 刷新缓冲输出

```
dap output
  -t, --timeout <ms>  等待超时（默认 500）
  -f, --follow        持续跟踪输出（Ctrl+C 停止）
```

## Auto-Context 模式

每次执行变异命令（debug, step, continue, pause, break add, break remove 等）后，CLI 自动输出当前上下文：

- 当前线程信息
- 当前位置（文件:行号）
- 源代码上下文（当前行前后若干行）
- 局部变量
- 调用栈
- 活动线程列表
- 断点列表

## 输出格式化

两种输出模式：

- `text`（默认）：表格和文本格式
- `json`（`--json` 标志）：JSON 格式，适合程序化处理

## 实现要点

- `SessionManager` 是全局单例，管理多会话
- `requireClient()` 检查当前会话是否存在
- `resolveThreadId()` 自动解析线程 ID（优先使用活跃线程）
- `detectProtocol()` 根据文件扩展名自动检测协议
- `readSourceContext()` 读取源代码文件显示上下文
- `buildAutoContext()` 收集当前调试状态