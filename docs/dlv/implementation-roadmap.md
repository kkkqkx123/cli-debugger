# Delve 协议实现路线图

本文档定义 `src/protocol/dlv` 的分阶段实现方案，确保逐步完善功能覆盖。

---

## 阶段概览

| 阶段 | 名称 | 目标 | 预估工作量 |
|------|------|------|------------|
| P0 | 核心调试功能 | 补齐基础调试能力 | 中 |
| P1 | 信息查询功能 | 完善信息检索 API | 中 |
| P2 | 高级调试功能 | 检查点、配置等 | 低 |
| P3 | 扩展接口 | Go 特有扩展方法 | 低 |

---

## P0 阶段：核心调试功能

### 目标

补齐调试过程中最常用的基础功能，确保基本调试流程完整。

### 任务清单

#### 1. 栈帧导航（`api/stack.ts`）

**优先级：最高**

```typescript
// 新增函数

/**
 * Move up in the call stack (towards caller)
 */
export async function frameUp(
  rpc: DlvRpcClient,
  goroutineId: number,
  currentFrame: number,
  steps = 1,
): Promise<{ frame: DlvStackFrame; index: number } | null> {
  const newIndex = currentFrame + steps;
  const frames = await stacktraceGoroutine(rpc, goroutineId, newIndex + 1);
  const frame = frames[newIndex];
  if (!frame) {
    return null;
  }
  return { frame, index: newIndex };
}

/**
 * Move down in the call stack (towards callee)
 */
export async function frameDown(
  rpc: DlvRpcClient,
  goroutineId: number,
  currentFrame: number,
  steps = 1,
): Promise<{ frame: DlvStackFrame; index: number } | null> {
  const newIndex = currentFrame - steps;
  if (newIndex < 0) {
    return null;
  }
  const frames = await stacktraceGoroutine(rpc, goroutineId, currentFrame + 1);
  const frame = frames[newIndex];
  if (!frame) {
    return null;
  }
  return { frame, index: newIndex };
}

/**
 * Set current frame for subsequent operations
 */
export async function setFrame(
  rpc: DlvRpcClient,
  goroutineId: number,
  frameIndex: number,
): Promise<DlvDebuggerState> {
  return rpc.call<DlvDebuggerState>("RPCServer.Frame", [
    { goroutineID: goroutineId, frame: frameIndex },
  ]);
}
```

**修改文件：**
- `src/protocol/dlv/api/stack.ts` - 新增上述函数
- `src/protocol/dlv/types.ts` - 确保类型完整

---

#### 2. 延迟调用支持（`api/stack.ts`）

**优先级：高**

```typescript
// 新增类型（types.ts）
export interface DlvDeferredCall {
  index: number;
  function: DlvFunction | null;
  location: DlvLocation;
  unreadable: string;
}

// 新增函数（api/stack.ts）

/**
 * List deferred calls in current frame
 */
export async function listDeferredCalls(
  rpc: DlvRpcClient,
  goroutineId: number,
  frameIndex: number,
): Promise<DlvDeferredCall[]> {
  const frames = await stacktraceWithDefers(rpc, goroutineId, frameIndex + 1);
  const frame = frames[frameIndex];
  if (!frame || !frame.defers) {
    return [];
  }
  return frame.defers.map((d, i) => ({
    index: i,
    function: d.function,
    location: d.location,
    unreadable: d.unreadable ?? "",
  }));
}
```

**修改文件：**
- `src/protocol/dlv/types.ts` - 新增 `DlvDeferredCall` 类型
- `src/protocol/dlv/api/stack.ts` - 新增 `listDeferredCalls` 函数

---

#### 3. 指令级单步（`api/debugger.ts`）

**优先级：中**

```typescript
// 新增函数

/**
 * Step single CPU instruction (skip function calls)
 */
export async function nextInstruction(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "nextInstruction",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}

/**
 * Step single CPU instruction
 */
export async function stepInstruction(
  rpc: DlvRpcClient,
  goroutineId?: number,
): Promise<DlvCommandResult> {
  const params: DlvCommandParams = {
    name: "stepInstruction",
    goroutineID: goroutineId,
  };
  return command(rpc, params);
}
```

