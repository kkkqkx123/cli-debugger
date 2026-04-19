# Delve 线程和协程管理

Go 语言有独特的并发模型，Delve 提供了对操作系统线程和 Go 协程（goroutine）的完整支持。

## goroutine - 协程操作

显示当前协程信息、切换协程或在指定协程上下文中执行命令。

### 语法

```
goroutine
goroutine <id>
goroutine <id> <command>
```

### 别名

`gr`

### 示例

```bash
# 显示当前协程信息
goroutine

# 切换到协程 5
goroutine 5

# 在协程 5 的上下文中打印局部变量
goroutine 5 locals

# 在协程 5 的上下文中打印栈跟踪
goroutine 5 stack
```

## goroutines - 列出协程

列出程序中的所有协程，支持多种过滤、分组和执行选项。

### 语法

```
goroutines [-u|-r|-g|-s] [-t [depth]] [-l] [-with loc expr] [-without loc expr] [-group argument] [-chan expr] [-exec command]
```

### 别名

`grs`

### 显示选项

| 选项 | 说明 |
|------|------|
| `-u` | 显示用户代码中顶层栈帧的位置（默认） |
| `-r` | 显示顶层栈帧的位置（包括私有运行时函数） |
| `-g` | 显示创建协程的 go 指令位置 |
| `-s` | 显示启动函数的位置 |
| `-t [depth]` | 显示协程的栈跟踪（可选深度，默认 10） |
| `-l` | 显示协程的标签 |

### 过滤选项

| 选项 | 说明 |
|------|------|
| `-with (userloc\|curloc\|goloc\|startloc) expr` | 过滤位置包含 expr 的协程 |
| `-without (userloc\|curloc\|goloc\|startloc) expr` | 过滤位置不包含 expr 的协程 |
| `-with label key=value` | 过滤具有指定标签键值对的协程 |
| `-without label key=value` | 过滤不具有指定标签键值对的协程 |
| `-with label key` | 过滤具有指定标签键的协程 |
| `-without label key` | 过滤不具有指定标签键的协程 |
| `-with running` | 过滤正在 OS 线程上运行的协程 |
| `-without running` | 过滤不在 OS 线程上运行的协程 |
| `-with user` | 过滤用户协程 |
| `-without user` | 过滤运行时协程 |

### 分组选项

| 选项 | 说明 |
|------|------|
| `-group (userloc\|curloc\|goloc\|startloc\|running\|user)` | 按指定条件分组协程 |
| `-group label key` | 按指定标签键的值分组协程 |

### 其他选项

| 选项 | 说明 |
|------|------|
| `-chan expr` | 显示在指定通道上等待的协程（表达式不能包含空格） |
| `-exec <command>` | 在每个协程上执行指定命令 |

### 示例

```bash
# 列出所有协程
goroutines

# 显示协程的栈跟踪
goroutines -t

# 显示协程的标签
goroutines -l

# 过滤用户协程
goroutines -with user

# 过滤正在运行的协程
goroutines -with running

# 过滤位置包含 "main" 的协程
goroutines -with userloc main

# 按用户位置分组
goroutines -group userloc

# 在每个协程上执行命令
goroutines -exec locals

# 显示在通道上等待的协程
goroutines -chan myChannel
```

## thread - 切换线程

切换调试器上下文到指定的操作系统线程。

### 语法

```
thread <id>
```

### 别名

`tr`

### 示例

```bash
# 切换到线程 3
thread 3
```

## threads - 列出线程

打印所有被跟踪线程的信息。

```bash
threads
```

## 协程与线程的关系

- **协程（Goroutine）**：Go 语言的轻量级并发单元，由 Go 运行时调度
- **线程（Thread）**：操作系统线程，协程在其上执行
- 一个线程可能执行多个协程（通过调度）
- 一个协程在任意时刻只在一个线程上运行

### 调试建议

1. 大多数情况下使用 `goroutine` 和 `goroutines` 命令
2. 仅在需要调试运行时调度问题时使用 `thread` 和 `threads`
3. 使用 `goroutines -t` 可以快速定位协程阻塞位置
4. 使用 `goroutines -group` 可以分析协程分布情况
