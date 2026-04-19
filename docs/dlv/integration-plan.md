# Delve 协议集成方案

本文档分析如何在 `cli-debugger` 项目中添加对 Delve (dlv) 调试器的支持。

## 一、现有架构分析

### 1.1 协议层结构

```
src/protocol/
├── base.ts          # DebugProtocol 接口定义
├── client.ts        # 协议注册和客户端工厂
├── errors.ts        # 错误类型定义
├── index.ts         # 模块导出 + 自动注册 JDWP
├── types.ts         # 类型重导出
└── jdwp/            # JDWP 协议实现
    ├── index.ts     # 模块导出
    ├── client.ts    # JDWPClient 实现
    ├── codec.ts     # 数据包编解码
    ├── handshake.ts # 握手协议
    ├── protocol/    # 协议常量和类型
    └── ...          # 各命令集实现
```

### 1.2 DebugProtocol 接口

核心接口定义在 `src/protocol/base.ts`，包含以下方法：

| 分类 | 方法 | 说明 |
|------|------|------|
| 生命周期 | `connect()`, `close()`, `isConnected()` | 连接管理 |
| 元数据 | `version()`, `capabilities()`, `protocolName()`, `supportedLanguages()` | 协议信息 |
| 线程管理 | `threads()`, `stack()`, `threadState()` | 线程操作 |
| 执行控制 | `suspend()`, `resume()`, `stepInto()`, `stepOver()`, `stepOut()` | 执行控制 |
| 断点管理 | `setBreakpoint()`, `removeBreakpoint()`, `clearBreakpoints()`, `breakpoints()` | 断点操作 |
| 变量检查 | `locals()`, `fields()`, `setField()` | 变量操作 |
| 事件处理 | `waitForEvent()` | 事件等待 |

### 1.3 协议注册机制

```typescript
// src/protocol/index.ts
import { registerProtocol } from "./client.js";
import { JDWPClient } from "./jdwp/client.js";

registerProtocol("jdwp", (config) => new JDWPClient(config));
```

## 二、Delve 协议特点

### 2.1 连接方式

Delve 支持多种连接方式：

| 方式 | 命令 | 说明 |
|------|------|------|
| headless | `dlv debug --headless --listen=:4040` | 启动调试服务器 |
| exec | `dlv exec <binary>` | 调试预编译二进制 |
| attach | `dlv attach <pid>` | 附加到运行进程 |
| connect | `dlv connect <addr>` | 连接到远程服务器 |

### 2.2 RPC API

Delve 使用 JSON-RPC 2.0 协议进行通信：

- **传输层**：TCP Socket 或 stdio
- **协议**：JSON-RPC 2.0
- **API 端点**：`RPCServer.*`

主要 API 方法：

| 方法 | 对应 Delve 命令 | 说明 |
|------|-----------------|------|
| `Command` | continue/next/step/stepout | 执行控制 |
| `GetState` | - | 获取当前状态 |
| `ListBreakpoints` | breakpoints | 列出断点 |
| `CreateBreakpoint` | break | 创建断点 |
| `ClearBreakpoint` | clear | 删除断点 |
| `ListThreads` | threads | 列出线程 |
| `ListGoroutines` | goroutines | 列出协程 |
| `Stacktrace` | stack | 获取栈跟踪 |
| `ListLocalVars` | locals | 列出局部变量 |
| `ListPackageVars` | vars | 列出包变量 |
| `Eval` | print | 计算表达式 |

### 2.3 Go 特有概念

| 概念 | 说明 | 对应 JDWP |
|------|------|-----------|
| Goroutine | Go 协程 | Thread |
| Goroutine ID | 协程标识 | Thread ID |
| Frame | 栈帧 | Stack Frame |
| Deferred | 延迟调用 | 无直接对应 |

## 三、集成方案

### 3.1 目录结构

