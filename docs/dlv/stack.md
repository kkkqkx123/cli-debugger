# Delve 调用栈操作

## stack - 打印栈跟踪

打印当前或指定协程的栈跟踪。

### 语法

```
[goroutine <n>] [frame <m>] stack [<depth>] [-full] [-offsets] [-defer] [-a <n>] [-adepth <depth>] [-mode <mode>]
```

### 选项

| 选项 | 说明 |
|------|------|
| `<depth>` | 栈跟踪深度 |
| `-full` | 显示完整的变量详情 |
| `-offsets` | 显示帧偏移量 |
| `-defer` | 显示延迟调用 |
| `-a <n>` | 显示祖先栈跟踪 |
| `-adepth <depth>` | 祖先栈跟踪深度 |
| `-mode <mode>` | 栈跟踪模式 |

### 示例

```bash
# 打印当前栈跟踪
stack

# 指定深度
stack 20

# 显示完整变量信息
stack -full

# 显示帧偏移量
stack -offsets

# 显示延迟调用
stack -defer

# 在指定协程中打印栈跟踪
goroutine 5 stack

# 显示祖先栈跟踪
stack -a 1
```

## frame - 设置当前栈帧

设置当前栈帧，或在指定栈帧上执行命令。

### 语法

```
frame <m>
frame <m> <command>
```

### 示例

```bash
# 切换到栈帧 2
frame 2

# 在栈帧 2 中打印局部变量
frame 2 locals

# 在栈帧 3 中打印参数
frame 3 args
```

## up - 向上移动栈帧

向上移动当前栈帧（向调用者方向）。

### 语法

```
up [<m>]
up [<m>] <command>
```

### 示例

```bash
# 向上移动一帧
up

# 向上移动两帧
up 2

# 向上移动一帧并打印局部变量
up locals
```

## down - 向下移动栈帧

向下移动当前栈帧（向被调用者方向）。

### 语法

```
down [<m>]
down [<m>] <command>
```

### 示例

```bash
# 向下一帧
down

# 向下移动两帧
down 2

# 向下移动一帧并打印局部变量
down locals
```

## deferred - 延迟调用上下文

在延迟调用的上下文中执行命令。

### 语法

```
deferred <n> <command>
```

### 说明

Go 语言的 `defer` 语句会在函数返回时执行。此命令允许在延迟调用的上下文中检查变量。

### 示例

```bash
# 在第一个延迟调用中打印局部变量
deferred 0 locals

# 在第二个延迟调用中打印参数
deferred 1 args

# 在延迟调用中打印表达式
deferred 0 print myVar
```

## 栈帧编号说明

- 栈帧编号从 0 开始
- 栈帧 0 是当前正在执行的函数
- 栈帧 1 是调用当前函数的函数
- 以此类推

## 调用栈导航流程

```
栈帧 3 (main.main)
    ↓ 调用
栈帧 2 (helper.function)
    ↓ 调用
栈帧 1 (worker.process)
    ↓ 调用
栈帧 0 (current.function)  ← 当前位置
```

使用 `up` 向栈帧 1、2、3 方向移动（向调用者）
使用 `down` 向栈帧 0 方向移动（向被调用者）
