# SDK 设计与扩展方案

## 概述

本文档分析 cli-debugger 项目当前功能现状，提出 SDK 封装方案、断言系统、数据查询系统的设计，以及协议扩展路线图。

目标：将 CLI 能力以**程序化 SDK** 的形式暴露，支持自动化测试、CI 集成、IDE 插件等场景。

---

## 一、项目现状分析

### 1.1 现有功能矩阵

| 模块 | 状态 | 说明 |
|------|------|------|
| **CLI 命令行** (12 命令) | ✅ 完成 | debug/stop/restart/sessions/step/continue/pause/break/context/eval/inspect/threads/thread/output |
| **协议架构** | ✅ 完成 | DebugProtocol 接口 + registerProtocol 插件注册机制 |
| **会话管理** | ✅ 完成 | SessionManager：多会话生命周期、线程/帧追踪、Auto-Context |
| **输出格式化** | ✅ 完成 | text/json/table 三种模式，含截断保护 |
| **配置系统** | ✅ 完成 | Zod 运行时验证、TOML 文件加载、Profile 管理 |
| **错误体系** | ✅ 完成 | 5 类 ErrorType、JDWP 错误码映射、APIError 结构化上下文 |
| **监控模块** | ✅ 完成 | Poller + StreamMonitor 接口 |
| **平台检测** | ✅ 完成 | 跨平台进程发现（Unix/Windows） |
| **DLV 协议** (Go) | ✅ 完整 | 实现 ExtendedDebugProtocol 全部接口（eval/typeInfo/symbol/metadata/batchInfo） |
| **LLDB 协议** (C/C++/Rust) | ✅ 完整 | 实现 ExtendedDebugProtocol 全部接口 |
| **JDWP 协议** (Java) | ⚠️ 基础 | 仅实现 DebugProtocol，缺少 ExtendedDebugProtocol |
| **debugpy 协议** (Python) | ❌ 桩 | 仅骨架，connect() 抛出 NotImplemented |
| **js-debug 协议** (JS/TS) | ❌ 桩 | 仅骨架，connect() 抛出 NotImplemented |
| **测试体系** | ✅ 871 tests | 63 个测试文件，Vitest 4.x |

### 1.2 架构现状

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI (Commander)                       │
│   debug/stop/restart/sessions/step/continue/pause/break/    │
│   context/eval/inspect/threads/thread/output                │
└──────────────┬──────────────────────────────────────────────┘
               │ uses
┌──────────────▼──────────────────────────────────────────────┐
│                    SessionManager                            │
│   多会话管理 / 线程/帧追踪 / Auto-Context 构建               │
└──────────────┬──────────────────────────────────────────────┘
               │ delegates to
┌──────────────▼──────────────────────────────────────────────┐
│              DebugProtocol / ExtendedDebugProtocol           │
│    DLV  │  JDWP  │  LLDB  │  debugpy*  │  js-debug*         │
└─────────────────────────────────────────────────────────────┘
```

**关键问题**：
- 程序化调用只能通过 `createClient()` + `SessionManager` 手动组合，缺少高级抽象
- CLI 与业务逻辑耦合在 handler 中，无法复用
- 无断言/验证工具，无法用于自动化测试
- 无事件通知机制，只能轮询 waitForEvent

### 1.3 需要扩展的功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| debugpy/js-debug 协议实现 | P1 | 补齐两个桩协议 |
| JDWP ExtendedDebugProtocol | P1 | 添加 eval/typeInfo/symbol 等能力 |
| 寄存器/内存查看 | P2 | LLDB 已定义类型但无 API 暴露 |
| Watchpoint（数据断点） | P2 | 目前所有协议均不支持 |
| 变量修改增强 | P2 | setField 接口存在但缺少高级修改能力 |
| 反汇编视图 | P3 | 暂无支持计划 |
| 源码映射 | P3 | 目前仅简易的文件行号定位 |

---

## 二、SDK 包设计

### 2.1 设计目标

- **零配置起步**：一行代码创建调试会话
- **事件驱动**：订阅断点命中、输出、线程变化等事件
- **链式调用**：流畅的 API 设计
- **类型安全**：完整的 TypeScript 类型推导
- **与 CLI 共享内核**：SDK 底层复用现有协议层和会话管理

### 2.2 包结构

```
src/sdk/
├── index.ts                  # 公共导出入口
├── debugger.ts               # Debugger 主类
├── session.ts                # Session 封装（会话对象）
├── events.ts                 # 事件系统
├── watch.ts                  # 观察者（watch variable/expression）
├── query/
│   ├── index.ts              # 查询入口
│   ├── variable.ts           # 变量查询
│   ├── thread.ts             # 线程查询
│   └── stack.ts              # 栈帧查询
├── assert/
│   ├── index.ts              # 断言入口
│   ├── breakpoint.ts         # 断点断言
│   ├── variable.ts           # 变量断言
│   ├── execution.ts          # 执行状态断言
│   └── expression.ts         # 表达式断言
├── format/
│   ├── index.ts              # 格式化入口
│   ├── json.ts               # JSON 格式化
│   ├── text.ts               # 文本格式化
│   └── table.ts              # 表格格式化
└── config/
    ├── index.ts              # 配置入口
    ├── builder.ts            # 配置构建器
    └── presets.ts            # 预置配置