```
src/protocol/
└── dlv/                      # Delve 协议实现
    ├── index.ts              # 模块导出
    ├── client.ts             # DlvClient 实现
    ├── rpc.ts                # JSON-RPC 通信层
    ├── types.ts              # Delve 特有类型
    ├── api/                  # API 方法封装
    │   ├── debugger.ts       # 调试器状态和控制
    │   ├── breakpoint.ts     # 断点管理
    │   ├── thread.ts         # 线程/协程管理
    │   ├── stack.ts          # 栈操作
    │   └── variable.ts       # 变量检查
    └── __tests__/            # 单元测试
        ├── client.test.ts
        ├── rpc.test.ts
        └── ...
```

### 3.2 核心类型定义

```typescript
// src/protocol/dlv/types.ts

/** Delve 断点 */
export interface DlvBreakpoint {
  id: number;
  name: string;
  addr: number;
  file: string;
  line: number;
  functionName: string;
  Cond: string;
  hitCount: number;
  disabled: boolean;
}

/** Delve 协程 */
export interface DlvGoroutine {
  id: number;
  currentLoc: DlvLocation;
  userCurrentLoc: DlvLocation;
  goStatementLoc: DlvLocation;
  threadId: number;
}

/** Delve 位置 */
export interface DlvLocation {
  pc: number;
  file: string;
  line: number;
  function: DlvFunction | null;
}

/** Delve 函数 */
export interface DlvFunction {
  name: string;
  value: number;
  type: number;
  goType: number;
}

/** Delve 栈帧 */
export interface DlvStackFrame {
  file: string;
  line: number;
  function: DlvFunction | null;
  pc: number;
}

/** Delve 变量 */
export interface DlvVariable {
  name: string;
  addr: number;
  type: string;
  value: string;
  kind: VariableKind;
  children: DlvVariable[];
  len: number;
  cap: number;
}

/** 变量类型 */
export enum VariableKind {
  Invalid = 0,
  Bool = 1,
  Int = 2,
  Float = 3,
  String = 4,
  Array = 5,
  Slice = 6,
  Struct = 7,
  Pointer = 8,
  Interface = 9,
  Map = 10,
  Complex = 11,
  Chan = 12,
  Func = 13,
  UnsafePointer = 14,
}

/** 调试器状态 */
export interface DlvDebuggerState {
  running: boolean;
  currentThread: DlvThread | null;
  currentGoroutine: DlvGoroutine | null;
  exited: boolean;
  exitStatus: number;
}

/** Delve 线程 */
export interface DlvThread {
  id: number;
  pc: number;
  file: string;
  line: number;
  function: DlvFunction | null;
  goroutineID: number;
}
```

### 3.3 JSON-RPC 通信层

```typescript
// src/protocol/dlv/rpc.ts

import * as net from "node:net";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class DlvRpcClient {
  private socket: net.Socket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = "";

  async connect(host: string, port: number, timeout: number): Promise<void> {
    // 建立 TCP 连接
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    // 发送 JSON-RPC 请求
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };
    // ... 发送并等待响应
  }

  async close(): Promise<void> {
    // 关闭连接
  }
}
```

### 3.4 DlvClient 实现

