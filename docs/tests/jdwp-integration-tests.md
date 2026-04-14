# JDWP 协议集成测试设计方案

## 概述

本文档定义了 `src/protocol/jdwp` 目录的集成测试设计方案。与单元测试不同，集成测试关注模块间的协作、真实网络通信、以及与实际 JVM 调试目标的交互验证。

## 测试目标

1. **端到端验证**: 验证从连接建立到命令执行的完整流程
2. **协议兼容性**: 确保与真实 JVM JDWP 协议的兼容性
3. **错误恢复**: 测试网络异常、协议错误等场景的处理
4. **性能基准**: 建立关键操作的性能基准
5. **并发安全**: 验证多线程/多连接场景下的稳定性

---

## 测试架构

### 测试层次

```
┌─────────────────────────────────────────────────────────────┐
│                    E2E Tests (tests/e2e)                    │
│  - 完整调试场景测试                                          │
│  - 需要 JVM 目标进程                                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              Integration Tests (tests/integration)          │
│  - 模块间协作测试                                            │
│  - Mock JVM 或使用 JDWP Simulator                           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│               Unit Tests (src/**/__tests__)                 │
│  - 单个函数/类测试                                           │
│  - 完全 Mock                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 测试目录结构

```
cli-debugger/
├── tests/
│   ├── integration/
│   │   ├── jdwp/
│   │   │   ├── connection.test.ts      # 连接生命周期测试
│   │   │   ├── protocol.test.ts        # 协议编解码集成测试
│   │   │   ├── commands.test.ts        # 命令执行集成测试
│   │   │   ├── events.test.ts          # 事件处理集成测试
│   │   │   ├── error-recovery.test.ts  # 错误恢复测试
│   │   │   └── fixtures/               # 测试固件
│   │   │       ├── mock-jdwp-server.ts # Mock JDWP 服务器
│   │   │       ├── packet-captures/    # 真实 JDWP 包捕获
│   │   │       └── test-data.ts        # 测试数据生成器
│   │   └── vitest.config.ts
│   └── e2e/
│       ├── scenarios/                  # 调试场景
│       │   ├── basic-debug.test.ts
│       │   ├── breakpoint.test.ts      # 断点测试
│       │   ├── step.test.ts            # 单步测试
│       │   └── variable.test.ts        # 变量检查测试
│       ├── fixtures/
│       │   ├── java/                   # Java 测试程序
│       │   └── launch.ts               # JVM 启动工具
│       └── vitest.config.ts
```

---

## 1. 连接生命周期集成测试

### 测试文件: `tests/integration/jdwp/connection.test.ts`

| 测试用例                        | 描述               | 测试步骤                                                            | 预期结果                         |
| ------------------------------- | ------------------ | ------------------------------------------------------------------- | -------------------------------- |
| `full_lifecycle`                | 完整连接生命周期   | 1. 创建 Client<br>2. 连接 Mock Server<br>3. 执行命令<br>4. 关闭连接 | 连接成功，命令执行成功，关闭成功 |
| `connect_disconnect_reconnect`  | 连接-断开-重连     | 1. 连接<br>2. 关闭<br>3. 再次连接                                   | 重连成功，状态正确               |
| `multiple_clients`              | 多客户端并发连接   | 1. 创建多个 Client<br>2. 并发连接同一 Server<br>3. 并发执行命令     | 所有客户端正常工作               |
| `connection_timeout_recovery`   | 连接超时后恢复     | 1. 尝试连接不可达地址<br>2. 等待超时<br>3. 连接有效地址             | 超时后能成功连接有效地址         |
| `graceful_close_during_command` | 命令执行中优雅关闭 | 1. 连接<br>2. 开始执行长时间命令<br>3. 立即调用 close               | 命令被中断，连接正常关闭         |
| `auto_reconnect_on_error`       | 错误后自动重连     | 1. 连接<br>2. 模拟网络错误<br>3. 触发重连逻辑                       | 自动重连成功                     |

### Mock Server 设计

```typescript
// tests/integration/jdwp/fixtures/mock-jdwp-server.ts
import * as net from "node:net";

interface MockJDWPServerOptions {
  port?: number;
  handshakeDelay?: number;
  responseDelay?: number;
  onError?: (socket: net.Socket) => void;
}

