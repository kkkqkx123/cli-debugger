# Delve E2E 测试指南

## 概述

本文档描述如何为 Delve 调试器编写端到端（E2E）测试，包括测试环境设置、启动方式、常见问题及解决方案。

## 测试环境要求

### 必需工具

1. **Go 工具链**
   ```bash
   # 检查 Go 是否安装
   go version
   # 输出: go version go1.21.x windows/amd64
   ```

2. **Delve 调试器**
   ```bash
   # 检查 Delve 是否安装
   dlv version
   # 输出: Delve Debugger Version: 1.x.x
   ```

3. **Node.js 22+**
   ```bash
   node --version
   # 输出: v22.x.x
   ```

### 安装 Delve

```bash
# 使用 Go 安装
go install github.com/go-delve/delve/cmd/dlv@latest

# 或使用包管理器
# Windows (scoop)
scoop install delve

# macOS (brew)
brew install delve

# Linux
# 参考: https://github.com/go-delve/delve/blob/master/Documentation/installation/linux.md
```

## 启动 Delve 的正确方式

### 问题：dlv exec 立即退出

**现象：**
```bash
dlv exec ./program --headless --listen=127.0.0.1:4040
# 进程立即退出，无法连接
```

**原因：**
- `dlv exec` 执行预编译的二进制文件
- 如果程序没有暂停点，会立即执行完毕
- Delve 服务器随之退出

**解决方案：**

### 方案 1：使用 dlv debug（推荐）

```bash
# dlv debug 会编译并启动程序，程序在入口点暂停
dlv debug ./program.go --headless --listen=127.0.0.1:4040 --api-version=2
```

**优点：**
- 程序在入口点自动暂停
- 不需要预先编译
- 适合测试场景

**缺点：**
- 每次都重新编译（较慢）
- 生成临时调试二进制

### 方案 2：使用 --continue 标志

```bash
# 先编译带调试信息的二进制
go build -gcflags="all=-N -l" -o program

# 使用 --continue 让程序继续运行
dlv exec ./program --headless --listen=127.0.0.1:4040 --continue
```

**优点：**
- 可以使用预编译的二进制
- 程序立即开始运行

**缺点：**
- 可能错过入口点的调试机会
- 需要确保程序不会立即退出

### 方案 3：修改程序代码

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    // 等待调试器连接
    fmt.Println("Waiting for debugger...")
    time.Sleep(2 * time.Second)

    // 实际逻辑
    fmt.Println("Program started")
    // ...
}
```

## 测试固件设计

### Go 测试程序结构

```
tests/e2e/fixtures/go/
├── simple_program.go      # 简单程序
├── breakpoint_test.go     # 断点测试
├── multi_thread_program.go # 多 goroutine 测试
└── variable_test.go       # 变量检查测试
```

### 简单程序示例

```go
// simple_program.go
package main

import (
    "fmt"
    "time"
)

func add(a, b int) int {
    return a + b
}

func main() {
    fmt.Println("Program started")

    // 等待调试器连接
    time.Sleep(100 * time.Millisecond)

    x := 10
    y := 20
    sum := add(x, y)
    fmt.Printf("Sum: %d\n", sum)

    // 保持程序运行
    time.Sleep(60 * time.Second)

    fmt.Println("Program finished")
}
```

**设计要点：**
1. 启动时打印消息，确认程序已启动
2. 短暂延迟，给调试器连接时间
3. 包含可调试的函数和变量
4. 长时间睡眠，防止程序退出

### 断点测试程序

```go
// breakpoint_test.go
package main

import "fmt"

type BreakpointTest struct {
    counter int
}

func (b *BreakpointTest) methodA() {
    b.counter++ // 断点位置 1
    fmt.Printf("methodA: counter = %d\n", b.counter)
}

func (b *BreakpointTest) methodB() {
    b.counter += 2 // 断点位置 2
    fmt.Printf("methodB: counter = %d\n", b.counter)
}

func main() {
    test := &BreakpointTest{counter: 0}

    fmt.Println("Starting breakpoint test")
    test.methodA() // 断点位置 3
    test.methodB() // 断点位置 4
    fmt.Println("Breakpoint test completed")
}
```

## 启动工具实现

### TypeScript 启动函数

```typescript
// tests/e2e/fixtures/go-launch.ts
import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";

