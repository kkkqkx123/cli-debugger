# 项目架构

## 目录结构

```
src/
├── index.ts                 # 主入口，导出所有公共 API
├── types/                   # 集中式类型定义
│   ├── index.ts
│   ├── config.ts            # DebugConfig (Zod 验证), AppConfig, Profile
│   ├── debug.ts             # ThreadInfo, StackFrame, BreakpointInfo, Variable, DebugEvent
│   └── metadata.ts          # VersionInfo, Capabilities
├── config/                  # 配置加载器
│   ├── index.ts
│   ├── loader.ts            # TOML 配置文件加载
│   ├── paths.ts             # 配置文件路径
│   └── validator.ts         # 配置验证
├── protocol/                # 协议层（核心）
│   ├── index.ts             # 导出所有协议实现并自动注册
│   ├── types.ts             # 类型重导出
│   ├── base.ts              # DebugProtocol 接口定义
│   ├── extended.ts          # ExtendedDebugProtocol 接口（可选高级功能）
│   ├── client.ts            # 协议注册表与客户端工厂
│   ├── errors.ts            # APIError, 错误码
│   ├── dlv/                 # Delve (Go) 协议实现
│   ├── jdwp/                # JDWP (Java) 协议实现
│   ├── lldb/                # LLDB (C/C++/Rust) 协议实现
│   ├── debugpy/             # DebugPy (Python) 协议 - 桩实现
│   └── js-debug/            # js-debug (JavaScript) 协议 - 桩实现
├── session/
│   └── manager.ts           # 会话管理器：多会话生命周期管理
├── cli/
│   ├── index.ts             # Commander CLI 入口
│   └── formatter.ts         # 输出格式化
├── monitor/                 # 监控模块（Poller, StreamMonitor）
├── output/                  # 输出格式化（Text, JSON, Table）
└── platform/                # 平台检测（进程发现）
```

## 核心架构：协议插件系统

### DebugProtocol 接口（src/protocol/base.ts）

所有调试协议必须实现的核心接口，按功能分组：

```typescript
interface DebugProtocol {
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
  setBreakpoint(location: string, condition?: string, type?: string): Promise<string>;
  removeBreakpoint(id: string): Promise<void>;
  clearBreakpoints(): Promise<void>;
  breakpoints(): Promise<BreakpointInfo[]>;

  // 变量检查
  locals(threadId: string, frameIndex: number): Promise<Variable[]>;
  fields(objectId: string): Promise<Variable[]>;
  setField(objectId: string, fieldId: string, value: unknown): Promise<void>;

  // 事件处理
  waitForEvent(timeout?: number): Promise<DebugEvent | null>;
}
```

### ExtendedDebugProtocol（src/protocol/extended.ts）

可选高级功能接口，包含 `eval`, `enableBreakpoint`, `getTypeInfo`, `getSymbol`, `getTargetMetadata` 等。协议通过 `supportsFeature()` 声明支持哪些功能。

### 协议注册机制（src/protocol/client.ts）

```typescript
// 自动注册（在 src/protocol/index.ts 中）
registerProtocol("jdwp", (config) => new JDWPClient(config));
registerProtocol("dlv", (config) => new DlvClient(config));
registerProtocol("lldb", (config) => new LLDBClient(config));
registerProtocol("debugpy", (config) => new DebugPyClient(config));
registerProtocol("js-debug", (config) => new JsDebugClient(config));

// 使用
const client = await createClient({ protocol: "dlv", host: "127.0.0.1", port: 2345 });
```

### 会话管理（src/session/manager.ts）

`SessionManager` 管理多会话：

- `createSession(config)` → session ID
- `closeSession(id?)` / `closeAllSessions()`
- `getActiveThread()` / `setActiveThread(id)`
- `getActiveFrameIndex()` / `setActiveFrameIndex(index)`
- `listSessions()` → `SessionInfo[]`
- `getExtendedClient()` → `ExtendedDebugProtocol | undefined`

### 数据流

```
CLI (Commander) → SessionManager → DebugProtocol → 协议客户端 → 远程调试适配器
                                      ↑
                               registerProtocol() 工厂
```

### 类型集中管理

所有公共类型定义在 `src/types/`，`src/protocol/types.ts` 只是重导出。`DebugConfig` 使用 Zod 做运行时验证。

```typescript
// DebugConfig 由 Zod 验证
export const DebugConfigSchema = z.object({
  protocol: z.string().min(1).default("jdwp"),
  host: z.string().min(1).default("127.0.0.1"),
  port: z.number().int().positive().default(5005),
  timeout: z.number().int().positive().default(30000),
});
```

### 错误处理（src/protocol/errors.ts）

统一的错误体系：

```typescript
enum ErrorType { ConnectionError, ProtocolError, CommandError, InputError, InternalError }
class APIError extends Error { type, code, context }
```