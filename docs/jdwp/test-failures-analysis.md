# E2E 测试失败根因分析

## 测试结果概览

```
通过: 9 个测试
失败: 5 个测试
```

## 失败测试详细分析

### 1. 堆栈跟踪返回空数组

**测试**: `Step Operations E2E > stack_inspection > should get stack trace`

**失败断言**: `expect(stack.length).toBeGreaterThan(0)`

**根因分析**:

```
时间线:
T0: JVM 启动 (suspend=y), 主线程在 main() 入口挂起
T1: 调试器连接
T2: 调用 threads() -> 内部 suspend VM -> 获取线程 -> resume VM
T3: 主线程开始执行
T4: 主线程打印 "SimpleProgram started"
T5: 主线程调用 add(10, 20)
T6: 主线程打印 "Sum: 30"
T7: 主线程进入 Thread.sleep(30000)
T8: 测试调用 suspend() -> 挂起 VM
T9: 测试调用 stack(mainThreadId)
T10: 获取栈帧 -> 返回空数组或失败
```

**问题**:
1. 在 T2 到 T8 之间，主线程已经执行了多个方法
2. 当在 T9 获取栈帧时，主线程可能在 `Thread.sleep()` 的 native 方法中
3. Native 方法的栈帧可能无法获取，或者线程状态不正确

**验证方法**:
```typescript
// 添加调试日志
const { threadStatus, suspendStatus } = await thread.getThreadStatus(executor, threadId);
console.log(`Thread status: ${threadStatus}, suspend: ${suspendStatus}`);

const frameCount = await thread.getThreadFrameCount(executor, threadId);
console.log(`Frame count: ${frameCount}`);
```

**修复方案**:
```typescript
// 方案 1: 在 threads() 后立即获取栈帧，不恢复 VM
async threads(): Promise<ThreadInfo[]> {
  return this.executeCommand(async (executor) => {
    await vm.suspendVM(executor);
    // 不自动恢复
    const threadIDs = await vm.getAllThreads(executor);
    // ...
    return threads;
  });
}

// 方案 2: 提供原子操作
async getThreadsWithStack(): Promise<Map<string, { thread: ThreadInfo; stack: StackFrame[] }>> {
  return this.executeCommand(async (executor) => {
    await vm.suspendVM(executor);
    try {
      const result = new Map();
      const threadIDs = await vm.getAllThreads(executor);
      for (const threadID of threadIDs) {
        const thread = await this.getThreadInfo(executor, threadID);
        const stack = await thread.getThreadStack(executor, threadID);
        result.set(threadID, { thread, stack });
      }
      return result;
    } finally {
      await vm.resumeVM(executor);
    }
  });
}
```

### 2. 连接被拒绝

**测试**: 多个测试

**错误**: `ECONNREFUSED 127.0.0.1:XXXX`

**根因分析**:

```
时间线:
T0: 测试启动 JVM 进程
T1: JVM 开始监听调试端口
T2: 调试器连接成功
T3: 测试执行
T4: 测试调用 resume()
T5: JVM 程序执行完毕，进程退出
T6: afterEach 尝试连接或清理
T7: 连接失败 - 进程已退出
```

**问题**:
1. SimpleProgram 在某些情况下会快速执行完毕
2. 测试没有正确处理进程已退出的情况
3. afterEach 清理时进程可能已经不存在

**修复方案**:
```typescript
// 改进 terminateJava
async function terminateJava(jvm: LaunchedJVM): Promise<void> {
  // 检查进程是否还在运行
  try {
    process.kill(jvm.pid, 0); // 检查进程是否存在
  } catch {
    // 进程已退出，直接返回
    return;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try {
        jvm.process.kill("SIGKILL");
      } catch {}
      resolve();
    }, 5000);

    jvm.process.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      jvm.process.kill("SIGTERM");
    } catch {
      clearTimeout(timeout);
      resolve();
    }
  });
}
```

### 3. Hook 超时

**测试**: 多个测试的 afterEach

**错误**: Timeout in afterEach hook

**根因分析**:

```
时间线:
T0: 测试完成
T1: afterEach 开始执行
T2: 调用 client.close()
T3: 调用 terminateJava(jvm)
T4: 等待进程退出
T5: 超时 (5 秒)
```

**问题**:
1. JVM 进程可能卡在某个状态，不响应 SIGTERM
2. 或者进程已经退出，但 close 事件没有触发
3. 或者 socket 关闭时阻塞

**修复方案**:
```typescript
// 改进 close 方法
async close(): Promise<void> {
  if (!this.connected || !this.socket) {
    return;
  }

  const socket = this.socket;
  this.connected = false;
  this.socket = null;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve();
    }, 3000);

    socket.end(() => {
      clearTimeout(timeout);
      resolve();
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
```