const FIXTURE_DIR = path.join(__dirname, "go");

export interface LaunchedDelve {
  process: ChildProcess;
  debugPort: number;
  pid: number;
}

export async function launchGoProgram(
  programName: string,
  debugPort: number = 4040
): Promise<LaunchedDelve> {
  const sourceFile = path.join(FIXTURE_DIR, `${programName}.go`);

  // 使用 dlv debug 命令
  const args = [
    "debug",
    sourceFile,
    "--headless",
    `--listen=127.0.0.1:${debugPort}`,
    "--api-version=2",
    "--log"  // 启用日志便于调试
  ];

  const proc = spawn("dlv", args, {
    stdio: "pipe",
    cwd: FIXTURE_DIR
  });

  // 等待 Delve 准备就绪
  await waitForDelveReady(proc, debugPort);

  return {
    process: proc,
    debugPort,
    pid: proc.pid!
  };
}

async function waitForDelveReady(
  proc: ChildProcess,
  port: number,
  timeout: number = 15000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for Delve on port ${port}`));
    }, timeout);

    const checkMessage = (data: Buffer) => {
      const message = data.toString();
      if (message.includes(`API server listening at: 127.0.0.1:${port}`)) {
        clearTimeout(timeoutId);
        resolve();
      }
    };

    proc.stdout?.on("data", checkMessage);
    proc.stderr?.on("data", checkMessage);

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new Error(`Delve exited with code ${code}`));
      }
    });
  });
}

export async function terminateDelve(delve: LaunchedDelve): Promise<void> {
  return new Promise((resolve) => {
    delve.process.on("close", resolve);
    delve.process.on("error", resolve);

    try {
      delve.process.kill("SIGTERM");
    } catch {
      resolve();
    }

    // 强制终止超时
    setTimeout(() => {
      try {
        delve.process.kill("SIGKILL");
      } catch {}
      resolve();
    }, 3000);
  });
}
```

## 测试用例编写

### 基础测试

```typescript
// tests/e2e/scenarios/go/basic-debug.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { DlvClient } from "../../../../src/protocol/dlv/client.js";
import { launchGoProgram, terminateDelve } from "../../fixtures/go-launch.js";

describe("Basic Debug E2E (Go)", () => {
  let delve: LaunchedDelve | null = null;
  let client: DlvClient | null = null;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
    if (delve) {
      await terminateDelve(delve);
      delve = null;
    }
  });

  it("should connect to Delve", async () => {
    // 启动 Delve
    delve = await launchGoProgram("simple_program", 4040);

    // 连接客户端
    client = new DlvClient({
      protocol: "dlv",
      host: "127.0.0.1",
      port: delve.debugPort,
      timeout: 10000
    });

    await client.connect();
    expect(client.isConnected()).toBe(true);

    // 获取版本
    const version = await client.version();
    expect(version.runtimeName).toBe("go");
  });

  it("should list goroutines", async () => {
    delve = await launchGoProgram("simple_program", 4041);
    client = new DlvClient({ /* ... */ });
    await client.connect();

    const threads = await client.threads();
    expect(threads.length).toBeGreaterThan(0);

    // 打印 goroutine 信息用于调试
    for (const t of threads) {
      console.log(`Goroutine ${t.id}: ${t.name} (${t.state})`);
    }
  });
});
```

### 断点测试

```typescript
describe("Breakpoint E2E (Go)", () => {
  it("should set and hit breakpoint", async () => {
    delve = await launchGoProgram("breakpoint_test", 4042);
    client = new DlvClient({ /* ... */ });
    await client.connect();

    // 清除现有断点
    await client.clearBreakpoints();

    // 设置断点
    const bpId = await client.setBreakpoint("main.main");
    console.log("Breakpoint set:", bpId);

    // 继续执行
    await client.resume();

    // 等待断点命中
    const event = await client.waitForEvent(10000);
    expect(event?.type).toBe("breakpoint");
    console.log("Hit breakpoint at:", event?.location);

    // 清理
    await client.clearBreakpoints();
  });
});
```

## 常见问题排查

### 1. Goroutine 列表为空

**现象：**
```typescript
const threads = await client.threads();
console.log(threads.length); // 0
```

**原因：**
- 程序尚未开始执行
- Delve 状态不正确

**解决方案：**
```typescript
// 先获取状态
const state = await client.getState();
console.log("State:", state);

// 如果程序未运行，可能需要继续执行
if (!state.running) {
  // 程序已暂停，可以获取 goroutines
  const threads = await client.threads();
  // ...
}
```

### 2. 连接超时

**现象：**
```
Error: Timeout waiting for Delve on port 4040
```

**原因：**
- Delve 未启动
- 端口被占用
- 启动参数错误

**排查步骤：**
```bash
# 1. 检查端口是否被占用
netstat -an | grep 4040

# 2. 手动启动 Delve 查看输出
dlv debug ./program.go --headless --listen=127.0.0.1:4040 --log

# 3. 检查 Delve 进程
ps aux | grep dlv
```

### 3. 断点不生效

**现象：**
```typescript
await client.setBreakpoint("main.go:42");
await client.resume();
// 程序直接运行，未停在断点
```

**原因：**
- 文件路径不匹配
- 行号不正确
- 程序未编译调试信息

**解决方案：**
```typescript
// 1. 使用完整路径
const fullPath = path.resolve("/path/to/main.go");
await client.setBreakpoint(`${fullPath}:42`);

// 2. 使用函数名
await client.setBreakpoint("main.main");

// 3. 检查断点列表
const bps = await client.breakpoints();
console.log("Breakpoints:", bps);
```

### 4. 程序立即退出

**现象：**
```
Delve exited with code 0
```

**原因：**
- 程序执行完毕
- 没有暂停点

**解决方案：**
```go
// 在 Go 代码中添加延迟
func main() {
    time.Sleep(60 * time.Second)
    // ...
}
```

## 调试技巧

### 1. 启用 Delve 日志

```typescript
const args = [
  "debug",
  sourceFile,
  "--headless",
  `--listen=127.0.0.1:${debugPort}`,
  "--api-version=2",
  "--log",
  "--log-output=debugger,rpc"
];
```

### 2. 捕获 Delve 输出

```typescript
let stdout = "";
let stderr = "";

proc.stdout?.on("data", (data) => {
  stdout += data.toString();
  console.log("Delve stdout:", data.toString());
});

proc.stderr?.on("data", (data) => {
  stderr += data.toString();
  console.log("Delve stderr:", data.toString());
});
```

### 3. 使用详细测试输出

```bash
npm test -- tests/e2e/scenarios/go --reporter=verbose
```

### 4. 单独运行测试

```bash
npm test -- tests/e2e/scenarios/go/basic-debug.test.ts
```

## 测试最佳实践

### 1. 资源清理

```typescript
afterEach(async () => {
  // 先关闭客户端
  if (client) {
    try {
      await client.close();
    } catch (error) {
      console.error("Error closing client:", error);
    }
    client = null;
  }

  // 再终止 Delve
  if (delve) {
    try {
      await terminateDelve(delve);
    } catch (error) {
      console.error("Error terminating Delve:", error);
    }
    delve = null;
  }
});
```

### 2. 错误处理

```typescript
it("should handle errors gracefully", async () => {
  try {
    delve = await launchGoProgram("simple_program");
    client = new DlvClient({ /* ... */ });
    await client.connect();

    // 测试逻辑
  } catch (error) {
    console.error("Test error:", error);
    throw error;
  }
});
```

### 3. 超时设置

```typescript
// 设置合理的超时时间
await client.connect();

// E2E 测试需要更长超时
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 60000,  // 60 秒
    hookTimeout: 30000   // 30 秒
  }
});
```

### 4. 端口管理

```typescript
// 使用随机端口避免冲突
const debugPort = 4040 + Math.floor(Math.random() * 1000);

// 或使用端口管理器
class PortManager {
  private usedPorts = new Set<number>();

  getPort(): number {
    let port = 4040;
    while (this.usedPorts.has(port)) {
      port++;
    }
    this.usedPorts.add(port);
    return port;
  }

  releasePort(port: number): void {
    this.usedPorts.delete(port);
  }
}
```

## 参考资料

- [Delve 文档](https://github.com/go-delve/delve/tree/master/Documentation)
- [Vitest 文档](https://vitest.dev/)
- [Node.js Child Process](https://nodejs.org/api/child_process.html)
