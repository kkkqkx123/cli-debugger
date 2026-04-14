# JDWP 调试最佳实践

## 连接管理

### 1. 正确的连接流程

```typescript
const client = new JDWPClient({
  protocol: "jdwp",
  host: "127.0.0.1",
  port: 5005,
  timeout: 10000,
});

try {
  await client.connect();

  // 执行调试操作
  // ...

} finally {
  await client.close();
}
```

### 2. 处理连接失败

```typescript
try {
  await client.connect();
} catch (error) {
  if (error instanceof APIError) {
    if (error.code === ErrorCodes.ConnectionFailed) {
      console.error("无法连接到 JVM，请检查:");
      console.error("1. JVM 是否已启动并开启调试模式");
      console.error("2. 调试端口是否正确");
      console.error("3. 防火墙是否阻止连接");
    } else if (error.code === ErrorCodes.ConnectionTimeout) {
      console.error("连接超时，JVM 可能未响应");
    }
  }
  throw error;
}
```

## 线程管理

### 1. 获取线程列表

**推荐方式**: 保持 VM 挂起状态

```typescript
// 方式 1: 使用 keepSuspended 选项
const threads = await client.threads({ keepSuspended: true });
try {
  // 执行需要线程挂起的操作
  const stack = await client.stack(threadId);
} finally {
  await client.resume();
}

// 方式 2: 先挂起，再获取
await client.suspend();
try {
  const threads = await client.threads();
  const stack = await client.stack(threadId);
} finally {
  await client.resume();
}
```

**不推荐方式**: 自动恢复

```typescript
// 不推荐: threads() 后线程可能已恢复执行
const threads = await client.threads();
await client.suspend();  // 线程状态可能已改变
const stack = await client.stack(threadId);  // 可能失败
```

### 2. 检查线程状态

```typescript
const threads = await client.threads({ keepSuspended: true });

for (const thread of threads) {
  console.log(`Thread: ${thread.name}`);
  console.log(`  State: ${thread.state}`);
  console.log(`  Suspended: ${thread.isSuspended}`);

  // 只处理非僵尸线程
  if (thread.state !== "zombie") {
    const stack = await client.stack(thread.id);
    console.log(`  Stack depth: ${stack.length}`);
  }
}

await client.resume();
```

### 3. 处理线程退出

```typescript
try {
  const stack = await client.stack(threadId);
} catch (error) {
  if (error instanceof APIError) {
    if (error.code === ErrorCodes.InvalidThread) {
      console.log("线程已退出");
      // 处理线程退出
    } else if (error.code === ErrorCodes.ThreadNotSuspended) {
      console.log("线程未挂起，需要先调用 suspend()");
      await client.suspend();
      // 重试
    }
  }
}
```

## 栈帧操作

### 1. 获取完整栈帧信息

```typescript
await client.suspend();
try {
  const threads = await client.threads();
  const mainThread = threads.find(t => t.name === "main");

  if (mainThread) {
    const stack = await client.stack(mainThread.id);

    for (let i = 0; i < stack.length; i++) {
      const frame = stack[i];
      console.log(`Frame ${i}:`);
      console.log(`  Location: ${frame.location}`);
      console.log(`  Method: ${frame.method}`);
      console.log(`  Line: ${frame.line}`);
    }
  }
} finally {
  await client.resume();
}
```

### 2. 获取局部变量

```typescript
await client.suspend();
try {
  const threads = await client.threads();
  const mainThread = threads.find(t => t.name === "main");

  if (mainThread) {
    const stack = await client.stack(mainThread.id);

    if (stack.length > 0) {
      // 获取第一个栈帧的局部变量
      const locals = await client.locals(mainThread.id, 0);

      for (const local of locals) {
        console.log(`${local.name}: ${local.value} (${local.type})`);
      }
    }
  }
} finally {
  await client.resume();
}
```

## 断点管理

### 1. 设置行断点

```typescript
// 设置断点
const bpId = await client.setBreakpoint("com.example.Main.main:42");

// 等待断点命中
const event = await client.waitForEvent();
if (event && event.type === "breakpoint") {
  console.log(`断点命中: 线程 ${event.threadId}`);

  // 获取栈帧
  const stack = await client.stack(event.threadId);

  // 继续执行
  await client.resume();
}

// 清除断点
await client.removeBreakpoint(bpId);
```

### 2. 设置方法断点

```typescript
// 方法入口断点
const entryBp = await client.setBreakpoint(
  "com.example.Main.process",
  undefined,
  "method-entry"
);

// 方法退出断点
const exitBp = await client.setBreakpoint(
  "com.example.Main.process",
  undefined,
  "method-exit"
);
```

### 3. 设置异常断点

```typescript
// 捕获所有异常
const allExcBp = await client.setBreakpoint("*", undefined, "exception");

// 捕获特定异常
const nullPtrBp = await client.setBreakpoint(
  "java.lang.NullPointerException",
  undefined,
  "exception"
);
```

## 单步调试

### 1. 单步进入 (Step Into)

```typescript
// 设置断点并等待命中
const bpId = await client.setBreakpoint("Main.main:10");
await client.resume();

const event = await client.waitForEvent();
if (event) {
  // 单步进入
  await client.stepInto(event.threadId);

  // 获取新的栈帧
  const stack = await client.stack(event.threadId);
  console.log("当前方法:", stack[0]?.method);
}

await client.removeBreakpoint(bpId);
```