## 核心问题总结

### 问题 1: threads() 方法自动恢复 VM

**影响**: 所有依赖 threads() 后获取栈帧的测试

**代码位置**: `src/protocol/jdwp/client.ts:163-196`

**问题代码**:
```typescript
async threads(): Promise<ThreadInfo[]> {
  return this.executeCommand(async (executor) => {
    await vm.suspendVM(executor);
    try {
      // ...
      return threads;
    } finally {
      await vm.resumeVM(executor);  // 问题所在
    }
  });
}
```

**修复**:
```typescript
async threads(options?: { keepSuspended?: boolean }): Promise<ThreadInfo[]> {
  const keepSuspended = options?.keepSuspended ?? false;
  return this.executeCommand(async (executor) => {
    await vm.suspendVM(executor);
    try {
      // ...
      return threads;
    } finally {
      if (!keepSuspended) {
        await vm.resumeVM(executor);
      }
    }
  });
}
```

### 问题 2: 测试没有正确处理挂起状态

**影响**: `should get stack trace`, `should inspect local variables`

**代码位置**: `tests/e2e/scenarios/step.test.ts:86-119`

**问题代码**:
```typescript
const threads = await client.threads();  // VM 被恢复
const mainThread = threads.find((t) => t.name === "main");

await client.suspend();  // 再次挂起，但线程状态已改变

const stack = await client.stack(mainThread!.id);  // 可能失败
```

**修复**:
```typescript
// 方案 1: 使用 keepSuspended 选项
const threads = await client.threads({ keepSuspended: true });
const mainThread = threads.find((t) => t.name === "main");
const stack = await client.stack(mainThread!.id);
await client.resume();

// 方案 2: 先挂起，再获取线程
await client.suspend();
const threads = await client.threads();
const mainThread = threads.find((t) => t.name === "main");
const stack = await client.stack(mainThread!.id);
await client.resume();
```

### 问题 3: 测试程序生命周期管理

**影响**: 连接被拒绝、Hook 超时

**代码位置**: `tests/e2e/fixtures/launch.ts`, `tests/e2e/fixtures/java/SimpleProgram.java`

**问题**:
1. SimpleProgram 可能在测试完成前退出
2. terminateJava 没有正确处理已退出的进程
3. close() 方法可能阻塞

**修复**:
1. 改进 SimpleProgram，使其持续运行直到被终止
2. 改进 terminateJava，检查进程是否存在
3. 改进 close()，添加超时处理

## 修复优先级

### P0 - 必须修复

1. **修改 threads() 方法**: 添加 `keepSuspended` 选项
2. **修改测试代码**: 正确处理挂起状态

### P1 - 应该修复

3. **改进 terminateJava**: 处理已退出的进程
4. **改进 close()**: 添加超时处理

### P2 - 可以改进

5. **改进 SimpleProgram**: 更稳定的生命周期
6. **添加状态管理**: 跟踪挂起计数

## 验证修复的测试用例

修复后，应该通过以下测试：

```typescript
describe("Stack Inspection (Fixed)", () => {
  it("should get stack trace with keepSuspended", async () => {
    jvm = await launchSimpleProgram({ suspend: true });
    client = new JDWPClient(config);
    await client.connect();

    // 使用 keepSuspended 保持 VM 挂起
    const threads = await client.threads({ keepSuspended: true });
    const mainThread = threads.find((t) => t.name === "main");
    expect(mainThread).toBeDefined();

    // 此时 VM 仍然挂起，可以安全获取栈帧
    const stack = await client.stack(mainThread!.id);
    expect(stack.length).toBeGreaterThan(0);

    // 恢复 VM
    await client.resume();
  });

  it("should get stack trace with explicit suspend", async () => {
    jvm = await launchSimpleProgram({ suspend: true });
    client = new JDWPClient(config);
    await client.connect();

    // 先挂起
    await client.suspend();

    // 获取线程 (此时 VM 已挂起，threads() 不会恢复)
    const threads = await client.threads();
    const mainThread = threads.find((t) => t.name === "main");

    // 获取栈帧
    const stack = await client.stack(mainThread!.id);
    expect(stack.length).toBeGreaterThan(0);

    // 恢复
    await client.resume();
  });
});
```

## 结论

测试失败的根本原因是 **API 设计与使用模式不匹配**：

1. `threads()` 方法自动恢复 VM，破坏了调用者的预期
2. 测试代码假设获取线程后线程仍然挂起，但实际上已经恢复
3. 线程在恢复后继续执行，导致获取栈帧时状态不正确

修复的核心是 **让调用者控制挂起状态**，而不是在 API 内部自动恢复。