```typescript
// src/protocol/dlv/client.ts

import type { DebugProtocol } from "../base.js";
import type { DebugConfig } from "../../types/config.js";
import type { ThreadInfo, StackFrame, BreakpointInfo, Variable, DebugEvent } from "../../types/debug.js";
import { DlvRpcClient } from "./rpc.js";
import type { DlvBreakpoint, DlvGoroutine, DlvDebuggerState } from "./types.js";

export class DlvClient implements DebugProtocol {
  private config: DebugConfig;
  private rpc: DlvRpcClient;
  private connected = false;
  private breakpointMap = new Map<string, DlvBreakpoint>();

  constructor(config: DebugConfig) {
    this.config = config;
    this.rpc = new DlvRpcClient();
  }

  // ==================== Lifecycle ====================

  async connect(): Promise<void> {
    await this.rpc.connect(this.config.host, this.config.port, this.config.timeout);
    this.connected = true;
  }

  async close(): Promise<void> {
    await this.rpc.close();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ==================== Metadata ====================

  protocolName(): string {
    return "dlv";
  }

  supportedLanguages(): string[] {
    return ["go"];
  }

  async version(): Promise<VersionInfo> {
    const result = await this.rpc.call<{ DelveVersion: string; APIVersion: string }>(
      "RPCServer.Version"
    );
    return {
      protocol: "dlv",
      version: result.DelveVersion,
      apiVersion: result.APIVersion,
    };
  }

  async capabilities(): Promise<Capabilities> {
    return {
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      supportsStepBack: true, // Delve 支持 rewind
      supportsSetVariable: true,
      supportsRestart: true,
    };
  }

  // ==================== Thread Management ====================

  async threads(): Promise<ThreadInfo[]> {
    // Delve 使用 goroutines 而非 threads
    const goroutines = await this.rpc.call<DlvGoroutine[]>(
      "RPCServer.ListGoroutines",
      [{}, null, 0]  // start, count, depth
    );
    
    return goroutines.map((g) => ({
      id: String(g.id),
      name: g.currentLoc.function?.name ?? "<unknown>",
      state: g.threadId > 0 ? "running" : "waiting",
      status: g.threadId > 0 ? "running" : "waiting",
      isSuspended: g.threadId === 0,
      isDaemon: false,
      priority: 0,
      createdAt: new Date(),
    }));
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    const frames = await this.rpc.call<DlvStackFrame[]>(
      "RPCServer.Stacktrace",
      [{ goroutineID: parseInt(threadId, 10), depth: 50 }]
    );
    
    return frames.map((f, i) => ({
      id: String(i),
      location: `${f.file}:${f.line}`,
      method: f.function?.name ?? "<unknown>",
      line: f.line,
      isNative: false,
    }));
  }

  // ==================== Execution Control ====================

  async suspend(threadId?: string): Promise<void> {
    if (threadId) {
      await this.rpc.call("RPCServer.Command", [{
        name: "switchGoroutine",
        goroutineID: parseInt(threadId, 10),
      }]);
    }
    await this.rpc.call("RPCServer.Command", [{ name: "halt" }]);
  }

  async resume(threadId?: string): Promise<void> {
    if (threadId) {
      await this.rpc.call("RPCServer.Command", [{
        name: "switchGoroutine",
        goroutineID: parseInt(threadId, 10),
      }]);
    }
    await this.rpc.call("RPCServer.Command", [{ name: "continue" }]);
  }

  async stepInto(threadId: string): Promise<void> {
    await this.rpc.call("RPCServer.Command", [{
      name: "step",
      goroutineID: parseInt(threadId, 10),
    }]);
  }

  async stepOver(threadId: string): Promise<void> {
    await this.rpc.call("RPCServer.Command", [{
      name: "next",
      goroutineID: parseInt(threadId, 10),
    }]);
  }

  async stepOut(threadId: string): Promise<void> {
    await this.rpc.call("RPCServer.Command", [{
      name: "stepout",
      goroutineID: parseInt(threadId, 10),
    }]);
  }

  // ==================== Breakpoint Management ====================

  async setBreakpoint(
    location: string,
    condition?: string,
    type?: string
  ): Promise<string> {
    // 解析位置: "file.go:line" 或 "function"
    const bp = await this.rpc.call<DlvBreakpoint>(
      "RPCServer.CreateBreakpoint",
      [{
        file: location.includes(":") ? location.split(":")[0] : "",
        line: location.includes(":") ? parseInt(location.split(":")[1], 10) : 0,
        functionName: location.includes(":") ? "" : location,
        Cond: condition ?? "",
      }]
    );
    
    const id = `dlv_bp_${bp.id}`;
    this.breakpointMap.set(id, bp);
    return id;
  }

  async removeBreakpoint(id: string): Promise<void> {
    const bp = this.breakpointMap.get(id);
    if (bp) {
      await this.rpc.call("RPCServer.ClearBreakpoint", [{ id: bp.id }]);
      this.breakpointMap.delete(id);
    }
  }

  async clearBreakpoints(): Promise<void> {
    const bps = await this.rpc.call<DlvBreakpoint[]>("RPCServer.ListBreakpoints", []);
    for (const bp of bps) {
      await this.rpc.call("RPCServer.ClearBreakpoint", [{ id: bp.id }]);
    }
    this.breakpointMap.clear();
  }

  async breakpoints(): Promise<BreakpointInfo[]> {
    const bps = await this.rpc.call<DlvBreakpoint[]>("RPCServer.ListBreakpoints", []);
    return bps.map((bp) => ({
      id: `dlv_bp_${bp.id}`,
      location: `${bp.file}:${bp.line}`,
      enabled: !bp.disabled,
      hitCount: bp.hitCount,
      condition: bp.Cond,
    }));
  }

  // ==================== Variable Inspection ====================

  async locals(threadId: string, frameIndex: number): Promise<Variable[]> {
    const vars = await this.rpc.call<DlvVariable[]>(
      "RPCServer.ListLocalVars",
      [{ goroutineID: parseInt(threadId, 10), frame: frameIndex }]
    );
    
    return vars.map((v) => ({
      name: v.name,
      type: v.type,
      value: v.value,
      isPrimitive: v.kind <= 4, // Bool, Int, Float, String
      isNull: v.value === "nil",
    }));
  }

  async fields(objectId: string): Promise<Variable[]> {
    // Go 结构体字段
    const vars = await this.rpc.call<DlvVariable[]>(
      "RPCServer.Eval",
      [{ expr: objectId, scope: { goroutineID: -1, frame: 0 } }]
    );
    
    if (vars.length === 0 || !vars[0].children) {
      return [];
    }
    
    return vars[0].children.map((v) => ({
      name: v.name,
      type: v.type,
      value: v.value,
      isPrimitive: v.kind <= 4,
      isNull: v.value === "nil",
    }));
  }

  // ... 其他方法实现
}
```

