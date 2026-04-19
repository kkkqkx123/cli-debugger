# Delve 协议实现差异分析

本文档对照 `docs/dlv` 目录的文档与 `src/protocol/dlv` 现有实现，分析缺失的功能。

## 一、执行控制功能（`api/debugger.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `continue` | `continueExecution()` | ✅ 已实现 |
| `next` | `next()` | ✅ 已实现 |
| `step` | `step()` | ✅ 已实现 |
| `stepout` | `stepOut()` | ✅ 已实现 |
| `halt` | `halt()` | ✅ 已实现 |
| `restart` | `restart()` | ✅ 已实现 |
| `rewind` | `rewind()` | ✅ 已实现 |
| `call` | `callFunction()` | ✅ 已实现 |
| `next-instruction` | - | ❌ 缺失 |
| `step-instruction` | - | ❌ 缺失 |
| `rebuild` | - | ❌ 缺失 |

### 需补充的 API

```typescript
// 指令级单步跳过
export async function nextInstruction(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult>;

// 指令级单步进入
export async function stepInstruction(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult>;

// 重新构建并重启
export async function rebuild(rpc: DlvRpcClient): Promise<DlvDebuggerState>;
```

---

## 二、断点管理功能（`api/breakpoint.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `break` | `createBreakpoint()` | ✅ 已实现 |
| `breakpoints` | `listBreakpoints()` | ✅ 已实现 |
| `clear` | `clearBreakpoint()` | ✅ 已实现 |
| `clearall` | `clearAllBreakpoints()` | ✅ 已实现 |
| `condition` | `setBreakpointCondition()` | ✅ 已实现 |
| `toggle` | `toggleBreakpoint()` | ✅ 已实现 |
| `trace` | `createTracepoint()` | ✅ 已实现 |
| `watch` | `createWatchpoint()` | ✅ 已实现 |
| `on` | - | ❌ 缺失 |

### 需补充的 API

```typescript
// 断点命中时执行命令
export async function setBreakpointCommand(
  rpc: DlvRpcClient,
  breakpointId: number,
  command: string,
): Promise<DlvBreakpoint>;
```

---

## 三、变量检查功能（`api/variable.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `locals` | `listLocalVars()` | ✅ 已实现 |
| `args` | `listFunctionArgs()` | ✅ 已实现 |
| `vars` | `listPackageVars()` | ✅ 已实现 |
| `print` | `evalExpr()` | ✅ 已实现 |
| `set` | `setVar()` | ✅ 已实现 |
| `whatis` | `getType()` | ✅ 已实现 |
| `examinemem` | `examineMemory()` | ✅ 已实现 |
| `regs` | `registers()` | ✅ 已实现 |
| `disassemble` | `disassemble()` | ✅ 已实现 |
| `display` | - | ❌ 缺失 |

### 需补充的 API

```typescript
// 自动显示表达式（每次停止时打印）
export interface DlvDisplay {
  id: number;
  expr: string;
}

export async function addDisplay(
  rpc: DlvRpcClient,
  expr: string,
): Promise<DlvDisplay>;

export async function removeDisplay(
  rpc: DlvRpcClient,
  id: number,
): Promise<void>;

export async function listDisplays(rpc: DlvRpcClient): Promise<DlvDisplay[]>;
```

---

## 四、协程管理功能（`api/goroutine.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `goroutines` | `listGoroutines()` | ✅ 已实现 |
| `goroutine` | `getGoroutine()` | ✅ 已实现 |
| 分组功能 | `listGoroutinesGrouped()` | ✅ 已实现 |
| 标签过滤 | `listGoroutinesWithLabel()` | ✅ 已实现 |
| 通道等待 | `listGoroutinesOnChannel()` | ✅ 已实现 |
| 运行中过滤 | `listRunningGoroutines()` | ✅ 已实现 |
| 用户协程过滤 | `listUserGoroutines()` | ✅ 已实现 |
| 协程标签 | `getGoroutineLabels()` | ✅ 已实现 |
| `-exec` 批量执行 | - | ❌ 缺失 |

### 需补充的 API

```typescript
// 在每个协程上执行命令
export async function execOnAllGoroutines(
  rpc: DlvRpcClient,
  command: string,
  filter?: DlvGoroutineFilter,
): Promise<Map<number, unknown>>;
```

---

## 五、栈操作功能（`api/stack.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `stack` | `stacktrace()` | ✅ 已实现 |
| `stack -full` | `stacktraceFull()` | ✅ 已实现 |
| `stack -defer` | `stacktraceWithDefers()` | ✅ 已实现 |
| 祖先栈 | `ancestorStacktrace()` | ✅ 已实现 |
| `frame` | `getFrame()` | ⚠️ 部分实现 |
| `up` | - | ❌ 缺失 |
| `down` | - | ❌ 缺失 |
| `deferred` | - | ❌ 缺失 |

