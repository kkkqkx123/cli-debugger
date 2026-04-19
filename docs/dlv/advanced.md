# Delve 高级功能

## config - 配置管理

管理 Delve 调试器的配置参数。

### 语法

```
config -list
config -save
config <parameter> <value>
config substitute-path <from> <to>
config substitute-path <from>
config substitute-path -clear
config substitute-path -guess
config alias <command> <alias>
config alias <alias>
config debug-info-directories -add <path>
config debug-info-directories -rm <path>
config debug-info-directories -clear
```

### 示例

```bash
# 列出所有配置
config -list

# 保存配置
config -save

# 设置配置参数
config show-location-regex true

# 添加路径替换（用于远程调试）
config substitute-path /remote/path /local/path

# 删除路径替换
config substitute-path /remote/path

# 清除所有路径替换
config substitute-path -clear

# 自动猜测路径替换
config substitute-path -guess

# 设置命令别名
config alias breakpoints bp

# 删除别名
config alias bp

# 添加调试信息目录
config debug-info-directories -add /path/to/debug/info

# 删除调试信息目录
config debug-info-directories -rm /path/to/debug/info

# 清除调试信息目录
config debug-info-directories -clear
```

## checkpoint - 检查点

检查点允许保存程序状态，稍后可以恢复到该状态。

### 创建检查点

```
checkpoint [note]
```

- `note`：可选的备注，默认为当前文件:行号

### 示例

```bash
# 创建检查点
checkpoint

# 创建带备注的检查点
checkpoint before-loop
```

### 列出检查点

```
checkpoints
```

### 删除检查点

```
clear-checkpoint <id>
```

## disassemble - 反汇编

反汇编代码。

### 语法

```
[goroutine <n>] [frame <m>] disassemble [-a <start> <end>] [-l <locspec>]
```

### 别名

`disass`

### 示例

```bash
# 反汇编当前函数
disassemble

# 反汇编指定地址范围
disassemble -a 0x1000 0x1100

# 反汇编指定函数
disassemble -l main.myFunction

# 在指定协程和栈帧中反汇编
goroutine 3 frame 1 disassemble
```

## dump - 核心转储

从当前进程状态创建核心转储文件。

```bash
dump <output-file>
```

### 示例

```bash
dump core.dump
```

## edit - 打开编辑器

在编辑器中打开当前位置。

```bash
edit
```

使用 `$DELVE_EDITOR` 或 `$EDITOR` 环境变量指定的编辑器。

## list - 显示源代码

显示当前位置或指定位置的源代码。

### 语法

```
list [locspec]
```

### 示例

```bash
# 显示当前位置的源代码
list

# 显示指定位置的源代码
list main.go:50

# 显示指定函数的源代码
list main.myFunction
```

## source - 执行命令文件

执行包含 Delve 命令的文件。

```bash
source <file>
```

### 示例

```bash
source debug-commands.txt
```

## transcript - 记录输出

将命令输出追加到文件。

### 语法

```
transcript [-t] [-x] <output file>
transcript -off
```

### 选项

| 选项 | 说明 |
|------|------|
| `-t` | 如果文件存在则截断 |
| `-x` | 不输出到标准输出 |
| `-off` | 关闭记录功能 |

### 示例

```bash
# 开始记录到文件
transcript debug-log.txt

# 截断现有文件并开始记录
transcript -t debug-log.txt

# 仅记录到文件，不显示在终端
transcript -x debug-log.txt

# 关闭记录
transcript -off
```

## funcs - 列出函数

打印程序中加载的所有函数。

### 语法

```
funcs [<regex>]
```

### 示例

```bash
# 列出所有函数
funcs

# 过滤函数名
funcs main\..*

# 列出特定包的函数
funcs encoding/json\..*
```

## packages - 列出包

打印加载的包列表。

### 语法

```
packages [<regex>]
```

### 示例

```bash
# 列出所有包
packages

# 过滤包名
packages main
```

## sources - 列出源文件

打印源文件列表。

### 语法

```
sources [<regex>]
```

### 示例

```bash
# 列出所有源文件
sources

# 过滤文件名
sources main
```

## types - 列出类型

打印类型列表。

### 语法

```
types [<regex>]
```

### 示例

```bash
# 列出所有类型
types

# 过滤类型名
types main\..*
```

## libraries - 列出动态库

列出当前加载的动态库。

```bash
libraries
```

## target - 管理子进程

管理被调试的子进程。

```bash
target
```

## exit - 退出调试器

退出 Delve 调试器。

```bash
exit
```

### 别名

`quit` 或 `q`