export class MockJDWPServer {
  private server: net.Server;
  private options: MockJDWPServerOptions;

  constructor(options: MockJDWPServerOptions = {}) {
    this.options = options;
    this.server = this.createServer();
  }

  async start(): Promise<number> {
    /* ... */
  }
  async stop(): Promise<void> {
    /* ... */
  }
  simulateError(): void {
    /* ... */
  }
  setResponseHandler(handler: (data: Buffer) => Buffer): void {
    /* ... */
  }
}
```

---

## 2. 协议编解码集成测试

### 测试文件: `tests/integration/jdwp/protocol.test.ts`

| 测试用例                  | 描述             | 测试步骤                                                   | 预期结果             |
| ------------------------- | ---------------- | ---------------------------------------------------------- | -------------------- |
| `encode_decode_roundtrip` | 编解码往返测试   | 1. 构造各种命令包<br>2. 编码<br>3. 模拟网络传输<br>4. 解码 | 数据完整一致         |
| `packet_fragmentation`    | 包分片处理       | 1. 发送大包<br>2. 模拟分片到达<br>3. 等待完整包            | 正确重组分片         |
| `packet_concatenation`    | 包拼接处理       | 1. 快速发送多个小包<br>2. 可能合并到达<br>3. 解析所有包    | 正确拆分并处理所有包 |
| `id_size_variations`      | 不同 ID 大小     | 1. 使用 4 字节 ID<br>2. 使用 8 字节 ID<br>3. 执行命令      | 两种大小都正确处理   |
| `string_encoding_utf8`    | UTF-8 字符串编码 | 1. 发送含中文/特殊字符的字符串<br>2. 编解码                | 字符串正确处理       |
| `value_type_roundtrip`    | 各种值类型往返   | 1. 测试所有 JDWP 值类型<br>2. 编解码                       | 所有类型正确处理     |

### 测试数据生成器

```typescript
// tests/integration/jdwp/fixtures/test-data.ts
export const TestDataGenerator = {
  generateAllValueTypes(): Array<{ tag: number; value: unknown; expected: Buffer }> {
    return [
      { tag: 0x42, value: 127, expected: /* ... */ },      // byte
      { tag: 0x43, value: 0x4E2D, expected: /* ... */ },   // char (中)
      { tag: 0x44, value: 3.14159, expected: /* ... */ },  // double
      { tag: 0x46, value: 2.718, expected: /* ... */ },    // float
      { tag: 0x49, value: 123456, expected: /* ... */ },   // int
      { tag: 0x4a, value: 9007199254740991n, expected: /* ... */ }, // long
      { tag: 0x5a, value: true, expected: /* ... */ },     // boolean
      { tag: 0x4c, value: '123', expected: /* ... */ },    // object
      { tag: 0x5b, value: '456', expected: /* ... */ },    // array
    ];
  },

  generateComplexPackets(): Buffer[] { /* ... */ },

  generateMalformedPackets(): Buffer[] { /* ... */ },
};
```

---

## 3. 命令执行集成测试

### 测试文件: `tests/integration/jdwp/commands.test.ts`

| 测试用例                    | 描述         | 测试步骤                                                                          | 预期结果                     |
| --------------------------- | ------------ | --------------------------------------------------------------------------------- | ---------------------------- |
| `vm_commands_sequence`      | VM 命令序列  | 1. connect<br>2. version<br>3. capabilities<br>4. idSizes<br>5. close             | 所有命令成功，数据一致       |
| `thread_operations_flow`    | 线程操作流程 | 1. threads 获取列表<br>2. suspend 挂起<br>3. stack 获取堆栈<br>4. resume 恢复     | 流程完整执行                 |
| `breakpoint_lifecycle`      | 断点生命周期 | 1. setBreakpoint<br>2. breakpoints 验证<br>3. waitForEvent<br>4. removeBreakpoint | 断点正确触发和移除           |
| `variable_inspection_flow`  | 变量检查流程 | 1. suspend<br>2. stack<br>3. locals<br>4. fields<br>5. resume                     | 变量数据正确获取             |
| `step_operations_sequence`  | 单步操作序列 | 1. suspend<br>2. stepInto<br>3. stack<br>4. stepOver<br>5. stepOut                | 单步正确执行                 |
| `command_error_propagation` | 命令错误传播 | 1. 执行无效命令<br>2. 验证错误类型<br>3. 验证错误信息                             | 错误正确传播和处理           |
| `command_timeout_handling`  | 命令超时处理 | 1. 设置短超时<br>2. 执行慢命令<br>3. 验证超时错误                                 | 超时正确触发                 |
| `concurrent_commands`       | 并发命令执行 | 1. 同时发起多个独立命令<br>2. 等待所有完成                                        | 所有命令正确完成，无竞态条件 |

### 命令序列测试模式

```typescript
// tests/integration/jdwp/commands.test.ts
describe("command sequences", () => {
  it("should execute full debug workflow", async () => {
    const client = new JDWPClient(config);

    // Phase 1: Connection
    await client.connect();
    expect(client.isConnected()).toBe(true);

    // Phase 2: Metadata
    const version = await client.version();
    expect(version.protocolVersion).toBeDefined();

    const caps = await client.capabilities();
    expect(caps.supportsBreakpoints).toBe(true);

    // Phase 3: Thread inspection
    const threads = await client.threads();
    expect(threads.length).toBeGreaterThan(0);

    const mainThread = threads.find((t) => t.name === "main");
    expect(mainThread).toBeDefined();

    // Phase 4: Suspend and inspect
    await client.suspend(mainThread!.id);

    const stack = await client.stack(mainThread!.id);
    expect(stack.length).toBeGreaterThan(0);

    const locals = await client.locals(mainThread!.id, 0);
    expect(locals).toBeDefined();

    // Phase 5: Resume and close
    await client.resume(mainThread!.id);
    await client.close();
    expect(client.isConnected()).toBe(false);
  });
});
```

---

## 4. 事件处理集成测试

### 测试文件: `tests/integration/jdwp/events.test.ts`

| 测试用例                   | 描述             | 测试步骤                                                     | 预期结果                 |
| -------------------------- | ---------------- | ------------------------------------------------------------ | ------------------------ |
| `breakpoint_event_flow`    | 断点事件流程     | 1. 设置断点<br>2. 触发断点<br>3. 等待事件<br>4. 验证事件数据 | 事件正确触发，数据完整   |
| `step_event_sequence`      | 单步事件序列     | 1. 设置单步<br>2. 执行多次 step<br>3. 收集所有事件           | 事件序列正确             |
| `exception_event_handling` | 异常事件处理     | 1. 设置异常断点<br>2. 触发异常<br>3. 等待事件                | 异常事件正确捕获         |
| `class_prepare_event`      | 类准备事件       | 1. 设置类准备事件<br>2. 加载类<br>3. 等待事件                | 事件正确触发             |
| `thread_lifecycle_events`  | 线程生命周期事件 | 1. 设置线程启动/死亡事件<br>2. 创建/销毁线程<br>3. 等待事件  | 事件正确触发             |
| `multiple_event_types`     | 多种事件类型     | 1. 设置多种事件<br>2. 触发各种事件<br>3. 验证事件顺序        | 所有事件正确处理         |
| `event_timeout`            | 事件等待超时     | 1. 设置断点<br>2. 等待事件（不触发）<br>3. 超时              | 正确返回 null            |
| `event_queue_overflow`     | 事件队列溢出     | 1. 快速触发大量事件<br>2. 验证队列处理                       | 不丢失事件或正确处理溢出 |

### 事件测试辅助工具

```typescript
// tests/integration/jdwp/fixtures/event-collector.ts
export class EventCollector {
  private events: DebugEvent[] = [];

