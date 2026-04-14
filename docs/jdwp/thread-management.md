# JDWP 线程管理

## 线程生命周期

```
NOT_STARTED -> RUNNING -> ZOMBIE
                 |
                 v
              SLEEPING
                 |
                 v
              MONITOR/WAIT
```

## 线程状态详解

### ThreadStatus 枚举

| 值 | 状态名      | 说明                                       |
| -- | ----------- | ------------------------------------------ |
| 1  | ZOMBIE      | 线程已完成执行，不可恢复                   |
| 2  | RUNNING     | 线程正在运行或可运行                       |
| 3  | SLEEPING    | 线程调用了 Thread.sleep()                  |
| 4  | MONITOR     | 线程等待获取监视器锁 (synchronized 块入口) |
| 5  | WAIT        | 线程调用了 Object.wait()                   |
| 6  | NOT_STARTED | 线程已创建但尚未调用 start()               |

### 状态转换

```
NOT_STARTED --start()--> RUNNING
RUNNING --sleep()--> SLEEPING --timeout/interrupt--> RUNNING
RUNNING --synchronized--> MONITOR --acquired--> RUNNING
RUNNING --wait()--> WAIT --notify/timeout--> RUNNING
RUNNING --run() completes--> ZOMBIE
```

## 挂起机制深入分析

### 挂起计数 (Suspend Count)

JDWP 使用**引用计数**机制管理线程挂起：

```java
// 初始状态: suspendCount = 0

suspend(threadID);  // suspendCount = 1, 线程暂停
suspend(threadID);  // suspendCount = 2, 线程仍然暂停

resume(threadID);   // suspendCount = 1, 线程仍然暂停
resume(threadID);   // suspendCount = 0, 线程恢复执行
```

### VM 挂起 vs 线程挂起

**VM 级别挂起**:
- `VirtualMachine.Suspend` 挂起所有线程
- 每个线程的 suspendCount 都增加 1
- `VirtualMachine.Resume` 恢复所有线程

**线程级别挂起**:
- `ThreadReference.Suspend` 只挂起指定线程
- 只增加该线程的 suspendCount
- `ThreadReference.Resume` 只恢复该线程

**混合使用**:
```java
// VM 挂起: 所有线程 suspendCount = 1
vm.suspend();

// 单独挂起 main 线程: main 线程 suspendCount = 2
thread.suspend(mainThreadId);

// VM 恢复: 所有线程 suspendCount = 0, 但 main 线程 suspendCount = 1
vm.resume();

// main 线程仍然暂停！需要单独恢复
thread.resume(mainThreadId);
```

### 获取栈帧的前提条件

**关键规则**: 调用 `ThreadReference.Frames` 之前，线程必须处于挂起状态。

原因：
1. 运行中的线程栈帧在不断变化
2. 只有暂停时才能获得一致的快照
3. JDWP 协议要求线程暂停才能查询栈帧

错误处理：
```
如果线程未挂起，返回错误码 503 (THREAD_NOT_SUSPENDED)
```

## 正确的调试流程

### 模式 1: VM 级别挂起

```typescript
// 1. 连接 JVM
await client.connect();

// 2. 挂起整个 VM
await client.suspend(); // VirtualMachine.Suspend

// 3. 获取线程列表
const threads = await client.threads();

// 4. 获取栈帧 (此时所有线程都已挂起)
const stack = await client.stack(threadId);

// 5. 恢复 VM
await client.resume(); // VirtualMachine.Resume
```

### 模式 2: 线程级别挂起

```typescript
// 1. 连接 JVM
await client.connect();

// 2. 获取线程列表 (内部会短暂挂起 VM)
const threads = await client.threads();

// 3. 挂起特定线程
await client.suspend(threadId); // ThreadReference.Suspend

// 4. 获取栈帧
const stack = await client.stack(threadId);

// 5. 恢复线程
await client.resume(threadId); // ThreadReference.Resume
```

### 模式 3: 断点触发挂起

```typescript
// 1. 设置断点 (suspendPolicy = EVENT_THREAD 或 ALL)
await client.setBreakpoint("Main.main:10");

// 2. 恢复 VM 让程序运行
await client.resume();

// 3. 等待断点事件
const event = await client.waitForEvent();

// 4. 断点命中时，线程已自动挂起
const stack = await client.stack(event.threadId);

// 5. 继续执行
await client.resume();
```

## 常见陷阱

### 陷阱 1: threads() 方法内部挂起

当前实现中，`threads()` 方法会：
1. 调用 `VirtualMachine.Suspend`
2. 获取线程列表
3. 调用 `VirtualMachine.Resume`

**问题**: 如果在 `threads()` 之后立即调用 `stack()`，线程可能已经恢复执行。

**解决方案**:
```typescript
// 错误方式
const threads = await client.threads();
// 此时 VM 已恢复，线程可能在运行
const stack = await client.stack(threadId); // 可能失败！

// 正确方式
const threads = await client.threads();
await client.suspend(); // 再次挂起
const stack = await client.stack(threadId);
await client.resume();
```

### 陷阱 2: JVM 启动时的挂起状态

当 JVM 以 `suspend=y` 启动时：
- 主线程 (main) 在启动时就被挂起
- 调试器连接后可以直接获取栈帧
- 不需要额外调用 `suspend()`

当 JVM 以 `suspend=n` 启动时：
- 主线程立即开始执行
- 调试器连接时程序可能已经运行
- 需要先挂起才能获取栈帧

### 陷阱 3: 线程退出

线程可能在调试过程中退出：
- 调用 `ThreadReference.Frames` 时线程已退出
- 返回空数组或 `INVALID_THREAD` 错误
- 需要检查线程状态是否为 ZOMBIE

## ThreadReference 命令详解

### Name (Command 1)

获取线程名称。

**请求**:
```
threadID
```

**响应**:
```
name (string)
```

### Suspend (Command 2)

挂起线程。增加线程的挂起计数。

**请求**:
```
threadID
```

**响应**: 无

### Resume (Command 3)

恢复线程。减少线程的挂起计数。

**请求**:
```
threadID
```

**响应**: 无

### Status (Command 4)

获取线程状态。

**请求**:
```
threadID
```

**响应**:
```
threadStatus (int)
suspendStatus (int)
```

### Frames (Command 6)

获取线程栈帧。

**前提条件**: 线程必须处于挂起状态。

**请求**:
```
threadID
startFrame (int) - 起始帧索引，0 表示栈顶
length (int) - 帧数量，-1 表示所有帧
```

**响应**:
```
frames (int) - 帧数量
for each frame:
  frameID
  location:
    typeTag (byte)
    classID
    methodID
    codeIndex (long)
```

### FrameCount (Command 7)

获取栈帧总数。

**前提条件**: 线程必须处于挂起状态。

**请求**:
```
threadID
```

**响应**:
```
frameCount (int)
```

### SuspendCount (Command 11)

获取线程的挂起计数。

**请求**:
```
threadID
```

**响应**:
```
suspendCount (int)
```

## 最佳实践

1. **始终检查挂起状态**: 在获取栈帧前，检查 `suspendStatus > 0`

2. **使用 VM 级别挂起进行快照**: 需要一致的 VM 状态时，使用 VM 级别挂起

3. **使用线程级别挂起进行调试**: 只关注特定线程时，使用线程级别挂起

4. **正确配对 suspend/resume**: 确保每个 suspend 都有对应的 resume

5. **处理线程退出**: 检查线程状态，处理线程已退出的情况

6. **避免竞态条件**: 在获取线程列表和操作线程之间，线程状态可能改变