```

### 2.3 Debugger 主类

```typescript
// 核心 API
class Debugger {
  // ─── 创建与连接 ───

  /** 创建并连接调试会话 */
  static connect(config: DebugConfig | string): Promise<Debugger>;

  /** 创建调试器实例（不连接） */
  constructor(config: DebugConfig);

  /** 连接到调试目标 */
  connect(): Promise<this>;

  /** 断开连接 */
  disconnect(): Promise<void>;

  // ─── 执行控制 ───

  /** 继续执行 */
  continue(threadId?: string): Promise<AutoContext>;

  /** 暂停 */
  pause(threadId?: string): Promise<AutoContext>;

  /** 单步（in/over/out） */
  stepIn(threadId?: string): Promise<AutoContext>;
  stepOver(threadId?: string): Promise<AutoContext>;
  stepOut(threadId?: string): Promise<AutoContext>;

  // ─── 断点管理 ───

  /** 设置断点 */
  breakpoint(location: string, options?: BreakpointOptions): Promise<string>;

  /** 获取所有断点 */
  breakpoints(): Promise<BreakpointInfo[]>;

  /** 移除断点 */
  removeBreakpoint(id: string): Promise<void>;

  /** 清除所有断点 */
  clearBreakpoints(): Promise<void>;

  // ─── 数据查询 ───

  /** 获取局部变量 */
  locals(threadId?: string, frameIndex?: number): Promise<Variable[]>;

  /** 求值表达式 */
  evaluate(expression: string, options?: EvalOptions): Promise<EvalResult>;

  /** 检查变量 */
  inspect(name: string, options?: InspectOptions): Promise<VariableDetail>;

  /** 获取线程列表 */
  threads(): Promise<ThreadInfo[]>;

  /** 获取栈帧 */
  stack(threadId?: string): Promise<StackFrame[]>;

  // ─── 事件订阅 ───

  /** 订阅事件 */
  on(event: 'breakpoint', handler: (event: BreakpointEvent) => void): this;
  on(event: 'output', handler: (event: OutputEvent) => void): this;
  on(event: 'thread', handler: (event: ThreadEvent) => void): this;
  on(event: 'error', handler: (event: ErrorEvent) => void): this;
  on(event: 'state', handler: (event: StateEvent) => void): this;
  on(event: string, handler: (...args: unknown[]) => void): this;

  /** 取消订阅 */
  off(event: string, handler: (...args: unknown[]) => void): this;

  // ─── 观察者 ───

  /** 监控变量变化 */
  watchVariable(name: string, callback: (value: unknown) => void, options?: WatchOptions): Promise<WatchHandle>;

  /** 监控表达式 */
  watchExpression(expr: string, callback: (result: EvalResult) => void, options?: WatchOptions): Promise<WatchHandle>;

  /** 取消观察 */
  unwatch(handle: WatchHandle): void;

  // ─── 会话管理 ───

  /** 获取当前会话信息 */
  info(): SessionInfo;

  /** 切换当前线程 */
  useThread(threadId: string): this;

  /** 切换栈帧 */
  useFrame(frameIndex: number): this;

  /** 获取状态 */
  getState(): 'connected' | 'disconnected' | 'running' | 'paused';
}
```

### 2.4 使用示例

```typescript
// 基础用法：调试 Java 程序
const dbg = await Debugger.connect({
  protocol: 'jdwp',
  host: '127.0.0.1',
  port: 5005,
});