  async collect(client: JDWPClient, duration: number): Promise<DebugEvent[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const event = await client.waitForEvent(1000);
      if (event) {
        this.events.push(event);
      }
    }

    return this.events;
  }

  findByType(type: string): DebugEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  clear(): void {
    this.events = [];
  }
}
```

---

## 5. 错误恢复集成测试

### 测试文件: `tests/integration/jdwp/error-recovery.test.ts`

| 测试用例                    | 描述         | 测试步骤                                                           | 预期结果                   |
| --------------------------- | ------------ | ------------------------------------------------------------------ | -------------------------- |
| `connection_lost_recovery`  | 连接丢失恢复 | 1. 连接<br>2. 模拟连接断开<br>3. 检测断开<br>4. 重连               | 成功检测并重连             |
| `malformed_packet_recovery` | 错误包恢复   | 1. 连接<br>2. 发送错误格式包<br>3. 验证错误处理<br>4. 继续正常通信 | 错误被处理，后续通信正常   |
| `protocol_error_recovery`   | 协议错误恢复 | 1. 连接<br>2. 触发协议错误<br>3. 验证错误<br>4. 继续操作           | 错误被正确处理             |
| `timeout_recovery`          | 超时恢复     | 1. 设置短超时<br>2. 触发超时<br>3. 增加超时<br>4. 重试             | 重试成功                   |
| `invalid_id_recovery`       | 无效 ID 恢复 | 1. 使用无效线程 ID<br>2. 验证错误<br>3. 使用有效 ID                | 错误处理正确，后续操作正常 |
| `resource_exhaustion`       | 资源耗尽处理 | 1. 创建大量连接<br>2. 验证资源限制<br>3. 释放资源                  | 正确处理资源限制           |
| `partial_write_recovery`    | 部分写入恢复 | 1. 模拟部分写入<br>2. 验证重试<br>3. 验证完整传输                  | 正确处理部分写入           |

### 错误注入器

```typescript
// tests/integration/jdwp/fixtures/error-injector.ts
export class ErrorInjector {
  constructor(private server: MockJDWPServer) {}