**修改文件：**
- `src/protocol/dlv/types.ts` - 扩展 `DlvCommandName` 类型
- `src/protocol/dlv/api/debugger.ts` - 新增上述函数

---

#### 4. 断点命中命令（`api/breakpoint.ts`）

**优先级：中**

```typescript
// 新增函数

/**
 * Set command to execute when breakpoint is hit
 */
export async function setBreakpointCommand(
  rpc: DlvRpcClient,
  breakpointId: number,
  command: string,
): Promise<DlvBreakpoint> {
  const breakpoints = await listBreakpoints(rpc);
  const bp = breakpoints.find((b) => b.id === breakpointId);
  if (!bp) {
    throw new Error(`Breakpoint ${breakpointId} not found`);
  }
  return amendBreakpoint(rpc, {
    ...bp,
    on: command,
  } as DlvBreakpoint);
}
```

**修改文件：**
- `src/protocol/dlv/types.ts` - 确保 `DlvBreakpoint` 包含 `on` 字段
- `src/protocol/dlv/api/breakpoint.ts` - 新增 `setBreakpointCommand` 函数

---

#### 5. `DlvClient` 扩展方法

**优先级：高**

在 `client.ts` 中新增以下方法：

```typescript
// ==================== Extended Methods ====================

/**
 * Get function arguments
 */
async args(threadId: string, frameIndex: number): Promise<Variable[]> {
  this.ensureConnected();
  const goroutineId = parseInt(threadId, 10);
  const scope = variableApi.createEvalScope(goroutineId, frameIndex);
  const vars = await variableApi.listFunctionArgs(this.rpc, scope);
  return vars.map((v) => this.dlvVariableToVariable(v));
}

/**
 * Navigate up in call stack
 */
async frameUp(steps = 1): Promise<StackFrame | null> {
  this.ensureConnected();
  const state = await debuggerApi.getState(this.rpc);
  const goroutineId = state.currentGoroutine?.id ?? 0;
  // Need to track current frame index - add instance variable
  const result = await stackApi.frameUp(
    this.rpc,
    goroutineId,
    this.currentFrameIndex,
    steps,
  );
  if (result) {
    this.currentFrameIndex = result.index;
    return this.stackFrameToStackFrame(result.frame, result.index);
  }
  return null;
}

/**
 * Navigate down in call stack
 */
async frameDown(steps = 1): Promise<StackFrame | null> {
  this.ensureConnected();
  const state = await debuggerApi.getState(this.rpc);
  const goroutineId = state.currentGoroutine?.id ?? 0;
  const result = await stackApi.frameDown(
    this.rpc,
    goroutineId,
    this.currentFrameIndex,
    steps,
  );
  if (result) {
    this.currentFrameIndex = result.index;
    return this.stackFrameToStackFrame(result.frame, result.index);
  }
  return null;
}

/**
 * Set current frame
 */
async setFrame(frameIndex: number): Promise<void> {
  this.ensureConnected();
  const state = await debuggerApi.getState(this.rpc);
  const goroutineId = state.currentGoroutine?.id ?? 0;
  await stackApi.setFrame(this.rpc, goroutineId, frameIndex);
  this.currentFrameIndex = frameIndex;
}

/**
 * Get deferred calls
 */
async deferredCalls(
  threadId: string,
  frameIndex: number,
): Promise<DlvDeferredCall[]> {
  this.ensureConnected();
  const goroutineId = parseInt(threadId, 10);
  return stackApi.listDeferredCalls(this.rpc, goroutineId, frameIndex);
}

/**
 * Instruction-level step
 */
async stepInstruction(threadId: string): Promise<void> {
  this.ensureConnected();
  const goroutineId = parseInt(threadId, 10);
  await debuggerApi.stepInstruction(this.rpc, goroutineId);
}

/**
 * Instruction-level next
 */
async nextInstruction(threadId: string): Promise<void> {
  this.ensureConnected();
  const goroutineId = parseInt(threadId, 10);
  await debuggerApi.nextInstruction(this.rpc, goroutineId);
}
```