### 3.5 模块导出和注册

```typescript
// src/protocol/dlv/index.ts

export { DlvClient } from "./client.js";
export * from "./types.js";
export { DlvRpcClient } from "./rpc.js";
```

```typescript
// src/protocol/index.ts (修改)

// ... 现有导出 ...

// Delve protocol implementation
export { DlvClient } from "./dlv/client.js";
export * as dlv from "./dlv/index.js";

// Auto-register protocols
import { registerProtocol } from "./client.js";
import { JDWPClient } from "./jdwp/client.js";
import { DlvClient } from "./dlv/client.js";

registerProtocol("jdwp", (config) => new JDWPClient(config));
registerProtocol("dlv", (config) => new DlvClient(config));
```

## 四、接口映射对照表

### 4.1 线程/协程映射

| DebugProtocol | Delve API | 说明 |
|---------------|-----------|------|
| `threads()` | `ListGoroutines` | Go 使用 goroutine |
| `stack(id)` | `Stacktrace` | 栈跟踪 |
| `threadState(id)` | `GetState` | 获取状态 |

### 4.2 执行控制映射

| DebugProtocol | Delve Command | 说明 |
|---------------|---------------|------|
| `suspend()` | `Command("halt")` | 暂停 |
| `resume()` | `Command("continue")` | 继续 |
| `stepInto()` | `Command("step")` | 单步进入 |
| `stepOver()` | `Command("next")` | 单步跳过 |
| `stepOut()` | `Command("stepout")` | 单步跳出 |

### 4.3 断点映射

