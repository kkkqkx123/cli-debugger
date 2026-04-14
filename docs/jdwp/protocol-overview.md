# JDWP 协议概述

## 什么是 JDWP？

JDWP (Java Debug Wire Protocol) 是 Java 调试器与目标 JVM 之间的通信协议。它定义了调试器可以发送的命令以及 JVM 返回的响应格式。

## 协议架构

```
调试器 (Debugger) <--Socket--> 目标 JVM (Target JVM)
```

JDWP 是一个**二进制协议**，通过 Socket 进行通信。协议本身不依赖任何 IDE，可以纯代码实现。

## 核心概念

### 1. 命令集 (Command Set)

JDWP 命令按功能分组为命令集，每个命令集包含多个命令：

| 命令集 ID | 名称                | 用途                           |
| --------- | ------------------- | ------------------------------ |
| 1         | VirtualMachine      | 虚拟机级操作                   |
| 2         | ReferenceType       | 类/接口/数组类型信息           |
| 3         | ClassType           | 类类型专用命令                 |
| 4         | ArrayType           | 数组类型命令                   |
| 6         | Method              | 方法信息                       |
| 9         | ObjectReference     | 对象操作                       |
| 10        | StringReference     | 字符串操作                     |
| 11        | ThreadReference     | 线程操作                       |
| 13        | ArrayReference      | 数组操作                       |
| 14        | ClassLoaderReference | 类加载器操作                  |
| 15        | EventRequest        | 事件订阅（断点、单步等）       |
| 16        | StackFrame          | 栈帧操作                       |
| 18        | ModuleReference     | 模块操作                       |
| 64        | Event               | 事件复合包（JVM 主动发送）     |

### 2. 数据包格式

#### 命令包 (Command Packet)

```
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+-------+
| Length (4 bytes) |   ID (4 bytes)   | Flags  | CommandSet | Command |         Data                  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+-------+
```

- **Length**: 整个包的长度（4 字节，big-endian）
- **ID**: 包的唯一标识符，用于匹配请求和响应（4 字节）
- **Flags**: 标志位，0x00 表示命令包，0x80 表示应答包
- **CommandSet**: 命令集 ID（1 字节）
- **Command**: 命令 ID（1 字节）
- **Data**: 命令数据（可选）

#### 应答包 (Reply Packet)

```
+--------+--------+--------+--------+--------+--------+--------+--------+-------+
| Length (4 bytes) |   ID (4 bytes)   | Flags  | ErrorCode (2 bytes) |    Data   |
+--------+--------+--------+--------+--------+--------+--------+--------+-------+
```

- **ErrorCode**: 错误码，0 表示成功，非 0 表示失败

### 3. ID 类型

JDWP 使用多种 ID 类型来标识 JVM 中的实体：

| ID 类型           | 说明                     |
| ----------------- | ------------------------ |
| objectID          | 对象实例的唯一标识       |
| referenceTypeID   | 类/接口/数组类型的标识   |
| methodID          | 方法的唯一标识           |
| fieldID           | 字段的唯一标识           |
| frameID           | 栈帧的唯一标识           |
| threadID          | 线程的唯一标识           |

ID 的大小通过 `VirtualMachine.IDSizes` 命令获取，通常是 4 或 8 字节。

## 线程状态

### ThreadStatus

| 值 | 状态名              | 说明                     |
| -- | ------------------- | ------------------------ |
| 1  | ZOMBIE              | 线程已完成执行           |
| 2  | RUNNING             | 线程正在运行             |
| 3  | SLEEPING            | 线程正在休眠 (Thread.sleep) |
| 4  | MONITOR             | 线程等待获取监视器锁     |
| 5  | WAIT                | 线程在 Object.wait 中等待 |
| 6  | NOT_STARTED         | 线程尚未启动             |

### SuspendStatus

| 值 | 说明           |
| -- | -------------- |
| 0  | 线程未挂起     |
| 1  | 线程已挂起     |

**重要**: 线程可以同时处于多种状态。例如，一个线程可以是 RUNNING 状态但被挂起 (suspendStatus = 1)。

## 挂起机制

### VM 级别挂起 vs 线程级别挂起

JDWP 提供两种挂起机制：