**修改文件：**
- `src/protocol/dlv/client.ts` - 新增上述方法，添加 `currentFrameIndex` 实例变量

---

### P0 阶段验收标准

- [ ] 栈帧导航 (`up/down/frame`) 可正常工作
- [ ] 延迟调用 (`deferred`) 可正确列出
- [ ] 指令级单步 (`step-instruction/next-instruction`) 可执行
- [ ] 断点命中命令 (`on`) 可设置
- [ ] 函数参数 (`args`) 可正确获取
- [ ] 单元测试覆盖新增功能

---

## P1 阶段：信息查询功能

### 目标

完善信息检索 API，支持查询函数、包、源文件、类型等列表。

### 任务清单

#### 1. 新增 `api/info.ts` 文件

```typescript
/**
 * Delve information query API
 */

import type { DlvRpcClient } from "../rpc.js";

// ==================== Function List ====================

export interface DlvFunctionInfo {
  name: string;
  type: number;
  value: number;
  goType: number;
}

export async function listFunctions(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<DlvFunctionInfo[]> {
  return rpc.call<DlvFunctionInfo[]>("RPCServer.ListFunctions", [
    { filter },
  ]);
}

// ==================== Package List ====================

export async function listPackages(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  return rpc.call<string[]>("RPCServer.ListPackages", [{ filter }]);
}

// ==================== Source File List ====================

export async function listSources(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<string[]> {
  return rpc.call<string[]>("RPCServer.ListSources", [{ filter }]);
}

// ==================== Type List ====================

export interface DlvTypeInfo {
  name: string;
  size: number;
  kind: number;
}

export async function listTypes(
  rpc: DlvRpcClient,
  filter?: string,
): Promise<DlvTypeInfo[]> {
  return rpc.call<DlvTypeInfo[]>("RPCServer.ListTypes", [{ filter }]);
}

// ==================== Dynamic Libraries ====================

export interface DlvLibrary {
  path: string;
  address: number;
  loaded: boolean;
}

export async function listLibraries(rpc: DlvRpcClient): Promise<DlvLibrary[]> {
  return rpc.call<DlvLibrary[]>("RPCServer.ListDynamicLibraries", []);
}

// ==================== Source Code ====================

export interface DlvSourceLocation {
  file: string;
  line: number;
  content: string[];
  locs: Array<{
    pc: number;
    file: string;
    line: number;
    function: { name: string } | null;
  }>;
}

export async function listSource(
  rpc: DlvRpcClient,
  locspec?: string,
): Promise<DlvSourceLocation> {
  return rpc.call<DlvSourceLocation>("RPCServer.List", [
    { loc: locspec ?? "" },
  ]);
}
```

**新增文件：**
- `src/protocol/dlv/api/info.ts`

---

#### 2. 更新 `DlvClient`

```typescript
// 新增方法

/**
 * List functions
 */
async listFunctions(filter?: string): Promise<string[]> {
  this.ensureConnected();
  const funcs = await infoApi.listFunctions(this.rpc, filter);
  return funcs.map((f) => f.name);
}

/**
 * List packages
 */
async listPackages(filter?: string): Promise<string[]> {
  this.ensureConnected();
  return infoApi.listPackages(this.rpc, filter);
}

/**
 * List source files
 */
async listSources(filter?: string): Promise<string[]> {
  this.ensureConnected();
  return infoApi.listSources(this.rpc, filter);
}

/**
 * List types
 */
async listTypes(filter?: string): Promise<string[]> {
  this.ensureConnected();
  const types = await infoApi.listTypes(this.rpc, filter);
  return types.map((t) => t.name);
}

/**
 * List dynamic libraries
 */
async listLibraries(): Promise<DlvLibrary[]> {
  this.ensureConnected();
  return infoApi.listLibraries(this.rpc);
}

/**
 * Show source code
 */
async showSource(locspec?: string): Promise<infoApi.DlvSourceLocation> {
  this.ensureConnected();
  return infoApi.listSource(this.rpc, locspec);
}
```

**修改文件：**
- `src/protocol/dlv/client.ts` - 导入 `infoApi`，新增上述方法