| DebugProtocol | Delve API | 说明 |
|---------------|-----------|------|
| `setBreakpoint()` | `CreateBreakpoint` | 创建断点 |
| `removeBreakpoint()` | `ClearBreakpoint` | 删除断点 |
| `breakpoints()` | `ListBreakpoints` | 列出断点 |
| `clearBreakpoints()` | 多次 `ClearBreakpoint` | 清除所有 |

### 4.4 变量映射

| DebugProtocol | Delve API | 说明 |
|---------------|-----------|------|
| `locals()` | `ListLocalVars` | 局部变量 |
| `fields()` | `Eval` + children | 结构体字段 |
| `setField()` | `Set` |修改变量 |

## 五、扩展考虑

### 5.1 Go 特有功能

以下 Delve 功能是 Go 特有的，可以考虑扩展 `DebugProtocol` 接口：

| 功能 | Delve 命令 | 建议 |
|------|------------|------|
| 协程过滤 | `goroutines -with` | 扩展 `threads()` 参数 |
| 延迟调用 | `deferred` | 新增 `deferredCalls()` 方法 |
| 反向执行 | `rewind` | 新增 `stepBack()` 方法 |
| 检查点 | `checkpoint` | 新增检查点相关方法 |
| 包变量 | `vars` | 新增 `packageVars()` 方法 |

### 5.2 接口扩展建议

```typescript
// 可选扩展接口
export interface GoDebugProtocol extends DebugProtocol {
  // Go 特有方法
  goroutines(filter?: GoroutineFilter): Promise<GoroutineInfo[]>;
  deferredCalls(threadId: string, frameIndex: number): Promise<DeferredCall[]>;
  packageVars(packageName?: string): Promise<Variable[]>;
  
  // 反向执行（需要录制模式）
  stepBack(threadId: string): Promise<void>;
  rewind(): Promise<void>;
  
  // 检查点
  createCheckpoint(note?: string): Promise<string>;
  restoreCheckpoint(id: string): Promise<void>;
  listCheckpoints(): Promise<CheckpointInfo[]>;
}
```

## 六、实现优先级

### 第一阶段：核心功能

1. JSON-RPC 通信层 (`rpc.ts`)
2. 基础类型定义 (`types.ts`)
3. `DlvClient` 核心实现
4. 协议注册

### 第二阶段：完善功能

1. 断点条件支持
2. 变量检查完善
3. 事件处理
4. 错误处理

### 第三阶段：扩展功能

1. Go 特有功能
2. 反向执行
3. 检查点
4. 性能优化

## 七、测试策略

### 7.1 单元测试

- JSON-RPC 通信层测试（mock socket）
- 类型转换测试
- 错误处理测试

### 7.2 集成测试

需要真实的 Delve 服务器：

```bash
# 启动 Delve headless 模式
dlv debug --headless --listen=:4040 --api-version=2

# 运行测试
npm test -- src/protocol/dlv/__tests__/client.test.ts
```

### 7.3 E2E 测试

```typescript
// tests/e2e/dlv.test.ts
describe("Dlv E2E", () => {
  it("should connect to dlv server", async () => {
    const client = await createClient({
      protocol: "dlv",
      host: "127.0.0.1",
      port: 4040,
    });
    
    const threads = await client.threads();
    expect(threads.length).toBeGreaterThan(0);
    
    await client.close();
  });
});
```

## 八、配置支持

### 8.1 配置扩展

```typescript
// src/types/config.ts

export const DebugConfigSchema = z.object({
  protocol: z.enum(["jdwp", "dlv"]).default("jdwp"),
  host: z.string().min(1).default("127.0.0.1"),
  port: z.number().int().positive().default(5005),
  timeout: z.number().int().positive().default(30000),
  // Delve 特有配置
  dlv: z.object({
    apiVersion: z.number().default(2),
    headless: z.boolean().default(true),
  }).optional(),
});
```

### 8.2 CLI 支持

```bash
# 使用 Delve 协议
debugger --protocol dlv --port 4040 threads

# 或使用环境变量
DEBUGGER_PROTOCOL=dlv debugger --port 4040 threads
```
