# TypeScript CLI Debugger 技术方案

> 本文档描述 CLI Debugger 从 Go 迁移到 TypeScript 的完整技术方案，采用单包结构，提供可编程的调试 API 和 DSL。

## 目录

- [1. 需求分析](#1-需求分析)
- [2. 项目结构](#2-项目结构)
- [3. 核心 API 设计](#3-核心-api-设计)
- [4. DSL 设计](#4-dsl-设计)
- [5. 依赖管理](#5-依赖管理)
- [6. 迁移策略](#6-迁移策略)

---

## 1. 需求分析

### 1.1 核心需求

1. **提供可编程的调试 API**: 允许用户通过代码定义调试操作序列
2. **支持 DSL**: 提供领域特定语言简化调试脚本编写
3. **多协议支持**: 当前支持 JDWP，未来可扩展 DAP、CDP 等
4. **脚本化能力**: 无需编译即可运行调试脚本

### 1.2 使用场景

```typescript
// 场景 1: 编程式 API
const client = await createClient({ protocol: 'jdwp', port: 5005 });
const threads = await client.threads();
await client.suspend(threads[0].id);
const locals = await client.locals(threads[0].id, 0);
console.log(locals);
await client.resume(threads[0].id);

// 场景 2: DSL 链式调用
const dsl = new DebugDSL({ protocol: 'jdwp', port: 5005 });
await dsl.run(async (debug) => {
  await debug
    .thread('main')
    .suspend()
    .breakpointAt('com.example.Main', 42)
    .inspectVariables()
    .resume();
});
```

---

## 2. 项目结构

### 2.1 目录结构

```
cli-debugger/
├── src/                           # 源代码根目录
│   ├── index.ts                   # 公共 API 导出
│   ├── protocol/                  # 协议层
│   │   ├── index.ts               # 协议模块导出
│   │   ├── base.ts                # DebugProtocol 接口定义
│   │   ├── types.ts               # 类型定义
│   │   ├── client.ts              # 客户端工厂函数
│   │   ├── errors.ts              # 错误类型定义
│   │   └── jdwp/                  # JDWP 协议实现
│   │       ├── index.ts           # JDWP 模块导出
│   │       ├── client.ts          # JDWP 客户端
│   │       ├── codec.ts           # JDWP 协议编解码
│   │       ├── handshake.ts       # 握手协议
│   │       ├── vm.ts              # VirtualMachine 命令集
│   │       ├── thread.ts          # ThreadReference 命令集
│   │       ├── breakpoint.ts      # EventRequest 命令集
│   │       ├── stack.ts           # StackFrame 查询
│   │       ├── variable.ts        # 变量检查
│   │       └── event.ts           # 事件处理
│   ├── dsl/                       # DSL 层
│   │   ├── index.ts               # DSL 模块导出
│   │   ├── builder.ts             # 链式 API 构建器
│   │   └── interpreter.ts         # 脚本解释器
│   ├── cli/                       # CLI 命令实现
│   │   ├── index.ts               # CLI 入口
│   │   ├── commands/              # 命令实现
│   │   │   ├── threads.ts
│   │   │   ├── stack.ts
│   │   │   ├── breakpoints.ts
│   │   │   ├── variables.ts
│   │   │   ├── control.ts
│   │   │   └── step.ts
│   │   └── utils/
│   │       ├── formatter.ts       # 输出格式化
│   │       └── config.ts          # 配置加载
│   └── monitor/                   # 监控模式
│       ├── index.ts
│       ├── poller.ts              # HTTP 轮询
│       └── stream.ts              # WebSocket 流
│
├── test/                          # 测试文件
│   ├── protocol/
│   │   ├── jdwp.test.ts
│   │   └── client.test.ts
│   ├── dsl/
│   │   └── builder.test.ts
│   └── cli/
│       └── commands.test.ts
│
├── ref/                           # 参考实现 (Go 版本)
│   └── ...
│
├── docs/                          # 文档
│   └── design/
│       └── ts-implementation.md   # 本文档
│
├── package.json                   # 项目配置
├── tsconfig.json                  # TypeScript 配置
├── vitest.config.ts               # 测试配置
└── turbo.json                     # Turborepo 配置 (如使用)
```

### 2.2 架构分层

```
┌─────────────────────────────────┐
│   用户层 (User Scripts/CLI)     │
├─────────────────────────────────┤
│   DSL 层 (链式 API/解释器)      │  ← dsl/
├─────────────────────────────────┤
│   协议层 (DebugProtocol 接口)   │  ← protocol/
├─────────────────────────────────┤
│   协议实现 (JDWP/DAP/CDP)       │  ← protocol/jdwp/
├─────────────────────────────────┤
│   网络层 (TCP/WebSocket)        │  ← Node.js net/ws
└─────────────────────────────────┘
```

### 2.3 架构优势 (相比 Go)

| 维度 | Go 实现 | TypeScript 实现 |
|------|---------|-----------------|
| 代码组织 | 受包管理限制需平铺 | 自由嵌套目录结构 |
| 异步模型 | goroutine/channel | Promise/async-await |
| DSL 能力 | 弱 (需要嵌入引擎) | 强 (原生脚本语言) |
| 内部 API | 无法暴露子模块 | 可通过目录精细组织 |
| 类型安全 | 编译时 | 编译时 + 运行时 (Zod) |

---

## 3. 核心 API 设计

### 3.1 类型定义

```typescript
// src/protocol/types.ts

/** 线程信息 */
export interface ThreadInfo {
  id: string;
  name: string;
  state: string;
  status: string;
  isSuspended: boolean;
  isDaemon: boolean;
  priority: number;
  createdAt: Date;
}

/** 调用栈帧 */
export interface StackFrame {
  id: string;
  location: string;
  method: string;
  line: number;
  isNative: boolean;
}

/** 断点信息 */
export interface BreakpointInfo {
  id: string;
  location: string;
  enabled: boolean;
  hitCount: number;
  condition?: string;
}

/** 变量信息 */
export interface Variable {
  name: string;
  type: string;
  value: unknown;
  isPrimitive: boolean;
  isNull: boolean;
}

/** 调试事件 */
export interface DebugEvent {
  type: string;
  threadId: string;
  location: string;
  timestamp: Date;
  data?: unknown;
}

/** 版本信息 */
export interface VersionInfo {
  protocolVersion: string;
  runtimeVersion: string;
  runtimeName: string;
  description: string;
}

/** 能力声明 */
export interface Capabilities {
  supportsVersion: boolean;
  supportsThreads: boolean;
  supportsStack: boolean;
  supportsLocals: boolean;
  supportsBreakpoints: boolean;
  supportsSuspend: boolean;
  supportsResume: boolean;
  supportsStep: boolean;
  supportsEvents: boolean;
  supportsWatchMode: boolean;
  supportsStreaming: boolean;
}
```

### 3.2 协议接口

```typescript
// src/protocol/base.ts

import { z } from 'zod';
import type {
  VersionInfo,
  Capabilities,
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from './types.js';

/** 调试配置 */
export const DebugConfigSchema = z.object({
  protocol: z.string().min(1).default('jdwp'),
  host: z.string().default('127.0.0.1'),
  port: z.number().int().positive().default(5005),
  timeout: z.number().int().positive().default(30000),
});

export type DebugConfig = z.infer<typeof DebugConfigSchema>;

/** 调试协议接口 - 所有协议插件必须实现 */
export interface DebugProtocol {
  // 生命周期
  connect(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;

  // 元数据
  version(): Promise<VersionInfo>;
  capabilities(): Promise<Capabilities>;
  protocolName(): string;
  supportedLanguages(): string[];

  // 线程管理
  threads(): Promise<ThreadInfo[]>;
  stack(threadId: string): Promise<StackFrame[]>;
  threadState(threadId: string): Promise<string>;

  // 执行控制
  suspend(threadId?: string): Promise<void>;
  resume(threadId?: string): Promise<void>;
  stepInto(threadId: string): Promise<void>;
  stepOver(threadId: string): Promise<void>;
  stepOut(threadId: string): Promise<void>;

  // 断点管理
  setBreakpoint(location: string, condition?: string): Promise<string>;
  removeBreakpoint(id: string): Promise<void>;
  clearBreakpoints(): Promise<void>;
  breakpoints(): Promise<BreakpointInfo[]>;

  // 变量检查
  locals(threadId: string, frameIndex: number): Promise<Variable[]>;
  fields(objectId: string): Promise<Variable[]>;

  // 事件处理
  waitForEvent(timeout?: number): Promise<DebugEvent | null>;
}
```

### 3.3 客户端工厂

```typescript
// src/protocol/client.ts

import type { DebugProtocol, DebugConfig } from './base.js';
import { DebugConfigSchema } from './base.js';
import { JDWPClient } from './jdwp/index.js';

type ProtocolFactory = (config: DebugConfig) => DebugProtocol;

const registry = new Map<string, ProtocolFactory>();

/** 注册协议 */
export function registerProtocol(
  name: string,
  factory: ProtocolFactory
): void {
  registry.set(name, factory);
}

/** 创建调试客户端 */
export async function createClient(
  config: DebugConfig
): Promise<DebugProtocol> {
  // 验证配置
  const validatedConfig = DebugConfigSchema.parse(config);

  const factory = registry.get(validatedConfig.protocol);
  
  if (!factory) {
    throw new Error(`Protocol '${validatedConfig.protocol}' is not registered`);
  }

  const client = factory(validatedConfig);
  await client.connect();
  return client;
}

// 注册 JDWP 协议
registerProtocol('jdwp', (config) => new JDWPClient(config));

/** 获取已注册的协议列表 */
export function getRegisteredProtocols(): string[] {
  return Array.from(registry.keys());
}
```

### 3.4 错误处理

```typescript
// src/protocol/errors.ts

/** 错误类型 */
export enum ErrorType {
  ConnectionError = 'connection',
  ProtocolError = 'protocol',
  CommandError = 'command',
  InputError = 'input',
  InternalError = 'internal',
}

/** 调试 API 错误 */
export class APIError extends Error {
  constructor(
    public readonly type: ErrorType,
    public readonly code: number,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'APIError';
  }

  toString(): string {
    if (this.cause) {
      return `${this.message}: ${this.cause.message}`;
    }
    return this.message;
  }
}

/** 错误码 */
export const ErrorCodes = {
  ConnectionFailed: 2001,
  ConnectionRefused: 2002,
  ConnectionTimeout: 2003,
  HandshakeFailed: 2004,
  
  ResourceNotFound: 3001,
  InvalidInput: 3002,
  UnsupportedCommand: 3003,
  
  ProtocolError: 4001,
  DecodeError: 4002,
  EncodeError: 4003,
} as const;
```

### 3.5 JDWP 实现示例

```typescript
// src/protocol/jdwp/client.ts

import net from 'node:net';
import type { DebugProtocol, DebugConfig } from '../base.js';
import { APIError, ErrorType, ErrorCodes } from '../errors.js';
import type {
  VersionInfo,
  Capabilities,
  ThreadInfo,
  StackFrame,
  BreakpointInfo,
  Variable,
  DebugEvent,
} from '../types.js';

export class JDWPClient implements DebugProtocol {
  private conn: net.Socket | null = null;
  private connected = false;
  private config: DebugConfig;
  private breakpoints = new Map<string, BreakpointInfo>();

  constructor(config: DebugConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout ?? 30000;
      const conn = net.createConnection({
        host: this.config.host,
        port: this.config.port,
      });

      conn.setTimeout(timeout);

      conn.on('connect', () => {
        this.conn = conn;
        this.connected = true;
        resolve();
      });

      conn.on('error', (err) => {
        reject(new APIError(
          ErrorType.ConnectionError,
          ErrorCodes.ConnectionFailed,
          `Failed to connect to ${this.config.host}:${this.config.port}`,
          err
        ));
      });

      conn.on('timeout', () => {
        conn.destroy();
        reject(new APIError(
          ErrorType.ConnectionError,
          ErrorCodes.ConnectionTimeout,
          'Connection timeout'
        ));
      });
    });
  }

  async close(): Promise<void> {
    if (this.conn) {
      this.conn.destroy();
      this.conn = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  protocolName(): string {
    return 'jdwp';
  }

  supportedLanguages(): string[] {
    return ['java', 'kotlin', 'scala'];
  }

  async capabilities(): Promise<Capabilities> {
    return {
      supportsVersion: true,
      supportsThreads: true,
      supportsStack: true,
      supportsLocals: true,
      supportsBreakpoints: true,
      supportsSuspend: true,
      supportsResume: true,
      supportsStep: true,
      supportsEvents: true,
      supportsWatchMode: true,
      supportsStreaming: true,
    };
  }

  // 其他方法实现...
  async version(): Promise<VersionInfo> {
    // 实现 JDWP Version 查询
    throw new Error('Not implemented');
  }

  async threads(): Promise<ThreadInfo[]> {
    // 实现线程查询
    throw new Error('Not implemented');
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    // 实现调用栈查询
    throw new Error('Not implemented');
  }

  async suspend(threadId?: string): Promise<void> {
    // 实现挂起
    throw new Error('Not implemented');
  }

  async resume(threadId?: string): Promise<void> {
    // 实现恢复
    throw new Error('Not implemented');
  }

  async stepInto(threadId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async stepOver(threadId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async stepOut(threadId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async setBreakpoint(location: string, condition?: string): Promise<string> {
    // 实现断点设置
    throw new Error('Not implemented');
  }

  async removeBreakpoint(id: string): Promise<void> {
    // 实现断点移除
    throw new Error('Not implemented');
  }

  async clearBreakpoints(): Promise<void> {
    // 实现清除所有断点
    this.breakpoints.clear();
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    return Array.from(this.breakpoints.values());
  }

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    // 实现变量查询
    throw new Error('Not implemented');
  }

  async fields(objectId: string): Promise<Variable[]> {
    // 实现字段查询
    throw new Error('Not implemented');
  }

  async threadState(threadId: string): Promise<string> {
    throw new Error('Not implemented');
  }

  async waitForEvent(timeout?: number): Promise<DebugEvent | null> {
    throw new Error('Not implemented');
  }
}
```

---

## 4. DSL 设计

### 4.1 链式 API 构建器

```typescript
// src/dsl/builder.ts

import type { DebugProtocol, ThreadInfo, Variable, StackFrame } from '../protocol/index.js';

/** 链式调试 API 构建器 */
export class DebugBuilder {
  private client: DebugProtocol;
  private currentThread: ThreadInfo | null = null;

  constructor(client: DebugProtocol) {
    this.client = client;
  }

  /** 选择线程 */
  async thread(nameOrId: string): Promise<this> {
    const threads = await this.client.threads();
    this.currentThread = threads.find(
      t => t.id === nameOrId || t.name === nameOrId
    ) ?? null;

    if (!this.currentThread) {
      throw new Error(`Thread '${nameOrId}' not found`);
    }
    return this;
  }

  /** 挂起当前线程 */
  async suspend(): Promise<this> {
    if (!this.currentThread) throw new Error('No thread selected');
    await this.client.suspend(this.currentThread.id);
    return this;
  }

  /** 恢复当前线程 */
  async resume(): Promise<this> {
    if (!this.currentThread) throw new Error('No thread selected');
    await this.client.resume(this.currentThread.id);
    return this;
  }

  /** 单步进入 */
  async stepInto(): Promise<this> {
    if (!this.currentThread) throw new Error('No thread selected');
    await this.client.stepInto(this.currentThread.id);
    return this;
  }

  /** 单步跳过 */
  async stepOver(): Promise<this> {
    if (!this.currentThread) throw new Error('No thread selected');
    await this.client.stepOver(this.currentThread.id);
    return this;
  }

  /** 设置断点 */
  async breakpointAt(className: string, line: number): Promise<this> {
    const location = `${className}:${line}`;
    const bpId = await this.client.setBreakpoint(location);
    console.log(`✓ Breakpoint set at ${location} (id: ${bpId})`);
    return this;
  }

  /** 检查变量 */
  async inspectVariables(frameIndex = 0): Promise<Variable[]> {
    if (!this.currentThread) throw new Error('No thread selected');
    const locals = await this.client.locals(this.currentThread.id, frameIndex);
    console.log('Variables:', locals);
    return locals;
  }

  /** 打印调用栈 */
  async printStack(): Promise<StackFrame[]> {
    if (!this.currentThread) throw new Error('No thread selected');
    const stack = await this.client.stack(this.currentThread.id);
    console.log('Stack Trace:');
    stack.forEach((frame, i) => {
      console.log(`  #${i} ${frame.method} at ${frame.location}:${frame.line}`);
    });
    return stack;
  }

  /** 获取底层客户端 (用于高级操作) */
  getClient(): DebugProtocol {
    return this.client;
  }
}
```

### 4.2 DSL 解释器

```typescript
// src/dsl/interpreter.ts

import type { DebugConfig } from '../protocol/index.js';
import { createClient } from '../protocol/index.js';
import { DebugBuilder } from './builder.js';

/** DSL 解释器 */
export class DebugDSL {
  private config: DebugConfig;

  constructor(config: DebugConfig) {
    this.config = config;
  }

  /** 执行调试脚本 */
  async run(script: (dsl: DebugBuilder) => Promise<void>): Promise<void> {
    const client = await createClient(this.config);
    const builder = new DebugBuilder(client);

    try {
      await script(builder);
    } finally {
      await client.close();
    }
  }
}
```

### 4.3 使用示例

```typescript
import { createClient, DebugDSL } from './index.js';

// 方式 1: 直接调用 API
const client = await createClient({
  protocol: 'jdwp',
  host: '127.0.0.1',
  port: 5005
});

try {
  const threads = await client.threads();
  const main = threads.find(t => t.name === 'main')!;

  await client.suspend(main.id);
  const stack = await client.stack(main.id);
  const locals = await client.locals(main.id, 0);

  console.log('Variables:', locals);
  await client.resume(main.id);
} finally {
  await client.close();
}

// 方式 2: 使用 DSL 链式调用
const dsl = new DebugDSL({ protocol: 'jdwp', port: 5005 });

await dsl.run(async (debug) => {
  await debug
    .thread('main')
    .suspend()
    .breakpointAt('com.example.Main', 42)
    .inspectVariables()
    .printStack()
    .resume();
});

// 方式 3: 混合使用
await dsl.run(async (debug) => {
  // 使用链式 API
  await debug.thread('main').suspend();

  // 使用底层 API (条件断点)
  const client = debug.getClient();
  const bpId = await client.setBreakpoint(
    'com.example.Main:100',
    'x > 10'
  );
  console.log('Conditional breakpoint set:', bpId);

  // 等待事件
  const event = await client.waitForEvent(5000);
  if (event) {
    await debug.thread(event.threadId).suspend();
    await debug.inspectVariables();
  }

  await debug.resume();
});
```

---

## 5. 依赖管理

### 5.1 package.json 配置

```json
{
  "name": "cli-debugger",
  "version": "1.0.0",
  "type": "module",
  "description": "Multi-language debugging CLI with DSL support",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "debugger": "./dist/cli/index.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist"
  },
  "keywords": [
    "debugger",
    "jdwp",
    "dap",
    "cli",
    "dsl",
    "typescript"
  ],
  "license": "MIT",
  "dependencies": {
    "zod": "^4.3.6",
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/node": "^25.2.1",
    "@types/ws": "^8.5.10",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18",
    "@vitest/coverage-v8": "^4.0.18",
    "eslint": "^10.0.0",
    "prettier": "^3.8.1",
    "rimraf": "^6.1.2"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### 5.2 依赖说明

| 包名 | 用途 | 类型 |
|------|------|------|
| zod | 运行时配置验证 | 生产依赖 |
| commander | CLI 命令解析 | 生产依赖 |
| chalk | 终端彩色输出 | 生产依赖 |
| ws | WebSocket 支持 | 生产依赖 |
| @types/node | Node.js 类型定义 | 开发依赖 |
| @types/ws | WebSocket 类型定义 | 开发依赖 |
| typescript | TypeScript 编译器 | 开发依赖 |
| vitest | 单元测试框架 | 开发依赖 |
| eslint | 代码检查 | 开发依赖 |
| prettier | 代码格式化 | 开发依赖 |
| rimraf | 清理工具 | 开发依赖 |

---

## 6. 迁移策略

### 6.1 迁移步骤

#### 阶段 1: 基础设施搭建

- [ ] 初始化 TypeScript 项目配置 (tsconfig.json, vitest.config.ts)
- [ ] 创建目录结构 (src/protocol/, src/dsl/, src/cli/)
- [ ] 实现类型定义 (types.ts)
- [ ] 实现 DebugProtocol 接口 (base.ts)
- [ ] 实现客户端工厂 (client.ts)
- [ ] 实现错误处理 (errors.ts)

#### 阶段 2: JDWP 协议实现

- [ ] 实现 JDWP 编解码 (protocol/jdwp/codec.ts)
- [ ] 实现握手协议 (protocol/jdwp/handshake.ts)
- [ ] 实现 VirtualMachine 命令集 (protocol/jdwp/vm.ts)
- [ ] 实现 ThreadReference 命令集 (protocol/jdwp/thread.ts)
- [ ] 实现 EventRequest 命令集 (protocol/jdwp/breakpoint.ts)
- [ ] 实现 StackFrame 查询 (protocol/jdwp/stack.ts)
- [ ] 实现变量检查 (protocol/jdwp/variable.ts)
- [ ] 实现事件处理 (protocol/jdwp/event.ts)

#### 阶段 3: DSL 实现

- [ ] 实现链式 API 构建器 (dsl/builder.ts)
- [ ] 实现 DSL 解释器 (dsl/interpreter.ts)
- [ ] 编写使用示例

#### 阶段 4: CLI 工具

- [ ] 实现 CLI 入口 (cli/index.ts)
- [ ] 迁移命令实现 (cli/commands/)
- [ ] 实现输出格式化 (cli/utils/formatter.ts)
- [ ] 实现配置加载 (cli/utils/config.ts)
- [ ] 实现监控模式 (monitor/)

#### 阶段 5: 测试与文档

- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 完善 API 文档
- [ ] 编写 CLI 使用指南

### 6.2 Go 到 TypeScript 映射表

| Go 源文件 | TypeScript 目标文件 | 说明 |
|-----------|---------------------|------|
| `ref/internal/api/base.go` | `src/protocol/base.ts` | DebugProtocol 接口 |
| `ref/internal/api/client.go` | `src/protocol/client.ts` | 客户端工厂 |
| `ref/pkg/types/base.go` | `src/protocol/types.ts` | 类型定义 |
| `ref/internal/api/jdwp/client.go` | `src/protocol/jdwp/client.ts` | JDWP 客户端 |
| `ref/internal/api/jdwp/handshake.go` | `src/protocol/jdwp/handshake.ts` | 握手协议 |
| `ref/internal/api/jdwp/protocol.go` | `src/protocol/jdwp/codec.ts` | 编解码 |
| `ref/internal/api/jdwp/vm.go` | `src/protocol/jdwp/vm.ts` | VirtualMachine |
| `ref/internal/api/jdwp/thread.go` | `src/protocol/jdwp/thread.ts` | ThreadReference |
| `ref/internal/api/jdwp/breakpoint.go` | `src/protocol/jdwp/breakpoint.ts` | EventRequest |
| `ref/internal/api/jdwp/stack.go` | `src/protocol/jdwp/stack.ts` | StackFrame |
| `ref/internal/api/jdwp/variable.go` | `src/protocol/jdwp/variable.ts` | 变量检查 |
| `ref/internal/api/jdwp/event.go` | `src/protocol/jdwp/event.ts` | 事件处理 |
| `ref/cmd/*.go` | `src/cli/commands/*.ts` | CLI 命令 |
| `ref/internal/output/*.go` | `src/cli/utils/formatter.ts` | 输出格式化 |
| `ref/internal/monitor/*.go` | `src/monitor/*.ts` | 监控模式 |

### 6.3 技术栈配置

#### TypeScript 配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

#### Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## 7. 总结

### 7.1 技术选型理由

1. **调试本质是脚本化的**: TypeScript 原生支持异步编程和脚本执行
2. **Promise/async-await 更自然**: 网络 I/O 操作语义清晰
3. **类型安全**: 编译时检查 + 运行时验证 (Zod)
4. **生态优势**: npm 生态、VS Code 集成、Chrome DevTools 兼容

### 7.2 架构特点

- **单包结构**: 所有内容在 src/ 下，无需多包管理
- **层次清晰**: protocol (接口) → jdwp (实现) → dsl (高级 API) → cli (命令行)
- **可扩展**: 未来添加 DAP/CDP 只需在 protocol/ 下新增目录
- **内部 API 精细化**: 不受 Go 包管理限制，可按功能模块组织

### 7.3 下一步

1. ✅ 阅读并理解本设计文档
2. ⬜ 初始化 TypeScript 项目
3. ⬜ 实现核心接口和类型
4. ⬜ 实现 JDWP 协议 (参考 ref/ 目录)
5. ⬜ 实现 DSL 层
6. ⬜ 实现 CLI 工具
7. ⬜ 测试和文档

---

## 附录: 参考资源

- [JDWP Specification](https://docs.oracle.com/javase/8/docs/technotes/guides/jpda/jdwp-spec.html)
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vitest Guide](https://vitest.dev/guide/)
- [Zod Documentation](https://zod.dev/)
