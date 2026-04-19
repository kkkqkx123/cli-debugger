# Delve 变量和内存检查

## print - 计算表达式

计算并打印表达式的值。

```bash
print <expression>
```

### 示例

```bash
# 打印变量
print myVar

# 打印复杂表达式
print myStruct.field

# 打印指针指向的值
print *myPtr
```

## locals - 打印局部变量

打印当前作用域内的局部变量。

### 语法

```
[goroutine <n>] [frame <m>] locals [-v] [<regex>]
```

### 选项

| 选项 | 说明 |
|------|------|
| `-v` | 显示每个变量的详细信息 |
| `<regex>` | 仅返回名称匹配正则表达式的变量 |

### 示例

```bash
# 打印所有局部变量
locals

# 详细模式
locals -v

# 过滤变量名
locals myPrefix.*

# 在指定协程和栈帧中打印
goroutine 5 frame 2 locals
```

> **注意**：被遮蔽的变量会显示在括号中。

## args - 打印函数参数

打印当前函数的参数。

### 语法

```
[goroutine <n>] [frame <m>] args [-v] [<regex>]
```

### 选项

| 选项 | 说明 |
|------|------|
| `-v` | 显示每个参数的详细信息 |
| `<regex>` | 仅返回名称匹配正则表达式的参数 |

### 示例

```bash
# 打印所有函数参数
args

# 详细模式
args -v

# 过滤参数名
args myArg.*
```

## vars - 打印包变量

打印包级别的变量。

### 语法

```
vars [-v] [<regex>]
```

### 选项

| 选项 | 说明 |
|------|------|
| `-v` | 显示每个变量的详细信息 |
| `<regex>` | 仅返回名称匹配正则表达式的变量 |

### 示例

```bash
# 打印所有包变量
vars

# 详细模式
vars -v

# 过滤变量名
vars main\..*
```

## set - 修改变量值

修改变量的值。仅支持数值类型变量和指针。

### 语法

```
[goroutine <n>] [frame <m>] set <variable> = <value>
```

### 示例

```bash
# 修改变量值
set myVar = 10

# 修改指针指向的值
set *ptr = 20

# 在指定协程和栈帧中修改
goroutine 3 frame 1 set counter = 100
```

## whatis - 打印表达式类型

打印表达式的类型信息。

```bash
whatis <expression>
```

### 示例

```bash
whatis myVar
whatis myStruct.field
```

## display - 自动显示表达式

每次程序停止时自动打印指定表达式的值。

```bash
display -a <expression>
display -d <number>
```

### 选项

| 选项 | 说明 |
|------|------|
| `-a` | 添加表达式到显示列表 |
| `-d` | 从显示列表中删除指定编号的表达式 |

## examinemem - 检查内存

检查指定地址的原始内存内容。别名为 `x`。

### 语法

```
examinemem [-fmt <format>] [-count|-len <count>] [-size <size>] <address>
examinemem [-fmt <format>] [-count|-len <count>] [-size <size>] -x <expression>
```

### 选项

| 选项 | 说明 |
|------|------|
| `-fmt` | 输出格式：binary, octal, decimal, hex, raw |
| `-count` / `-len` | 显示的字节数 |
| `-size` | 每个元素的大小 |
| `-x` | 使用表达式计算地址 |

### 示例

```bash
# 检查指定地址的内存
x -fmt hex -count 20 -size 1 0xc00008af38

# 使用表达式指定地址
x -fmt hex -count 20 -size 1 -x &myVar

# 指针变量
x -fmt hex -count 20 -size 1 -x myPtrVar

# 地址偏移
x -fmt hex -count 20 -size 1 -x 0xc00008af38 + 8
```

## regs - 打印寄存器

打印 CPU 寄存器的内容。

```bash
regs
```
