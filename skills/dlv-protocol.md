# Delve (DLV) 协议指南

## 概述

DLV 协议通过 JSON-RPC 2.0 与 Delve Go 调试器通信。协议实现位于 `src/protocol/dlv/`。

## 文件结构

```
dlv/
├── index.ts         # 导出所有 API 模块
├── types.ts         # DlvGoroutine, DlvStackFrame, DlvBreakpoint 等类型
├── rpc.ts           # DlvRpcClient - JSON-RPC 通信层
├── client.ts        # DlvClient - 实现 DebugProtocol + ExtendedDebugProtocol
├── extension.ts     # GoDebugExtension 接口
└── api/             # 按功能分组的 RPC API 调用封装
    ├── debugger.ts      # RPCServer.State, RPCServer.Command, RPCServer.Version
    ├── breakpoint.ts    # RPCServer.ListBreakpoints, RPCServer.CreateBreakpoint
    ├── stack.ts         # RPCServer.Stacktrace, 帧导航
    ├── variable.ts      # RPCServer.ListLocalVars, RPCServer.Eval
    ├── goroutine.ts     # RPCServer.ListGoroutines, RPCServer.GetGoroutine
    ├── info.ts          # RPCServer.ListFunctions/Packages/Sources/Types
    ├── checkpoint.ts    # RPCServer.Create/List/ClearCheckpoint
    ├── config.ts        # RPCServer.Get/SetConfig
    └── misc.ts          # RPCServer.DumpCore, RPCServer.Rebuild, RPCServer.GetTarget
```

## JSON-RPC 通信模式

`DlvRpcClient` 通过 TCP Socket 连接 Delve，使用换行符分隔的 JSON-RPC 2.0 消息。

```typescript
// 调用格式
const result = await rpc.call<T>("RPCServer.MethodName", [params]);
```

## RPC 返回封装模式（关键！）

DLV RPC 的返回值总是封装在 PascalCase 字段名对象中。这是测试中最容易出错的地方。

```typescript
// 正确的调用和解析模式
const result = await rpc.call<{ Frames: DlvStackFrame[] }>("RPCServer.Stacktrace", [{ goroutineID: 1, depth: 50 }]);
return result.Frames;  // 从封装对象中提取数组

// 常见封装字段映射
rpc.call("RPCServer.Stacktrace")     → { Frames: DlvStackFrame[] }
rpc.call("RPCServer.ListLocalVars")  → { Variables: DlvVariable[] }
rpc.call("RPCServer.ListFunctionArgs") → { Args: DlvVariable[] }
rpc.call("RPCServer.ListBreakpoints") → { Breakpoints: DlvBreakpoint[] }
rpc.call("RPCServer.ListPackages")   → { Packages: string[] }
rpc.call("RPCServer.ListSources")    → { Sources: string[] }
rpc.call("RPCServer.ListTypes")      → { Types: DlvTypeInfo[] }
rpc.call("RPCServer.ListDynamicLibraries") → { Libraries: DlvLibrary[] }
rpc.call("RPCServer.State")          → { State: DlvDebuggerState } 或直接 DlvDebuggerState
rpc.call("RPCServer.ListGoroutines") → { Goroutines: DlvGoroutine[], Nextg: number, GroupBy: ... }
rpc.call("RPCServer.Version")        → { DelveVersion: string, APIVersion: string }
rpc.call("RPCServer.Command")        → { State: DlvDebuggerState }
rpc.call("RPCServer.CreateBreakpoint") → DlvBreakpoint (直接返回)
```

### `RPCServer.State` 的特殊处理

`getState` 和 `getStateWithNext` 需要处理两种返回格式：

```typescript
// src/protocol/dlv/api/debugger.ts
export async function getState(rpc: DlvRpcClient): Promise<DlvDebuggerState> {
  const result = await rpc.call<{ State?: DlvDebuggerState } | DlvDebuggerState>("RPCServer.State", [{}]);
  if (result && "State" in result && result.State) {
    return result.State;
  }
  return result as DlvDebuggerState;
}
```

### `RPCServer.ListFunctions` 的特殊处理

```typescript
// 返回可能是直接数组或封装对象
const result = await rpc.call<{ Funcs: string[] } | string[]>("RPCServer.ListFunctions", [{ filter }]);
if (Array.isArray(result)) return result;
return result.Funcs || [];
```

## DlvClient 关键实现细节

### 构造函数

```typescript
constructor(config: DebugConfig, loadConfig?: DlvLoadConfig)
// 内部创建 DlvRpcClient 实例
```

### Goroutine → ThreadInfo 转换

```typescript
// goroutineToThreadInfo 方法中的转换
// goroutine.threadId > 0 → "running" 状态
// goroutine.systemStack → isDaemon
```

