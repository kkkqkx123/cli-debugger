# 测试文档

## 测试结构

本项目包含三个层次的测试：

```
tests/
├── integration/           # 集成测试
│   ├── jdwp/             # JDWP 协议集成测试
│   │   ├── connection.test.ts      # 连接生命周期测试
│   │   ├── protocol.test.ts        # 协议编解码测试
│   │   ├── commands.test.ts        # 命令执行测试
│   │   ├── events.test.ts          # 事件处理测试
│   │   ├── error-recovery.test.ts  # 错误恢复测试
│   │   ├── performance.test.ts     # 性能基准测试
│   │   └── fixtures/               # 测试固件
│   │       ├── mock-jdwp-server.ts # Mock JDWP 服务器
│   │       ├── test-data.ts        # 测试数据生成器
│   │       ├── error-injector.ts   # 错误注入器
│   │       ├── event-collector.ts  # 事件收集器
│   │       └── benchmark.ts        # 性能测试工具
│   ├── setup.ts          # 测试环境设置
│   └── vitest.config.ts  # 集成测试配置
│
└── e2e/                  # 端到端测试
    ├── scenarios/        # 测试场景
    │   ├── basic-debug.test.ts    # 基础调试测试
    │   ├── breakpoint.test.ts     # 断点测试
    │   ├── step.test.ts           # 单步测试
    │   └── variable.test.ts       # 变量检查测试
    ├── fixtures/         # 测试固件
    │   ├── java/         # Java 测试程序
    │   │   ├── SimpleProgram.java
    │   │   ├── MultiThreadProgram.java
    │   │   ├── BreakpointTest.java
    │   │   └── ExceptionTest.java
    │   └── launch.ts     # JVM 启动工具
    ├── setup.ts          # 测试环境设置
    └── vitest.config.ts  # E2E 测试配置
```

## 运行测试

### 运行所有测试

```bash
npm test
```

### 运行单元测试

```bash
npm run test:unit
```

### 运行集成测试

```bash
npm run test:integration
```

### 运行 E2E 测试

```bash
npm run test:e2e
```

### 运行测试覆盖率

```bash
npm run test:coverage
```

## 测试说明

### 集成测试

集成测试使用 Mock JDWP Server 模拟 JVM 调试目标，无需真实的 JVM 进程。

**测试覆盖范围：**

1. **连接生命周期测试** (`connection.test.ts`)
   - 完整连接生命周期
   - 连接-断开-重连
   - 多客户端并发连接
   - 连接超时恢复
   - 优雅关闭

2. **协议编解码测试** (`protocol.test.ts`)
   - 编解码往返测试
   - 包分片处理
   - 包拼接处理
   - 不同 ID 大小
   - UTF-8 字符串编码
   - 各种值类型往返

3. **命令执行测试** (`commands.test.ts`)
   - VM 命令序列
   - 线程操作流程
   - 断点生命周期
   - 变量检查流程
   - 单步操作序列
   - 并发命令执行

4. **事件处理测试** (`events.test.ts`)
   - 断点事件流程
   - 单步事件序列
   - 异常事件处理
   - 事件等待超时
   - 事件队列管理

5. **错误恢复测试** (`error-recovery.test.ts`)
   - 连接丢失恢复
   - 错误包恢复
   - 协议错误恢复
   - 超时恢复
   - 无效 ID 恢复
   - 资源耗尽处理

6. **性能基准测试** (`performance.test.ts`)
   - 连接时间
   - 命令延迟
   - 命令吞吐量
   - 内存使用
   - 大数据处理

### E2E 测试

E2E 测试需要真实的 JVM 环境，测试与真实 Java 程序的交互。

**前置条件：**
- 安装 Java JDK 8 或更高版本
- `java` 和 `javac` 命令在 PATH 中可用

**测试场景：**

1. **基础调试测试** (`basic-debug.test.ts`)
   - 简单 Java 程序调试
   - 连接管理
   - 元数据查询

2. **断点测试** (`breakpoint.test.ts`)
   - 断点管理
   - 断点工作流

3. **单步测试** (`step.test.ts`)
   - 线程挂起/恢复
   - 堆栈检查
   - 变量检查

4. **变量检查测试** (`variable.test.ts`)
   - 堆栈帧获取
   - 局部变量检查
   - 对象字段检查
   - 线程状态查询

## Mock JDWP Server

Mock JDWP Server 是一个模拟 JDWP 协议的服务器，用于集成测试。

**功能：**
- 完整的 JDWP 握手协议
- 基本的命令响应
- 可配置的线程、断点、类信息
- 错误注入支持
- 延迟响应支持

**使用示例：**

```typescript
import { MockJDWPServer } from './fixtures/index.js';

const server = new MockJDWPServer();
const port = await server.start();

// 配置状态
server.updateState({
  threads: [
    { id: '1', name: 'main', status: 2, suspendStatus: 0 },
  ],
});

// 模拟错误
server.simulateError();

// 停止服务器
await server.stop();
```

## 测试工具

### EventCollector

收集和管理调试事件：

```typescript
import { EventCollector } from './fixtures/index.js';

const collector = new EventCollector();

// 收集事件
const events = await collector.collect(client, 1000);

// 按类型过滤
const breakpointEvents = collector.findByType('breakpoint');

// 等待特定事件
const event = await collector.waitForEventType(client, 'breakpoint', 5000);
```

### ErrorInjector

注入各种错误用于测试错误恢复：

```typescript
import { ErrorInjector } from './fixtures/index.js';

const injector = new ErrorInjector(server);

// 注入连接断开
injector.injectConnectionDrop();

// 注入错误包
injector.injectMalformedPacket();

// 注入协议错误
injector.injectProtocolError();

// 清除错误
injector.clearErrors();
```

### Benchmark

性能测试工具：

```typescript
import { Benchmark } from './fixtures/index.js';

// 测量执行时间
const { result, duration } = await Benchmark.measureTime(() => client.version());

// 测量吞吐量
const throughput = await Benchmark.measureThroughput(() => client.version(), 1000);

// 测量内存使用
const memory = Benchmark.takeMemorySnapshot();
```

## Java 测试程序

E2E 测试使用以下 Java 程序：

1. **SimpleProgram.java** - 简单程序，包含基本方法和变量
2. **MultiThreadProgram.java** - 多线程程序，测试线程管理
3. **BreakpointTest.java** - 断点测试程序，包含多个方法
4. **ExceptionTest.java** - 异常测试程序，测试异常处理

## 注意事项

1. E2E 测试默认跳过，如果 Java 不可用
2. 集成测试使用 Mock Server，不需要真实 JVM
3. 性能基准测试结果仅供参考，实际性能取决于运行环境
4. 测试超时设置：
   - 集成测试：30 秒
   - E2E 测试：60 秒