1. **VM 级别挂起** (`VirtualMachine.Suspend`)
   - 挂起整个虚拟机
   - 所有线程都停止执行
   - 用于获取一致的 VM 状态快照

2. **线程级别挂起** (`ThreadReference.Suspend`)
   - 挂起单个线程
   - 其他线程继续执行
   - 用于调试特定线程

### 挂起计数

JDWP 使用**挂起计数**机制：
- 每次调用 `suspend()` 增加计数
- 每次调用 `resume()` 减少计数
- 只有当计数归零时，线程才真正恢复执行

这意味着：
- 多次 suspend 需要相同次数的 resume 才能恢复
- 可以通过 `ThreadReference.SuspendCount` 查询当前计数

### 获取栈帧的前提条件

**关键**: 要获取线程的栈帧信息，线程**必须处于挂起状态**。

根据 JDWP 规范：
- `ThreadReference.Frames` 命令要求线程被挂起
- 如果线程未挂起，将返回 `THREAD_NOT_SUSPENDED` 错误 (错误码 503)
- 栈帧信息只有在线程暂停时才是稳定的

## 事件机制

### 事件类型

| 事件类型 ID | 名称              | 说明                     |
| ----------- | ----------------- | ------------------------ |
| 1           | VM_START          | VM 启动                  |
| 2           | VM_DEATH          | VM 终止                  |
| 3           | THREAD_START      | 线程启动                 |
| 4           | THREAD_DEATH      | 线程终止                 |
| 5           | CLASS_LOAD        | 类加载                   |
| 6           | CLASS_UNLOAD      | 类卸载                   |
| 7           | CLASS_PREPARE     | 类准备完成               |
| 8           | FIELD_ACCESS      | 字段访问                 |
| 9           | FIELD_MODIFICATION| 字段修改                 |
| 10          | BREAKPOINT        | 断点命中                 |
| 11          | STEP              | 单步执行                 |
| 12          | METHOD_ENTRY      | 方法进入                 |
| 13          | METHOD_EXIT       | 方法退出                 |
| 14          | EXCEPTION         | 异常抛出                 |

### 挂起策略 (SuspendPolicy)

当事件发生时，可以指定挂起策略：

| 值 | 策略名      | 说明                           |
| -- | ----------- | ------------------------------ |
| 0  | NONE        | 不挂起任何线程                 |
| 1  | EVENT_THREAD| 只挂起事件发生的线程           |
| 2  | ALL         | 挂起所有线程                   |

## 握手协议

连接建立后，调试器和 JVM 需要进行握手：

1. 调试器发送: `JDWP-Handshake`
2. JVM 回复: `JDWP-Handshake`

握手成功后，才能开始发送 JDWP 命令。

## 常见错误码

| 错误码 | 名称                  | 说明                     |
| ------ | --------------------- | ------------------------ |
| 0      | NONE                  | 成功                     |
| 20     | INVALID_THREAD_GROUP  | 无效的线程组             |
| 50     | INVALID_CLASS         | 无效的类                 |
| 51     | INVALID_FIELDID       | 无效的字段 ID            |
| 52     | INVALID_METHODID      | 无效的方法 ID            |
| 60     | INVALID_OBJECT        | 无效的对象               |
| 61     | INVALID_CLASS_LOADER  | 无效的类加载器           |
| 62     | INVALID_ARRAY         | 无效的数组               |
| 63     | INVALID_THREAD        | 无效的线程               |
| 99     | NOT_IMPLEMENTED       | 命令未实现               |
| 100    | VM_DEAD               | VM 已终止                |
| 101    | INTERNAL              | 内部错误                 |
| 503    | THREAD_NOT_SUSPENDED  | 线程未挂起               |
| 504    | THREAD_SUSPENDED      | 线程已挂起               |

## 参考资源

- [JDWP Specification](https://docs.oracle.com/javase/specs/jvms/se11/html/jvms-4.html)
- [JPDA (Java Platform Debugger Architecture)](https://docs.oracle.com/javase/11/docs/api/jdk.jdi/module-summary.html)
- [JDI (Java Debug Interface)](https://docs.oracle.com/javase/11/docs/api/jdk.jdi/com/sun/jdi/package-summary.html)