### 需补充的 API

```typescript
// 栈帧导航
export async function frameUp(
  rpc: DlvRpcClient,
  goroutineId: number,
  steps?: number,
): Promise<DlvStackFrame | null>;

export async function frameDown(
  rpc: DlvRpcClient,
  goroutineId: number,
  steps?: number,
): Promise<DlvStackFrame | null>;

// 设置当前栈帧
export async function setFrame(
  rpc: DlvRpcClient,
  goroutineId: number,
  frameIndex: number,
): Promise<void>;

// 延迟调用上下文
export interface DlvDeferredCall {
  index: number;
  function: DlvFunction | null;
  location: DlvLocation;
}

export async function listDeferredCalls(
  rpc: DlvRpcClient,
  goroutineId: number,
  frameIndex: number,
): Promise<DlvDeferredCall[]>;
```

---

## 六、高级功能（需新增 `api/advanced.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `checkpoint` | 类型定义存在 | ⚠️ 需实现 API |
| `checkpoints` | - | ❌ 缺失 |
| `clear-checkpoint` | - | ❌ 缺失 |
| `config` | - | ❌ 缺失 |
| `dump` | - | ❌ 缺失 |
| `edit` | - | ❌ 缺失 |
| `list` | - | ❌ 缺失 |
| `source` | - | ❌ 缺失 |
| `transcript` | - | ❌ 缺失 |
| `funcs` | - | ❌ 缺失 |
| `packages` | - | ❌ 缺失 |
| `sources` | - | ❌ 缺失 |
| `types` | - | ❌ 缺失 |
| `libraries` | - | ❌ 缺失 |
| `target` | - | ❌ 缺失 |

### 需新增 `api/advanced.ts` 文件

```typescript
import type { DlvRpcClient } from "../rpc.js";
import type { DlvCheckpoint, DlvLocation, DlvFunction } from "../types.js";

// ==================== 检查点 ====================

export async function createCheckpoint(
  rpc: DlvRpcClient,
  note?: string,
): Promise<DlvCheckpoint> {
  return rpc.call<DlvCheckpoint>("RPCServer.Checkpoint", [{ note }]);
}

export async function listCheckpoints(
  rpc: DlvRpcClient,
): Promise<DlvCheckpoint[]> {
  return rpc.call<DlvCheckpoint[]>("RPCServer.ListCheckpoints", []);
}

export async function clearCheckpoint(
  rpc: DlvRpcClient,
  id: number,
): Promise<void> {
  await rpc.call("RPCServer.ClearCheckpoint", [{ id }]);
}

// ==================== 配置管理 ====================

export interface DlvDebuggerConfig {
  showLocationRegex: boolean;
  substitutePath: [string, string][];
  debugInfoDirectories: string[];
  maxStringLen: number;
  maxArrayValues: number;
  maxVariableRecurse: number;
}

export async function getConfig(
  rpc: DlvRpcClient,
): Promise<DlvDebuggerConfig> {
  return rpc.call<DlvDebuggerConfig>("RPCServer.GetConfig", []);
}

export async function setConfig(
  rpc: DlvRpcClient,
  key: string,
  value: unknown,
): Promise<void> {
  await rpc.call("RPCServer.SetConfig", [{ [key]: value }]);
}

// ==================== 核心转储 ====================

export async function dumpCore(
  rpc: DlvRpcClient,
  outputPath: string,
): Promise<void> {
  await rpc.call("RPCServer.Dump", [{ dest: outputPath }]);
}

// ==================== 源代码 ====================

export interface DlvSourceLocation {
  file: string;
  line: number;
  content: string[];
  locs: DlvLocation[];
}

export async function listSource(
  rpc: DlvRpcClient,
  locspec?: string,
): Promise<DlvSourceLocation> {
  return rpc.call<DlvSourceLocation>("RPCServer.List", [{ loc: locspec }]);
}

// ==================== 列表查询 ====================

export async function listFunctions(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  const result = await rpc.call<{ Funcs: string[] }>("RPCServer.ListFunctions", [
    { filter },
  ]);
  return result.Funcs;
}

export async function listPackages(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  const result = await rpc.call<{ Packages: string[] }>(
    "RPCServer.ListPackages",
    [{ filter }],
  );
  return result.Packages;
}

export async function listSources(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  const result = await rpc.call<{ Sources: string[] }>("RPCServer.ListSources", [
    { filter },
  ]);
  return result.Sources;
}

export async function listTypes(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  const result = await rpc.call<{ Types: string[] }>("RPCServer.ListTypes", [
    { filter },
  ]);
  return result.Types;
}

// ==================== 动态库 ====================

export interface DlvLibrary {
  path: string;
  address: number;
  loaded: boolean;
}

export async function listLibraries(rpc: DlvRpcClient): Promise<DlvLibrary[]> {
  return rpc.call<DlvLibrary[]>("RPCServer.ListDynamicLibraries", []);
}

// ==================== 目标进程管理 ====================

export interface DlvTarget {
  pid: number;
  cmd: string;
}

export async function getTarget(rpc: DlvRpcClient): Promise<DlvTarget> {
  return rpc.call<DlvTarget>("RPCServer.GetTarget", []);
}
```