### StackFrame 转换

```typescript
// stackFrameToStackFrame: location = `${f.file}:${f.line}`
// systemStack → isNative
```

### Variable 转换

```typescript
// dlvVariableToVariable: 使用 variableApi.parseVariableValue(v) 获取值
// 使用 variableApi.isPrimitive(v) 判断基本类型
// 使用 variableApi.isNil(v) 判断 null
```

### eval 实现

```typescript
async eval(expression: string, _threadId: string, _frameIndex: number, _options?: EvalOptions): Promise<EvalResult> {
  const result = await variableApi.evalExpr(this.rpc, expression);
  return { value: result.value, type: result.type };
}
```

## goroutine 相关 API

注意 `normalizeGoroutinesResult` 函数处理大小写字段兼容：

```typescript
// 关键：?? 运算符不会保留 null 值
// 错误写法：result["GroupBy"] ?? result["groupBy"]
// 正确写法：result["GroupBy"] ?? result["groupBy"] ?? null
```

## 断点管理

DlvClient 内部维护 `breakpointMap: Map<string, DlvBreakpoint>` 跟踪断点。断点 ID 格式为 `dlv_bp_${bp.id}`。

## API 函数参考

### debugger.ts
| 函数 | RPC 调用 | 参数 |
|------|----------|------|
| getVersion | RPCServer.Version | `[]` |
| getState | RPCServer.State | `[{}]` |
| getStateWithNext | RPCServer.State | `[{ Next: true }]` |
| command | RPCServer.Command | `[{ name, goroutineID?, expr? }]` |
| continueExecution | RPCServer.Command | `[{ name: "continue" }]` |
| halt | RPCServer.Command | `[{ name: "halt" }]` |
| detach | RPCServer.Detach | `[{ kill }]` |

### stack.ts
| 函数 | RPC 调用 | 返回 |
|------|----------|------|
| stacktrace | RPCServer.Stacktrace | `result.Frames` |
| stacktraceGoroutine | RPCServer.Stacktrace | `result.Frames` |
| stacktraceFull | RPCServer.Stacktrace (full:true) | `result.Frames` |
| stacktraceWithDefers | RPCServer.Stacktrace (defers:true) | `result.Frames` |
| ancestorStacktrace | RPCServer.Ancestors | `result.Frames` |
| frameUp | RPCServer.Stacktrace | `{ frame, index }` |
| frameDown | RPCServer.Stacktrace | `{ frame, index }` |
| setFrame | RPCServer.Frame | `DlvDebuggerState` |

### breakpoint.ts
| 函数 | RPC 调用 | 返回 |
|------|----------|------|
| listBreakpoints | RPCServer.ListBreakpoints | `result.Breakpoints` |
| createBreakpoint | RPCServer.CreateBreakpoint | 直接 DlvBreakpoint |
| clearBreakpoint | RPCServer.ClearBreakpoint | void |
| amendBreakpoint | RPCServer.AmendBreakpoint | DlvBreakpoint |

### variable.ts
| 函数 | RPC 调用 | 返回 |
|------|----------|------|
| listLocalVars | RPCServer.ListLocalVars | `result.Variables` |
| listFunctionArgs | RPCServer.ListFunctionArgs | `result.Args` |
| listPackageVars | RPCServer.ListPackageVars | `result.Variables` |
| listPackageConstants | RPCServer.ListPackageConstants | `result.Variables` |
| evalExpr | RPCServer.Eval | `result.Variable` (包含 value, type, children) |
| setVar | RPCServer.Set | void |

### info.ts
| 函数 | RPC 调用 | 返回 |
|------|----------|------|
| listFunctions | RPCServer.ListFunctions | `result.Funcs` 或直接数组 |
| listPackages | RPCServer.ListPackages | `result.Packages` |
| listSources | RPCServer.ListSources | `result.Sources` |
| listTypes | RPCServer.ListTypes | `result.Types` |
| listLibraries | RPCServer.ListDynamicLibraries | `result.Libraries` |

## DlvClient 方法映射

| DlvClient 方法 | 内部 API 调用 | 说明 |
|----------------|---------------|------|
| threads() | goroutineApi.getAllGoroutines + debuggerApi.getState | Go 使用 goroutine 而非线程 |
| stack(threadId) | stackApi.stacktraceGoroutine | 解析 goroutine ID |
| locals() | variableApi.listLocalVars | 创建 eval scope |
| setBreakpoint() | breakpointApi.createBreakpointAtLocation 或 createBreakpointAtFunction | 支持 file:line 或 function |
| eval() | variableApi.evalExpr | 传递完整表达式 |