### 2. 单步跳过 (Step Over)

```typescript
await client.stepOver(threadId);
```

### 3. 单步跳出 (Step Out)

```typescript
await client.stepOut(threadId);
```

## 事件处理

### 1. 等待特定事件

```typescript
const waitForBreakpoint = async (timeout: number = 30000) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const event = await client.waitForEvent(1000);

    if (event) {
      if (event.type === "breakpoint") {
        return event;
      }
      // 处理其他事件类型
      if (event.type === "vm-death") {
        console.log("VM 已终止");
        return null;
      }
    }
  }

  return null;
};
```

### 2. 事件循环

```typescript
const runEventLoop = async () => {
  while (true) {
    const event = await client.waitForEvent();

    if (!event) continue;

    switch (event.type) {
      case "breakpoint":
        console.log(`断点命中: ${event.location}`);
        // 处理断点
        break;

      case "step":
        console.log("单步完成");
        // 处理单步
        break;

      case "exception":
        console.log(`异常: ${event.exception}`);
        // 处理异常
        break;

      case "vm-death":
        console.log("VM 终止");
        return;
    }
  }
};
```

## 错误处理

### 1. 常见错误处理

```typescript
const safeGetStack = async (threadId: string) => {
  try {
    return await client.stack(threadId);
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.code) {
        case ErrorCodes.ThreadNotSuspended:
          // 自动挂起并重试
          await client.suspend();
          return await client.stack(threadId);

        case ErrorCodes.InvalidThread:
          // 线程已退出
          console.log("线程已退出");
          return [];

        case ErrorCodes.VmDead:
          // VM 已终止
          console.log("VM 已终止");
          return [];

        default:
          throw error;
      }
    }
    throw error;
  }
};
```

### 2. 资源清理

```typescript
const debugSession = async () => {
  const client = new JDWPClient(config);
  const breakpoints: string[] = [];

  try {
    await client.connect();

    // 设置断点
    breakpoints.push(await client.setBreakpoint("Main.main:10"));

    // 执行调试
    // ...

  } catch (error) {
    console.error("调试错误:", error);
  } finally {
    // 清除断点
    for (const bpId of breakpoints) {
      try {
        await client.removeBreakpoint(bpId);
      } catch {}
    }

    // 关闭连接
    await client.close();
  }
};
```

## 性能优化

### 1. 批量操作

```typescript
// 不推荐: 多次单独操作
for (const thread of threads) {
  const stack = await client.stack(thread.id);  // 每次都发送请求
}

// 推荐: 一次性获取所有信息
await client.suspend();
try {
  const threads = await client.threads();
  const stacks = await Promise.all(
    threads.map(t => client.stack(t.id).catch(() => []))
  );

  // 处理结果
  for (let i = 0; i < threads.length; i++) {
    console.log(`${threads[i].name}: ${stacks[i].length} frames`);
  }
} finally {
  await client.resume();
}
```

### 2. 减少不必要的操作

```typescript
// 不推荐: 每次都获取完整线程列表
const thread1 = (await client.threads()).find(t => t.name === "main");
const thread2 = (await client.threads()).find(t => t.name === "worker");

// 推荐: 一次获取，多次使用
const threads = await client.threads();
const thread1 = threads.find(t => t.name === "main");
const thread2 = threads.find(t => t.name === "worker");
```

## 调试模式

### 1. JVM 启动参数

```bash
# 挂起启动，等待调试器连接
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005 MyApp

# 不挂起，立即运行
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005 MyApp

# 监听所有网络接口
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:5005 MyApp
```

### 2. 调试器连接时机

```typescript
// suspend=y: JVM 在入口处挂起，可以立即获取初始状态
const client = new JDWPClient(config);
await client.connect();
const threads = await client.threads({ keepSuspended: true });
// 主线程在 main() 入口处

// suspend=n: JVM 立即运行，需要先挂起
const client = new JDWPClient(config);
await client.connect();
await client.suspend();  // 先挂起
const threads = await client.threads();
// 主线程可能在任意位置
```

## 总结

### 核心原则

1. **始终控制挂起状态**: 不要依赖 API 内部的自动恢复
2. **正确配对 suspend/resume**: 确保每个 suspend 都有对应的 resume
3. **处理错误情况**: 线程退出、VM 终止等
4. **资源清理**: 使用 try-finally 确保资源释放

### 推荐的调试流程

```typescript
const client = new JDWPClient(config);

try {
  // 1. 连接
  await client.connect();

  // 2. 挂起 VM
  await client.suspend();

  try {
    // 3. 获取线程信息
    const threads = await client.threads();

    // 4. 执行调试操作
    for (const thread of threads) {
      if (thread.state !== "zombie") {
        const stack = await client.stack(thread.id);
        // 处理栈帧
      }
    }

    // 5. 设置断点
    const bpId = await client.setBreakpoint("Main.main:10");

    // 6. 恢复执行
    await client.resume();

    // 7. 等待事件
    const event = await client.waitForEvent();
    // 处理事件

    // 8. 清除断点
    await client.removeBreakpoint(bpId);

  } finally {
    // 确保恢复 VM
    await client.resume();
  }

} finally {
  // 关闭连接
  await client.close();
}
```