  injectConnectionDrop(): void {
    /* ... */
  }
  injectMalformedPacket(): void {
    /* ... */
  }
  injectProtocolError(): void {
    /* ... */
  }
  injectTimeout(): void {
    /* ... */
  }
  injectPartialWrite(): void {
    /* ... */
  }
}
```

---

## 6. 性能基准测试

### 测试文件: `tests/integration/jdwp/performance.test.ts`

| 测试用例              | 描述       | 测试步骤               | 基准目标       |
| --------------------- | ---------- | ---------------------- | -------------- |
| `connection_time`     | 连接时间   | 测量 connect 耗时      | < 100ms (本地) |
| `command_latency`     | 命令延迟   | 测量各命令 RTT         | < 10ms (本地)  |
| `throughput_commands` | 命令吞吐量 | 测量每秒命令数         | > 1000 cmd/s   |
| `throughput_events`   | 事件吞吐量 | 测量每秒事件处理数     | > 500 events/s |
| `memory_usage`        | 内存使用   | 测量长时间运行内存增长 | < 10MB/hour    |
| `large_data_handling` | 大数据处理 | 测量大数组/字符串处理  | < 1s for 1MB   |

### 性能测试工具

```typescript
// tests/integration/jdwp/fixtures/benchmark.ts
export class Benchmark {
  static async measureTime<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static async measureThroughput(
    fn: () => Promise<void>,
    duration: number,
  ): Promise<number> {
    let count = 0;
    const start = Date.now();

    while (Date.now() - start < duration) {
      await fn();
      count++;
    }

    return count / (duration / 1000);
  }
}
```

---

## 7. E2E 测试场景

### 测试文件: `tests/e2e/scenarios/basic-debug.test.ts`

| 测试场景               | 描述               | 测试步骤                                                               | 预期结果       |
| ---------------------- | ------------------ | ---------------------------------------------------------------------- | -------------- |
| `simple_java_program`  | 简单 Java 程序调试 | 1. 启动 Java 程序<br>2. 连接调试器<br>3. 获取线程<br>4. 关闭           | 完整调试会话   |
| `multi_thread_program` | 多线程程序调试     | 1. 启动多线程程序<br>2. 获取所有线程<br>3. 挂起特定线程<br>4. 检查堆栈 | 正确处理多线程 |
| `exception_handling`   | 异常处理调试       | 1. 设置异常断点<br>2. 触发异常<br>3. 捕获异常事件                      | 异常正确捕获   |

### Java 测试程序

```java
// tests/e2e/fixtures/java/SimpleProgram.java
public class SimpleProgram {
    public static void main(String[] args) throws Exception {
        int x = 10;
        int y = 20;
        int sum = add(x, y);
        System.out.println("Sum: " + sum);
    }

