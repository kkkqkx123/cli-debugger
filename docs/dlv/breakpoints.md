# Delve 断点管理

## break - 设置断点

在指定位置设置断点，支持命名、多种位置指定方式和条件断点。

### 语法

```
break [name] [locspec] [if <condition>]
```

### 位置说明符 (locspec)

| 格式 | 说明 |
|------|------|
| `<address>` | 内存地址 |
| `<filename>:<line>` | 指定文件的行号 |
| `<line>` | 当前文件的行号 |
| `+<offset>` | 当前行之后的偏移行数 |
| `-<offset>` | 当前行之前的偏移行数 |
| `<function>[:<line>]` | 函数内的行号 |
| `/<regex>/` | 匹配正则表达式的所有函数 |

### 示例

```bash
# 在 main.go 第 4 行设置断点，命名为 mybpname
break mybpname main.go:4

# 条件断点：当 i == 5 时触发
break main.go:55 if i == 5

# 在函数入口设置断点
break main.main

# 使用正则表达式匹配函数
break /main\..*/
```

## breakpoints - 列出断点

打印所有活动断点的信息。

```bash
breakpoints
```

## clear - 删除断点

删除指定的断点。

```bash
clear <breakpoint id>
```

## clearall - 删除多个断点

删除匹配指定位置的所有断点。

```bash
clearall [locspec]
```

## condition - 设置断点条件

为断点、跟踪点或观察点指定条件，仅当布尔表达式为真时才触发。

### 语法

```
# 普通条件
condition <breakpoint name or id> <boolean expression>

# 命中次数条件
condition -hitcount <breakpoint name or id> <operator> <argument>
condition -per-g-hitcount <breakpoint name or id> <operator> <argument>

# 清除条件
condition -clear <breakpoint name or id>
```

### 支持的命中次数运算符

| 运算符 | 说明 |
|--------|------|
| `> n` | 大于 n 次 |
| `>= n` | 大于等于 n 次 |
| `< n` | 小于 n 次 |
| `<= n` | 小于等于 n 次 |
| `== n` | 等于 n 次 |
| `!= n` | 不等于 n 次 |
| `% n` | 每 n 次触发一次 |

### 示例

```bash
# 当 i == 10 时触发断点 2
cond 2 i == 10

# 当协程 ID 为 5 时触发
cond name runtime.curg.goid == 5

# 命中次数超过 5 次后触发
cond -hitcount 2 > 5

# 清除断点 2 的条件
cond -clear 2
```

## on - 断点命中时执行命令

当断点被命中时执行指定的命令。

```bash
on <breakpoint name or id> <command>
```

## toggle - 切换断点状态

切换断点的启用/禁用状态。

```bash
toggle <breakpoint name or id>
```

## trace - 设置跟踪点

跟踪点是一种不会停止程序执行的断点，命中时仅显示通知。

### 语法

```
trace [name] [locspec]
```

### 示例

```bash
# 在当前行设置跟踪点
trace

# 在指定位置设置命名跟踪点
trace mytrace main.go:100
```

## watch - 设置观察点

设置内存观察点，当指定内存位置被读取或写入时触发。

```bash
watch [-r|-w|-rw] <expr>
```

### 选项

| 选项 | 说明 |
|------|------|
| `-r` | 读观察点 |
| `-w` | 写观察点 |
| `-rw` | 读写观察点 |