---

### P1 阶段验收标准

- [ ] `listFunctions()` 可列出函数
- [ ] `listPackages()` 可列出包
- [ ] `listSources()` 可列出源文件
- [ ] `listTypes()` 可列出类型
- [ ] `listLibraries()` 可列出动态库
- [ ] `showSource()` 可显示源代码
- [ ] 单元测试覆盖新增功能

---

## P2 阶段：高级调试功能

### 目标

实现检查点、配置管理、核心转储等高级功能。

### 任务清单

#### 1. 新增 `api/advanced.ts` 文件

```typescript
/**
 * Delve advanced features API
 */

import type { DlvRpcClient } from "../rpc.js";
import type { DlvCheckpoint, DlvLocation } from "../types.js";

// ==================== Checkpoints ====================

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

// ==================== Configuration ====================

export interface DlvDebuggerConfig {
  showLocationRegex: boolean;
  substitutePathRules: Array<{ from: string; to: string }>;
  debugInfoDirectories: string[];
  maxStringLen: number;
  maxArrayValues: number;
  maxVariableRecurse: number;
  maxStructFields: number;
}

export async function getConfig(
  rpc: DlvRpcClient,
): Promise<DlvDebuggerConfig> {
  return rpc.call<DlvDebuggerConfig>("RPCServer.GetConfig", []);
}

export async function setConfig(
  rpc: DlvRpcClient,
  config: Partial<DlvDebuggerConfig>,
): Promise<void> {
  await rpc.call("RPCServer.SetConfig", [config]);
}

export async function addSubstitutePath(
  rpc: DlvRpcClient,
  from: string,
  to: string,
): Promise<void> {
  await rpc.call("RPCServer.AddSubstitutePath", [{ from, to }]);
}

export async function removeSubstitutePath(
  rpc: DlvRpcClient,
  from: string,
): Promise<void> {
  await rpc.call("RPCServer.RemoveSubstitutePath", [{ from }]);
}

// ==================== Core Dump ====================

export async function dumpCore(
  rpc: DlvRpcClient,
  outputPath: string,
): Promise<void> {
  await rpc.call("RPCServer.Dump", [{ dest: outputPath }]);
}

// ==================== Rebuild ====================

export async function rebuild(rpc: DlvRpcClient): Promise<void> {
  await rpc.call("RPCServer.Rebuild", []);
}

// ==================== Target Process ====================

export interface DlvTarget {
  pid: number;
  cmd: string[];
}

export async function getTarget(rpc: DlvRpcClient): Promise<DlvTarget> {
  return rpc.call<DlvTarget>("RPCServer.GetTarget", []);
}
```

**新增文件：**
- `src/protocol/dlv/api/advanced.ts`

---

#### 2. 更新 `DlvClient`

```typescript
// 新增方法

/**
 * Create checkpoint
 */
async createCheckpoint(note?: string): Promise<DlvCheckpoint> {
  this.ensureConnected();
  return advancedApi.createCheckpoint(this.rpc, note);
}

/**
 * List checkpoints
 */
async listCheckpoints(): Promise<DlvCheckpoint[]> {
  this.ensureConnected();
  return advancedApi.listCheckpoints(this.rpc);
}

/**
 * Clear checkpoint
 */
async clearCheckpoint(id: number): Promise<void> {
  this.ensureConnected();
  await advancedApi.clearCheckpoint(this.rpc, id);
}

/**
 * Get debugger config
 */
async getConfig(): Promise<advancedApi.DlvDebuggerConfig> {
  this.ensureConnected();
  return advancedApi.getConfig(this.rpc);
}

/**
 * Set debugger config
 */
async setConfig(config: Partial<advancedApi.DlvDebuggerConfig>): Promise<void> {
  this.ensureConnected();
  await advancedApi.setConfig(this.rpc, config);
}

/**
 * Dump core
 */
async dumpCore(outputPath: string): Promise<void> {
  this.ensureConnected();
  await advancedApi.dumpCore(this.rpc, outputPath);
}

/**
 * Rebuild target
 */
async rebuild(): Promise<void> {
  this.ensureConnected();
  await advancedApi.rebuild(this.rpc);
}
```