// 设置断点
await dbg.breakpoint('com.example.App:42');

// 继续执行
await dbg.continue();

// 订阅断点命中事件
dbg.on('breakpoint', (event) => {
  console.log(`Hit breakpoint ${event.id} at ${event.location}`);
  // 自动获取上下文
  const locals = await dbg.locals();
  const stack = await dbg.stack();
});

// 监控变量
const watch = await dbg.watchVariable('user.name', (value) => {
  console.log('user.name changed:', value);
});

// 求值
const result = await dbg.evaluate('calculateTotal()', { timeout: 5000 });

// 断言
import { assert } from '@cli-debugger/sdk/assert';
await assert.variable('count', 42);
await assert.hitBreakpoint('bp-1');

// 格式化输出
import { format } from '@cli-debugger/sdk/format';
console.log(format.table(locals));
```

### 2.5 事件系统

```typescript
// 事件类型
interface BreakpointEvent {
  type: 'breakpoint';
  id: string;
  location: string;
  threadId: string;
  timestamp: Date;
}

interface OutputEvent {
  type: 'output';
  threadId: string;
  data: string[];
  stream: 'stdout' | 'stderr';
}

interface ThreadEvent {
  type: 'thread';
  threadId: string;
  action: 'started' | 'stopped' | 'suspended' | 'resumed';
}

interface StateEvent {
  type: 'state';
  previous: string;
  current: string;
}

interface ErrorEvent {
  type: 'error';
  code: number;
  message: string;
  context?: Record<string, unknown>;
}
```

**实现方式**：基于 Node.js `EventEmitter`，在底层 `waitForEvent` 之上封装事件分发层，自动轮询事件并派发到注册的 handler。

```typescript
class DebuggerEventEmitter extends EventEmitter {
  private polling = false;
  private pollInterval = 100; // ms

  startPolling(client: DebugProtocol): void {
    if (this.polling) return;
    this.polling = true;
    this.pollLoop(client);
  }

  private async pollLoop(client: DebugProtocol): Promise<void> {
    while (this.polling) {
      try {
        const event = await client.waitForEvent(200);
        if (event) {
          this.dispatch(event);
        }
      } catch {
        // 超时正常，继续轮询
      }
    }
  }

  private dispatch(event: DebugEvent): void {
    // 根据 event.type 分发到对应 handler
    this.emit(event.type, this.toTypedEvent(event));
    // 同时触发通用 handler
    this.emit('*', event);
  }
}
```

---

## 三、断言系统

### 3.1 设计目标

- 为自动化测试场景提供验证能力
- 断言失败时提供清晰的诊断信息（期望值 vs 实际值）
- 支持超时等待（某些断言需要等待异步事件）
- 与主流测试框架（Vitest/Jest）兼容

### 3.2 断言 API

```typescript
// 断言模块
export const assert = {
  // ─── 断点断言 ───

  /** 断言断点已被命中指定次数 */
  async hitBreakpoint(id: string, times?: number): Promise<void>;

  /** 断言断点未被命中 */
  async notHitBreakpoint(id: string): Promise<void>;

  /** 断言存在指定位置的断点 */
  async breakpointExists(location: string): Promise<void>;

  /** 断言断点数量 */
  async breakpointCount(n: number): Promise<void>;

  // ─── 变量断言 ───

  /** 断言变量值等于期望值 */
  async variable(name: string, expected: unknown, options?: AssertOptions): Promise<void>;

  /** 断言变量值不等于期望值 */
  async variableNot(name: string, expected: unknown, options?: AssertOptions): Promise<void>;

  /** 断言变量满足条件函数 */
  async variableSatisfies(name: string, predicate: (value: unknown) => boolean, msg?: string): Promise<void>;

  /** 断言变量类型 */
  async variableType(name: string, type: string): Promise<void>;

  // ─── 表达式断言 ───

  /** 断言表达式求值结果 */
  async expression(expr: string, expected: unknown, options?: EvalAssertOptions): Promise<void>;

  /** 断言表达式求值抛出错误 */
  async expressionThrows(expr: string, errorPattern?: string | RegExp): Promise<void>;

  // ─── 执行状态断言 ───

  /** 断言当前为暂停状态 */
  async paused(): Promise<void>;

  /** 断言当前为运行状态 */
  async running(): Promise<void>;

  /** 断言线程数量 */
  async threadCount(n: number): Promise<void>;

  /** 断言栈深度 */
  async stackDepth(n: number): Promise<void>;

  /** 断言当前栈顶方法 */
  async topFrame(method: string, options?: TopFrameOptions): Promise<void>;
};