    public static int add(int a, int b) {
        return a + b;
    }
}
```

```java
// tests/e2e/fixtures/java/MultiThreadProgram.java
public class MultiThreadProgram {
    public static void main(String[] args) throws Exception {
        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 10; i++) {
                System.out.println("Thread 1: " + i);
            }
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 10; i++) {
                System.out.println("Thread 2: " + i);
            }
        });

        t1.start();
        t2.start();
        t1.join();
        t2.join();
    }
}
```

### JVM 启动工具

```typescript
// tests/e2e/fixtures/launch.ts
import { spawn, ChildProcess } from "node:child_process";

interface LaunchOptions {
  mainClass: string;
  classpath?: string;
  debugPort?: number;
  suspend?: boolean;
}

export async function launchJava(options: LaunchOptions): Promise<{
  process: ChildProcess;
  debugPort: number;
}> {
  const debugPort = options.debugPort ?? 5005;
  const suspend = options.suspend ? "y" : "n";

  const args = [
    `-agentlib:jdwp=transport=dt_socket,server=y,suspend=${suspend},address=*:${debugPort}`,
  ];

  if (options.classpath) {
    args.push(`-cp`, options.classpath);
  }

  args.push(options.mainClass);

  const process = spawn("java", args, { stdio: "pipe" });

  // Wait for debugger to attach
  await waitForDebugReady(process, debugPort);

  return { process, debugPort };
}

async function waitForDebugReady(
  process: ChildProcess,
  port: number,
): Promise<void> {
  return new Promise((resolve) => {
    process.stderr?.on("data", (data) => {
      if (
        data
          .toString()
          .includes(`Listening for transport dt_socket at address: ${port}`)
      ) {
        resolve();
      }
    });
  });
}
```

---

## 测试配置

### Vitest 配置 - 集成测试

```typescript
// tests/integration/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: ["./setup.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/protocol/jdwp/**/*.ts"],
      exclude: ["src/protocol/jdwp/**/__tests__/**"],
    },
  },
});
```

### Vitest 配置 - E2E 测试

```typescript
// tests/e2e/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scenarios/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ["./setup.ts"],
    environment: "node",
    // E2E tests run serially
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
```

### 测试设置文件

```typescript
// tests/integration/setup.ts
import { beforeAll, afterAll } from "vitest";

let mockServer: MockJDWPServer;

beforeAll(async () => {
  mockServer = new MockJDWPServer();
  await mockServer.start();
});

afterAll(async () => {
  await mockServer.stop();
});

export { mockServer };
```

```typescript
// tests/e2e/setup.ts
import { beforeAll, afterAll } from "vitest";

// Compile Java test programs
beforeAll(async () => {
  // Compile all Java files in fixtures/java
  await $`javac -d tests/e2e/fixtures/java/classes tests/e2e/fixtures/java/*.java`;
});

// Cleanup after tests
afterAll(async () => {
  // Kill any remaining Java processes
  // Clean up temporary files
});
```

---

## 测试执行

### 运行集成测试

```bash
# 运行所有集成测试
npm run test:integration

# 运行特定测试文件
npm run test:integration -- connection.test.ts

# 带覆盖率
npm run test:integration -- --coverage
```

### 运行 E2E 测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行特定场景
npm run test:e2e -- basic-debug.test.ts
```

### package.json 脚本

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run src",
    "test:integration": "vitest run -c tests/integration/vitest.config.ts",
    "test:e2e": "vitest run -c tests/e2e/vitest.config.ts",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

---

## Mock JDWP 服务器详细设计

### 核心功能