---

## 七、类型定义需补充（`types.ts`）

```typescript
// 需补充的类型定义

/** 延迟调用 */
export interface DlvDeferredCall {
  index: number;
  function: DlvFunction | null;
  location: DlvLocation;
}

/** 动态库信息 */
export interface DlvLibrary {
  path: string;
  address: number;
  loaded: boolean;
}

/** 源代码位置 */
export interface DlvSourceLocation {
  file: string;
  line: number;
  content: string[];
  locs: DlvLocation[];
}

/** 反汇编指令 */
export interface DlvAssemblyInstruction {
  pc: number;
  text: string;
  bytes: number[];
  file: string;
  line: number;
}

/** 内存检查结果 */
export interface DlvMemoryResult {
  address: number;
  memory: number[];
  isLittleEndian: boolean;
}

/** 寄存器信息 */
export interface DlvRegister {
  name: string;
  value: string;
  dwarfNumber: number;
  pc: number;
}

/** 调试器配置 */
export interface DlvDebuggerConfig {
  showLocationRegex: boolean;
  substitutePath: [string, string][];
  debugInfoDirectories: string[];
  maxStringLen: number;
  maxArrayValues: number;
  maxVariableRecurse: number;
}

/** 显示表达式 */
export interface DlvDisplay {
  id: number;
  expr: string;
}

/** 目标进程信息 */
export interface DlvTarget {
  pid: number;
  cmd: string;
}
```

---

## 八、`DlvClient` 类需补充的方法

现有 `client.ts` 实现了 `DebugProtocol` 接口，建议新增 Go/Delve 特有的扩展方法：

```typescript
// Go 特有扩展方法
export interface GoDebugExtension {
  // 协程高级功能
  goroutinesFiltered(
    params: DlvListGoroutinesParams,
  ): Promise<DlvGoroutine[]>;
  goroutineLabels(goroutineId: number): Promise<Record<string, string>>;

  // 延迟调用
  deferredCalls(
    threadId: string,
    frameIndex: number,
  ): Promise<DlvDeferredCall[]>;

  // 包变量
  packageVars(filter?: string): Promise<Variable[]>;
  packageConstants(filter?: string): Promise<Variable[]>;

  // 反向执行（需录制模式）
  stepBack(threadId: string): Promise<void>;
  rewind(): Promise<void>;

  // 检查点
  createCheckpoint(note?: string): Promise<string>;
  listCheckpoints(): Promise<CheckpointInfo[]>;
  clearCheckpoint(id: string): Promise<void>;

  // 栈帧导航
  frameUp(steps?: number): Promise<StackFrame | null>;
  frameDown(steps?: number): Promise<StackFrame | null>;
  setFrame(index: number): Promise<void>;

  // 指令级单步
  stepInstruction(threadId: string): Promise<void>;
  nextInstruction(threadId: string): Promise<void>;

  // 函数参数
  args(threadId: string, frameIndex: number): Promise<Variable[]>;

  // 源代码和列表
  listSource(locspec?: string): Promise<SourceLocation>;
  listFunctions(filter?: string): Promise<string[]>;
  listPackages(filter?: string): Promise<string[]>;
  listSources(filter?: string): Promise<string[]>;
  listTypes(filter?: string): Promise<string[]>;

  // 内存和寄存器
  examineMemory(address: number, length: number): Promise<MemoryResult>;
  registers(includeFp?: boolean): Promise<Register[]>;

  // 反汇编
  disassemble(startPC?: number, endPC?: number): Promise<AssemblyInstruction[]>;

  // 配置
  getConfig(): Promise<DebuggerConfig>;
  setConfig(key: string, value: unknown): Promise<void>;

  // 重启和重建
  restart(position?: string): Promise<void>;
  rebuild(): Promise<void>;

  // 核心转储
  dumpCore(outputPath: string): Promise<void>;
}
```