// 断言选项
interface AssertOptions {
  timeout?: number;      // 等待超时（毫秒）
  threadId?: string;     // 指定线程
  frameIndex?: number;   // 指定栈帧
}

interface EvalAssertOptions extends AssertOptions {
  errorOnFailure?: boolean;  // 求值失败时是否视为断言失败
}

interface TopFrameOptions {
  timeout?: number;
  threadId?: string;
}
```

### 3.3 断言实现策略

```typescript
// 核心实现模式
class AssertEngine {
  constructor(private dbg: Debugger) {}

  async assertVariable(name: string, expected: unknown, options?: AssertOptions): Promise<void> {
    const timeout = options?.timeout ?? 5000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const locals = await this.dbg.locals(options?.threadId, options?.frameIndex);
      const variable = locals.find(v => v.name === name);

      if (variable) {
        if (this.deepEqual(variable.value, expected)) {
          return; // 断言通过
        }
        // 未匹配，继续等待（可能正在执行）
      }

      await this.delay(100);
    }

    // 超时，收集诊断信息
    const actual = await this.dbg.locals(options?.threadId, options?.frameIndex);
    throw new AssertionError(
      `Expected variable '${name}' to equal ${JSON.stringify(expected)}`,
      { name, expected, actual: actual.find(v => v.name === name)?.value },
    );
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    // 简单的深度比较
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 断言错误
class AssertionError extends Error {
  constructor(
    message: string,
    public readonly detail: {
      expected: unknown;
      actual: unknown;
      name?: string;
    },
  ) {
    super(message);
    this.name = 'AssertionError';
  }
}
```

### 3.4 与测试框架集成

```typescript
// 直接用于 Vitest 测试
import { describe, it, expect } from 'vitest';
import { Debugger } from '@cli-debugger/sdk';
import { assert } from '@cli-debugger/sdk/assert';

describe('Java debug integration', () => {
  let dbg: Debugger;

  beforeAll(async () => {
    dbg = await Debugger.connect({ protocol: 'jdwp', port: 5005 });
  });

  afterAll(async () => {
    await dbg.disconnect();
  });

  it('should hit breakpoint and inspect variable', async () => {
    await dbg.breakpoint('com.example.App:42');
    await dbg.continue();

    // 等待断点命中
    await assert.hitBreakpoint('bp-1', { timeout: 10000 });
    await assert.variable('count', 0);
    await assert.topFrame('App.main');
  });

  it('should evaluate expression', async () => {
    const result = await dbg.evaluate('2 + 2');
    expect(result.value).toBe(4);
  });
});
```

---

## 四、查询与格式化系统

### 4.1 查询 API

```typescript
// 查询模块
export const query = {
  /** 获取变量详情 */
  async variable(name: string, options?: QueryOptions): Promise<VariableDetail>;

  /** 按名称模式查找变量 */
  async findVariable(pattern: string, options?: QueryOptions): Promise<VariableDetail[]>;

  /** 获取线程 */
  async thread(id?: string): Promise<ThreadInfo | undefined>;

  /** 按名称查找线程 */
  async threadByName(name: string): Promise<ThreadInfo | undefined>;

  /** 获取栈帧 */
  async stack(threadId?: string, filter?: StackFilter): Promise<StackFrame[]>;

  /** 获取当前源代码上下文 */
  async sourceContext(options?: SourceContextOptions): Promise<SourceContext>;

  /** 获取所有断点 */
  async breakpoints(filter?: BreakpointFilter): Promise<BreakpointInfo[]>;

  /** 获取调试目标元数据 */
  async metadata(): Promise<TargetMetadata>;
};

interface QueryOptions {
  threadId?: string;
  frameIndex?: number;
  depth?: number;           // 对象展开深度
  includeFields?: boolean;  // 是否包含字段信息
  includeType?: boolean;    // 是否包含类型信息
}

interface StackFilter {
  method?: string | RegExp;
  file?: string | RegExp;
  minDepth?: number;
  maxDepth?: number;
}

interface BreakpointFilter {
  enabled?: boolean;
  location?: string | RegExp;
  type?: string;
}

interface SourceContext {
  file: string;
  line: number;
  method: string;
  lines: string[];      // 源码行
  startLine: number;    // 起始行号
  threadId: string;
  frameIndex: number;
}

interface VariableDetail extends Variable {
  fields?: Variable[];   // 展开的字段
  typeInfo?: TypeInfo;   // 类型信息（协议支持时）
}
```

### 4.2 格式化 API

```typescript
// 格式化模块
export const format = {
  /** 格式化变量 */
  variable(v: Variable, options?: FormatOptions): string;

  /** 格式化变量列表为表格 */
  variables(vars: Variable[], options?: FormatOptions): string;

  /** 格式化栈帧 */
  stack(frames: StackFrame[], options?: FormatOptions): string;

  /** 格式化线程列表 */
  threads(threads: ThreadInfo[], options?: FormatOptions): string;

  /** 格式化断点列表 */
  breakpoints(bps: BreakpointInfo[], options?: FormatOptions): string;

  /** 格式化事件 */
  event(event: DebugEvent): string;

  /** 格式化任意值为 JSON */
  json(data: unknown): string;

  /** 格式化任意值为表格 */
  table(headers: string[], rows: string[][]): string;

  /** 格式化任意值为文本 */
  text(data: unknown): string;
};

interface FormatOptions {
  color?: boolean;        // 是否启用颜色
  truncate?: boolean;     // 是否截断长值
  maxValueLength?: number; // 值最大长度
  maxArrayPreview?: number; // 数组预览最大数量
  indent?: number;        // 缩进
}
```

### 4.3 实现方式

格式化模块复用现有 `src/output/` 和 `src/cli/formatter.ts` 中的逻辑，但输出到字符串而非 `process.stdout`：

```typescript
class StringFormatter {
  private buffer: string[] = [];