**修改文件：**
- `src/protocol/dlv/client.ts` - 导入 `advancedApi`，新增上述方法

---

### P2 阶段验收标准

- [ ] 检查点创建/列出/删除可正常工作
- [ ] 配置获取/设置可正常工作
- [ ] 核心转储可正常生成
- [ ] 重新构建可正常执行
- [ ] 单元测试覆盖新增功能

---

## P3 阶段：扩展接口

### 目标

定义并实现 Go 特有的扩展接口，提供完整的 Go 调试体验。

### 任务清单

#### 1. 定义扩展接口

```typescript
// src/protocol/dlv/extension.ts

import type { DebugProtocol } from "../base.js";
import type { StackFrame, Variable } from "../../types/debug.js";
import type {
  DlvGoroutine,
  DlvListGoroutinesParams,
  DlvDeferredCall,
  DlvCheckpoint,
  DlvLibrary,
} from "./types.js";

/**
 * Go-specific debug extension interface
 */
export interface GoDebugExtension {
  // ==================== Goroutine Extensions ====================

  /**
   * List goroutines with advanced filtering
   */
  goroutinesFiltered(
    params: DlvListGoroutinesParams,
  ): Promise<DlvGoroutine[]>;

  /**
   * Get goroutine labels
   */
  goroutineLabels(goroutineId: number): Promise<Record<string, string>>;

  /**
   * Execute command on all goroutines
   */
  execOnAllGoroutines(
    command: string,
    filter?: DlvListGoroutinesParams,
  ): Promise<Map<number, unknown>>;

  // ==================== Deferred Calls ====================

  /**
   * List deferred calls in frame
   */
  deferredCalls(
    threadId: string,
    frameIndex: number,
  ): Promise<DlvDeferredCall[]>;

  // ==================== Package Variables ====================

  /**
   * List package variables
   */
  packageVars(filter?: string): Promise<Variable[]>;

  /**
   * List package constants
   */
  packageConstants(filter?: string): Promise<Variable[]>;

  // ==================== Reverse Execution ====================

  /**
   * Step backward (requires recording mode)
   */
  stepBack(threadId: string): Promise<void>;

  /**
   * Rewind execution (requires recording mode)
   */
  rewind(): Promise<void>;

  // ==================== Checkpoints ====================

  /**
   * Create checkpoint
   */
  createCheckpoint(note?: string): Promise<DlvCheckpoint>;

  /**
   * List checkpoints
   */
  listCheckpoints(): Promise<DlvCheckpoint[]>;

  /**
   * Clear checkpoint
   */
  clearCheckpoint(id: number): Promise<void>;

  // ==================== Stack Navigation ====================

  /**
   * Move up in call stack
   */
  frameUp(steps?: number): Promise<StackFrame | null>;

  /**
   * Move down in call stack
   */
  frameDown(steps?: number): Promise<StackFrame | null>;

  /**
   * Set current frame
   */
  setFrame(index: number): Promise<void>;

  // ==================== Instruction Level ====================

  /**
   * Step single instruction
   */
  stepInstruction(threadId: string): Promise<void>;

  /**
   * Next instruction (skip calls)
   */
  nextInstruction(threadId: string): Promise<void>;

  // ==================== Function Arguments ====================

  /**
   * Get function arguments
   */
  args(threadId: string, frameIndex: number): Promise<Variable[]>;

  // ==================== Information Queries ====================

  /**
   * List functions
   */
  listFunctions(filter?: string): Promise<string[]>;

  /**
   * List packages
   */
  listPackages(filter?: string): Promise<string[]>;

  /**
   * List source files
   */
  listSources(filter?: string): Promise<string[]>;

  /**
   * List types
   */
  listTypes(filter?: string): Promise<string[]>;

  /**
   * List dynamic libraries
   */
  listLibraries(): Promise<DlvLibrary[]>;

  // ==================== Memory & Registers ====================

  /**
   * Examine memory at address
   */
  examineMemory(address: number, length: number): Promise<{
    address: number;
    memory: number[];
    isLittleEndian: boolean;
  }>;

  /**
   * Get CPU registers
   */
  registers(includeFp?: boolean): Promise<
    Array<{ name: string; value: string }>
  >;

  // ==================== Disassembly ====================

  /**
   * Disassemble code
   */
  disassemble(
    startPC?: number,
    endPC?: number,
  ): Promise<Array<{ pc: number; text: string; bytes: number[] }>>;

  // ==================== Configuration ====================

  /**
   * Get debugger configuration
   */
  getConfig(): Promise<Record<string, unknown>>;

  /**
   * Set debugger configuration
   */
  setConfig(key: string, value: unknown): Promise<void>;

  // ==================== Process Control ====================

  /**
   * Restart process
   */
  restart(position?: string): Promise<void>;

  /**
   * Rebuild and restart
   */
  rebuild(): Promise<void>;

  /**
   * Dump core
   */
  dumpCore(outputPath: string): Promise<void>;
}

/**
 * Combined interface for full Go debugging support
 */
export interface GoDebugProtocol extends DebugProtocol, GoDebugExtension {}
```