```typescript
// tests/integration/jdwp/fixtures/mock-jdwp-server.ts
import * as net from "node:net";
import { EventEmitter } from "node:events";

export interface MockServerConfig {
  port?: number;
  idSizes?: IDSizes;
  version?: VersionInfo;
  capabilities?: Capabilities;
}

export class MockJDWPServer extends EventEmitter {
  private server: net.Server;
  private clients: Set<net.Socket> = new Set();
  private config: Required<MockServerConfig>;

  // State
  private threads: Map<string, ThreadState> = new Map();
  private classes: Map<string, ClassState> = new Map();
  private breakpoints: Map<number, BreakpointState> = new Map();

  constructor(config: MockServerConfig = {}) {
    super();
    this.config = this.getDefaultConfig(config);
    this.server = this.createServer();
    this.initializeState();
  }

  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, () => {
        const address = this.server.address() as net.AddressInfo;
        resolve(address.port);
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.destroy();
    }
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  // State manipulation for testing
  addThread(id: string, name: string, status: number): void {
    /* ... */
  }
  removeThread(id: string): void {
    /* ... */
  }
  addClass(signature: string, refID: string): void {
    /* ... */
  }
  triggerBreakpoint(requestID: number): void {
    /* ... */
  }

  // Error injection
  dropConnection(): void {
    /* ... */
  }
  sendMalformedPacket(): void {
    /* ... */
  }
  delayResponses(ms: number): void {
    /* ... */
  }

  private handlePacket(socket: net.Socket, data: Buffer): void {
    const packet = this.parseCommandPacket(data);
    const response = this.processCommand(packet);
    socket.write(response);
  }

  private processCommand(packet: CommandPacket): Buffer {
    switch (packet.commandSet) {
      case CommandSet.VirtualMachine:
        return this.handleVMCommand(packet);
      case CommandSet.ThreadReference:
        return this.handleThreadCommand(packet);
      case CommandSet.EventRequest:
        return this.handleEventRequestCommand(packet);
      // ... other command sets
      default:
        return this.createErrorReply(packet, ErrorCode.NotImplemented);
    }
  }
}
```

---

## 测试数据捕获工具

### 真实 JDWP 包捕获

```typescript
// tests/integration/jdwp/fixtures/packet-capture.ts
import * as fs from "node:fs";
import * as path from "node:path";

export interface CapturedPacket {
  direction: "request" | "reply";
  timestamp: number;
  data: Buffer;
  parsed?: unknown;
}

export class PacketCapture {
  private packets: CapturedPacket[] = [];

  captureRequest(data: Buffer): void {
    this.packets.push({
      direction: "request",
      timestamp: Date.now(),
      data: Buffer.from(data),
    });
  }

  captureReply(data: Buffer): void {
    this.packets.push({
      direction: "reply",
      timestamp: Date.now(),
      data: Buffer.from(data),
    });
  }

  save(name: string): void {
    const filePath = path.join(__dirname, "packet-captures", `${name}.json`);
    const serialized = this.packets.map((p) => ({
      ...p,
      data: p.data.toString("base64"),
    }));
    fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2));
  }

  static load(name: string): CapturedPacket[] {
    const filePath = path.join(__dirname, "packet-captures", `${name}.json`);
    const serialized = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return serialized.map((p: any) => ({
      ...p,
      data: Buffer.from(p.data, "base64"),
    }));
  }
}
```

---

## 持续集成配置

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          flags: unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm run test:integration
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          flags: integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - uses: actions/setup-java@v4
        with:
          java-version: "17"
          distribution: "temurin"
      - run: npm ci
      - run: npm run test:e2e
```

---

## 测试覆盖率目标

| 测试类型 | 目标覆盖率    | 说明         |
| -------- | ------------- | ------------ |
| 单元测试 | ≥ 80%         | 所有模块     |
| 集成测试 | ≥ 60%         | 关键路径     |
| E2E 测试 | 关键场景 100% | 核心调试流程 |

---

## 注意事项

1. **测试隔离**: 集成测试和 E2E 测试必须完全隔离，不依赖外部状态
2. **资源清理**: 每个测试后必须清理所有资源（连接、进程、文件等）
3. **超时设置**: 集成测试超时 30s，E2E 测试超时 60s
4. **并行执行**: 单元测试和集成测试可并行，E2E 测试串行执行
5. **Mock 真实性**: Mock Server 行为应尽可能接近真实 JVM JDWP 行为
6. **测试数据**: 使用真实捕获的 JDWP 包作为测试数据，确保协议兼容性

---

## 更新日志

- 2026-04-14: 初始版本，完成集成测试设计方案