  write(text: string): void {
    this.buffer.push(text);
  }

  toString(): string {
    return this.buffer.join('');
  }

  clear(): void {
    this.buffer = [];
  }
}

// 适配器模式：复用现有 Formatter 接口
class SdkFormatterAdapter implements Formatter {
  private writer = new StringFormatter();

  constructor(private baseFormatter: Formatter) {}

  async formatVersion(info: VersionInfo): Promise<string> {
    this.writer.clear();
    await this.baseFormatter.formatVersion(info);
    return this.writer.toString();
  }

  // ... 其他方法类似
}
```

---

## 五、协议扩展计划

### 5.1 debugpy 协议实现

需要实现完整 DebugProtocol：

| 方法 | 实现方式 |
|------|---------|
| connect() | 建立 TCP 连接，发送 DAP Initialize/Launch/ConfigurationDone |
| threads() | 解析 DAP ThreadsResponse |
| stack() | 解析 DAP StackTraceResponse |
| setBreakpoint() | 发送 DAP SetBreakpoints |
| stepOver/Into/Out() | 发送 DAP Next/StepIn/StepOut |
| resume() | 发送 DAP Continue |
| suspend() | 发送 DAP Pause |
| locals() | 发送 DAP Scopes + Variables |
| waitForEvent() | 解析 DAP StoppedEvent/OutputEvent |

### 5.2 js-debug 协议实现

与 debugpy 类似，基于 DAP（Debug Adapter Protocol），通过 Node.js 子进程启动 js-debug 适配器。

### 5.3 JDWP 扩展接口

JDWP 当前仅实现 DebugProtocol，需要扩展：

| 扩展方法 | JDWP 实现方式 |
|---------|-------------|
| eval() | 使用 InvokeMethod 命令在目标线程执行表达式 |
| getTypeInfo() | 使用 ReferenceType 命令获取类型信息 |
| getSymbol() | 使用 ClassType 命令获取符号信息 |
| getTargetMetadata() | 使用 VM 命令获取元数据 |

---

## 六、实现路线图

### Phase 1: SDK 核心 (P0)
- [ ] `Debugger` 主类实现
- [ ] 事件系统（EventEmitter + 自动轮询）
- [ ] 配置构建器（ConfigBuilder + Presets）
- [ ] 基础查询 API（variable/thread/stack）

### Phase 2: 断言与格式化 (P0)
- [ ] 断言系统核心（AssertEngine）
- [ ] 断点断言（hitBreakpoint/notHitBreakpoint/breakpointExists）
- [ ] 变量断言（variable/variableNot/variableSatisfies）
- [ ] 执行状态断言（paused/running/threadCount/stackDepth/topFrame）
- [ ] 表达式断言（expression/expressionThrows）
- [ ] 格式化 API（variable/stack/threads/breakpoints/table/json/text）

### Phase 3: 协议补齐 (P1)
- [ ] debugpy 协议实现
- [ ] js-debug 协议实现
- [ ] JDWP ExtendedDebugProtocol 扩展

### Phase 4: 高级功能 (P1)
- [ ] Watch 机制（watchVariable/watchExpression）
- [ ] 表达式断言集成
- [ ] 变量监控（变化检测 + 通知）

### Phase 5: 完善与文档 (P2)
- [ ] 完整的 API 文档
- [ ] 示例代码（各种语言/场景）
- [ ] CLI 集成测试增强
- [ ] 与 CLI 的共享抽象提取（复用 CLI handler 中的逻辑）

---

## 七、架构演进

### 最终架构

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLI (Commander)                          │
│   debug/stop/... → 复用 SDK 实现，handler 仅做参数解析和输出      │
└──────────────────────┬───────────────────────────────────────────┘
                       │ delegates to
┌──────────────────────▼───────────────────────────────────────────┐
│                       @cli-debugger/sdk                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Debugger 主类     │  Events 系统    │  Watch 机制       │   │
│  │  ──────────────────────────────────────────────────────── │   │
│  │  query/           │  assert/        │  format/           │   │
│  │  (变量/线程/栈)    │  (断点/变量/    │  (变量/栈/线程/    │   │
│  │                    │   执行/表达式)   │   断点/table)      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ wraps
┌──────────────────────▼───────────────────────────────────────────┐
│                    SessionManager                                 │
│    多会话管理 / 线程/帧追踪 / Auto-Context 构建                   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ delegates to
┌──────────────────────▼───────────────────────────────────────────┐
│              DebugProtocol / ExtendedDebugProtocol                │
│    DLV  │  JDWP  │  LLDB  │  debugpy  │  js-debug               │
└──────────────────────────────────────────────────────────────────┘
```

### 关键设计原则

1. **SDK 不替代 CLI**：CLI 仍然是主要用户界面，SDK 暴露相同能力给程序化调用
2. **共享内核**：CLI handler 应逐步重构为调用 SDK 方法，而非直接操作 SessionManager
3. **渐进式复杂**：简单场景一行代码搞定，复杂场景可深入各层
4. **协议无关**：SDK 接口对所有协议统一，差异在内部处理
5. **错误可恢复**：APIError 体系提供结构化错误信息，便于程序化处理

---

## 八、包发布策略

### 包名

```
@cli-debugger/sdk          # SDK 核心包
@cli-debugger/core         # 现有核心协议层（可选拆分）
```

### 导出策略

```json
{
  "exports": {
    ".": "./src/sdk/index.ts",
    "./assert": "./src/sdk/assert/index.ts",
    "./query": "./src/sdk/query/index.ts",
    "./format": "./src/sdk/format/index.ts",
    "./config": "./src/sdk/config/index.ts"
  }
}
```

### 依赖关系

```
@cli-debugger/sdk
  ├── 依赖: @cli-debugger/core (协议层、会话管理、类型定义)
  └── 可选依赖: chalk (格式化颜色)
```

---

## 九、附录

### A. 与其他调试工具的对比

| 特性 | cli-debugger 当前 | VS Code DAP | GDB/MI | LLDB CLI |
|------|------------------|-------------|--------|----------|
| 多语言 | ✅ 5 协议 | ✅ 多适配器 | ❌ C/C++ | ❌ C/C++/Swift |
| 程序化 SDK | ❌ 缺失 | ✅ vscode.debug | ✅ gdb/mi | ✅ lldb Python |
| 断言 | ❌ 缺失 | ❌ 无 | ❌ 无 | ❌ 无 |
| 事件系统 | ⚠️ 基础 | ✅ 完整 | ⚠️ 基础 | ⚠️ 基础 |
| 变量监控 | ❌ 缺失 | ⚠️ 断点 | ✅ watch | ✅ watch |

### B. 参考设计

- VS Code Debug Adapter Protocol (DAP) 的事件模型
- Puppeteer/Playwright 的断言和等待机制
- Node.js `assert` 模块的断言风格
- Chai.js 的链式断言 DSL