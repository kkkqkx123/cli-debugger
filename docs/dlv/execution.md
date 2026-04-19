# Delve 执行控制

## continue - 继续执行

恢复程序执行，直到遇到断点或程序终止。

### 语法

```
continue [<locspec>]
```

### 别名

`c`

### 示例

```bash
# 继续执行直到下一个断点
continue

# 继续执行直到到达指定位置
continue main.main

# 继续执行直到到达指定函数
continue encoding/json.Marshal
```

## next - 单步跳过

执行下一行源代码，跳过函数调用（不进入函数内部）。

### 语法

```
next [count]
```

### 别名

`n`

### 示例

```bash
# 执行下一行
next

# 跳过多行
next 5
```

## step - 单步进入

单步执行，进入函数调用内部。

### 语法

```
step
```

### 别名

`s`

### 示例

```bash
step
```

## stepout - 单步跳出

执行直到当前函数返回，回到调用者。

### 语法

```
stepout
```

### 别名

`so`

### 示例

```bash
stepout
```

## next-instruction - 指令级单步跳过

单步执行一条 CPU 指令，跳过函数调用。

```bash
next-instruction
```

## step-instruction - 指令级单步

单步执行一条 CPU 指令。

```bash
step-instruction
```

## restart - 重启程序

重启被调试的进程。

```bash
restart
```

## rebuild - 重新构建

重新构建目标可执行文件并重启。仅适用于由 Delve 构建的可执行文件。

```bash
rebuild
```

## rewind - 反向执行

反向运行程序，直到遇到断点或历史记录的起点。需要录制模式支持。

```bash
rewind
```

## rev - 反向执行命令

反向执行指定的命令。需要录制模式支持。

```bash
rev <command>
```

## call - 注入函数调用

恢复进程执行并注入函数调用（实验性功能）。

### 语法

```
call <function(args...)>
```

### 示例

```bash
# 调用函数
call myFunction(1, 2)

# 调用方法
call obj.Method()
```

> **警告**：此功能为实验性功能，可能导致不可预期的行为。

## 执行控制 API

Delve 提供了 RPC API 用于程序执行控制：

| 命令名称 | 说明 |
|----------|------|
| `halt` | 停止被调试进程的执行 |
| `continue` | 恢复被调试进程的执行 |
| `next` | 继续执行到下一行（在选中的协程上操作） |
| `stepout` | 继续执行直到函数返回（在选中的协程上操作） |
| `step` | 单步进入函数调用（跳过未导出的运行时函数） |
| `switchGoroutine` | 切换选中的协程 |