**新增文件：**
- `src/protocol/dlv/extension.ts`

---

#### 2. 更新模块导出

```typescript
// src/protocol/dlv/index.ts

export { DlvClient } from "./client.js";
export * from "./types.js";
export { DlvRpcClient } from "./rpc.js";
export type { GoDebugExtension, GoDebugProtocol } from "./extension.js";

// API exports
export * as debuggerApi from "./api/debugger.js";
export * as breakpointApi from "./api/breakpoint.js";
export * as goroutineApi from "./api/goroutine.js";
export * as stackApi from "./api/stack.js";
export * as variableApi from "./api/variable.js";
export * as infoApi from "./api/info.js";
export * as advancedApi from "./api/advanced.js";
```

**修改文件：**
- `src/protocol/dlv/index.ts`

---

### P3 阶段验收标准

- [ ] `GoDebugExtension` 接口定义完整
- [ ] `GoDebugProtocol` 组合接口可用
- [ ] 所有扩展方法在 `DlvClient` 中实现
- [ ] 类型导出正确
- [ ] 文档更新

---

## 实施顺序建议

```
P0.1 栈帧导航 (api/stack.ts)
  ↓
P0.2 延迟调用 (api/stack.ts)
  ↓
P0.3 指令级单步 (api/debugger.ts)
  ↓
P0.4 断点命中命令 (api/breakpoint.ts)
  ↓
P0.5 DlvClient 扩展方法
  ↓
P1.1 新增 api/info.ts
  ↓
P1.2 DlvClient 信息查询方法
  ↓
P2.1 新增 api/advanced.ts
  ↓
P2.2 DlvClient 高级功能方法
  ↓
P3.1 定义扩展接口
  ↓
P3.2 更新模块导出
```

---

## 测试策略

### 单元测试

每个新增 API 函数需编写单元测试：

```
src/protocol/dlv/__tests__/
├── stack.test.ts      # 栈帧导航、延迟调用测试
├── debugger.test.ts   # 指令级单步测试
├── breakpoint.test.ts # 断点命令测试
├── info.test.ts       # 信息查询测试
└── advanced.test.ts   # 高级功能测试
```

### 集成测试

需要真实 Delve 服务器：

```bash
# 启动 Delve
dlv debug --headless --listen=:4040 --api-version=2

# 运行测试
npm test -- src/protocol/dlv/__tests__/integration.test.ts
```

---

## 文件变更汇总

| 阶段 | 文件 | 操作 |
|------|------|------|
| P0 | `api/stack.ts` | 修改 |
| P0 | `api/debugger.ts` | 修改 |
| P0 | `api/breakpoint.ts` | 修改 |
| P0 | `types.ts` | 修改 |
| P0 | `client.ts` | 修改 |
| P1 | `api/info.ts` | 新增 |
| P1 | `client.ts` | 修改 |
| P2 | `api/advanced.ts` | 新增 |
| P2 | `client.ts` | 修改 |
| P3 | `extension.ts` | 新增 |
| P3 | `index.ts` | 修改 |
