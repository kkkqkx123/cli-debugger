# LLDB 协议实现功能缺口分析

## 概述

本文档记录 `cli-debugger` LLDB 协议实现与 LLDB Python API 的功能对比分析，明确需要补充的功能及其优先级。

## 功能覆盖率统计

| 类别 | 已实现 | 待补充 | 覆盖率 |
|------|--------|--------|--------|
| SBDebugger | 3/3 | 0 | 100% |
| SBTarget | 8/13 | 5 | 62% |
| SBProcess | 9/16 | 7 | 56% |
| SBThread | 10/18 | 8 | 56% |
| SBFrame | 10/14 | 4 | 71% |
| SBValue | 8/12 | 4 | 67% |
| SBBreakpoint | 3/6 | 3 | 50% |
| **总计** | **51/82** | **31** | **62%** |

---

## 已实现的功能

### SBDebugger (100%)

| 功能 | Python API | 实现位置 |
|------|------------|----------|
| 创建调试器实例 | `SBDebugger.Create()` | `lldb_bridge.py:44` |
| 设置同步模式 | `SetAsync(False)` | `lldb_bridge.py:45` |
| 获取版本信息 | `GetVersionString()` | `lldb_bridge.py:195-201` |

### SBTarget (62%)

| 功能 | Python API | 实现位置 |
|------|------------|----------|
| 创建调试目标 | `CreateTarget()` | `lldb_bridge.py:97` |
| 按文件:行号设置断点 | `BreakpointCreateByLocation()` | `lldb_bridge.py:405` |
| 按函数名设置断点 | `BreakpointCreateByName()` | `lldb_bridge.py:408` |
| 删除断点 | `BreakpointDelete()` | `lldb_bridge.py:441` |
| 删除所有断点 | `DeleteAllBreakpoints()` | `lldb_bridge.py:449` |
| 启动进程 | `Launch()` | `lldb_bridge.py:182` |
| 按 PID 附加 | `AttachToProcessWithID()` | `lldb_bridge.py:115` |
| 按名称附加（等待） | `AttachToProcessWithName()` | `lldb_bridge.py:122` |
| 加载 Core Dump | `LoadCore()` | `lldb_bridge.py:110` |
| 表达式求值 | `EvaluateExpression()` | `lldb_bridge.py:549` |

### SBProcess (56%)

| 功能 | Python API | 实现位置 |
|------|------------|----------|
| 继续执行 | `Continue()` | `lldb_bridge.py:341` |
| 停止执行 | `Stop()` | `lldb_bridge.py:329` |
| 终止进程 | `Kill()` | `lldb_bridge.py:142` |
| 分离进程 | `Detach()` | `lldb_bridge.py:140` |
| 获取进程状态 | `GetState()` | `lldb_bridge.py:366-385` |
| 获取 PID | `GetProcessID()` | `lldb_bridge.py:189` |
| 获取线程数量 | `GetNumThreads()` | `lldb_bridge.py:225` |
| 按索引获取线程 | `GetThreadAtIndex()` | `lldb_bridge.py:226` |

### SBThread (56%)

| 功能 | Python API | 实现位置 |
|------|------------|----------|
| 线程 ID | `GetThreadID()` | `lldb_bridge.py:229` |
| 线程名称 | `GetName()` | `lldb_bridge.py:230` |
| 线程状态 | `GetState()` | `lldb_bridge.py:251-267` |
| 停止原因 | `GetStopReason()` | `lldb_bridge.py:269-283` |
| 栈帧数量 | `GetNumFrames()` | `lldb_bridge.py:233` |
| 单步进入 | `StepInto()` | `lldb_bridge.py:349` |
| 单步跳过 | `StepOver()` | `lldb_bridge.py:356` |
| 单步跳出 | `StepOut()` | `lldb_bridge.py:363` |
| 按索引获取栈帧 | `GetFrameAtIndex()` | `lldb_bridge.py:298` |

### SBFrame (71%)

| 功能 | Python API | 实现位置 |
|------|------------|----------|
| 栈帧索引 | `GetFrameID()` | `lldb_bridge.py:309` |
| PC 地址 | `GetPC()` | `lldb_bridge.py:320` |
| 函数名 | `GetFunctionName()` | `lldb_bridge.py:316` |
| 行号信息 | `GetLineEntry()` | `lldb_bridge.py:305` |
| 模块信息 | `GetModule()` | `lldb_bridge.py:317` |
| 是否内联帧 | `IsInlined()` | `lldb_bridge.py:321` |
| 获取参数 | `GetArguments()` | `lldb_bridge.py:501-503` |
| 获取局部变量 | `GetVariables()` | `lldb_bridge.py:506-508` |
| 按名称查找变量 | `FindVariable()` | `lldb_bridge.py:522` |
| 表达式求值 | `EvaluateExpression()` | `lldb_bridge.py:546` |

### SBValue (67%)

| 功能 | Python API | 实现位置 |
|------|------------|----------|
| 名称 | `GetName()` | `lldb_bridge.py:563` |
| 类型 | `GetType()` | `lldb_bridge.py:560` |
| 值字符串 | `GetValue()` | `lldb_bridge.py:584` |
| 摘要 | `GetSummary()` | `lldb_bridge.py:579` |
| 子元素数量 | `GetNumChildren()` | `lldb_bridge.py:570` |
| 类型检查 | `IsPointerType()`, `IsArrayType()`, `IsStructType()` | `lldb_bridge.py:567-569` |

---

## 待补充的功能

### 高优先级 (P0)

#### 1. 按地址设置断点

**用途**: 调试场景中常用于在特定内存地址设置断点，如动态加载的代码或无调试信息的场景。

**Python API**:
```python
bp = target.BreakpointCreateByAddress(0x12345678)
```

**实现位置**: `lldb_bridge.py` - `handle_set_breakpoint` 方法扩展

**TypeScript API**:
```typescript
async setBreakpointAtAddress(address: number): Promise<string>;
```

---

#### 2. 线程级挂起/恢复

**用途**: 精细化线程控制，允许单独挂起或恢复某个线程而不影响其他线程。

**Python API**:
```python
thread.Suspend()  # 挂起单个线程
thread.Resume()   # 恢复单个线程
```

**实现位置**: `lldb_bridge.py` - `handle_suspend` / `handle_resume` 方法扩展

**TypeScript API**:
```typescript
// 已有接口，需确保线程级控制正确实现
async suspend(threadId?: string): Promise<void>;
async resume(threadId?: string): Promise<void>;
```

---

#### 3. 寄存器访问

**用途**: 底层调试必需功能，用于查看和修改 CPU 寄存器状态。

**Python API**:
```python
register_sets = frame.GetRegisters()
for reg_set in register_sets:
    for i in range(reg_set.GetNumChildren()):
        reg = reg_set.GetChildAtIndex(i)
        print(f"{reg.GetName()} = {reg.GetValue()}")
```

**实现位置**: 新增 `handle_registers` 方法

**TypeScript 类型**:
```typescript
interface RegisterSet {
  name: string;
  registers: Register[];
}

interface Register {
  name: string;
  value: string;
  type?: string;
  size?: number;
}
```

**TypeScript API**:
```typescript
async registers(threadId: string, frameIndex: number): Promise<RegisterSet[]>;
```

---

### 中优先级 (P1)

#### 4. 线程选择管理

**用途**: 管理当前选中的线程，影响后续操作的默认上下文。

**Python API**:
```python
selected_thread = process.GetSelectedThread()
process.SetSelectedThread(thread)
process.SetSelectedThreadByID(thread_id)
```

**TypeScript API**:
```typescript
async getSelectedThread(): Promise<ThreadInfo>;
async setSelectedThread(threadId: string): Promise<void>;
```

---

#### 5. 栈帧选择管理

**用途**: 管理当前选中的栈帧，影响变量检查和表达式求值的上下文。

**Python API**:
```python
selected_frame = thread.GetSelectedFrame()
thread.SetSelectedFrame(0)
```

**TypeScript API**:
```typescript
async getSelectedFrame(threadId: string): Promise<StackFrame>;
async setSelectedFrame(threadId: string, frameIndex: number): Promise<void>;
```

---

#### 6. 进程退出信息

**用途**: 获取进程终止状态和描述，用于判断正常退出还是异常终止。

**Python API**:
```python
exit_status = process.GetExitStatus()
exit_desc = process.GetExitDescription()
```

**TypeScript 类型**:
```typescript
interface ProcessExitInfo {
  status: number;
  description: string | null;
}
```

**TypeScript API**:
```typescript
async getExitInfo(): Promise<ProcessExitInfo | null>;
```

---

#### 7. 按路径获取变量

**用途**: 支持复杂对象访问，如 `obj->field`、`array[0]` 等路径表达式。

**Python API**:
```python
var = frame.GetValueForVariablePath("obj->field")
var = frame.GetValueForVariablePath("array[0]")
```

**TypeScript API**:
```typescript
async getVariableByPath(
  threadId: string,
  frameIndex: number,
  path: string
): Promise<Variable>;
```

---

#### 8. 断点启用/禁用

**用途**: 临时禁用断点而不删除，便于调试流程控制。

**Python API**:
```python
bp.SetEnabled(True)   # 启用
bp.SetEnabled(False)  # 禁用
```

**TypeScript API**:
```typescript
async enableBreakpoint(id: string): Promise<void>;
async disableBreakpoint(id: string): Promise<void>;
```

---

#### 9. 表达式求值选项

**用途**: 控制表达式求值行为，如超时、错误处理等。

**Python API**:
```python
options = lldb.SBExpressionOptions()
options.SetTimeoutInMicroseconds(5000000)
result = target.EvaluateExpression("expr", options)
```

**TypeScript 类型**:
```typescript
interface EvalOptions {
  timeout?: number;           // milliseconds
  unwindOnError?: boolean;
  ignoreBreakpoints?: boolean;
  language?: string;
}
```

**TypeScript API**:
```typescript
async eval(
  expression: string,
  options?: EvalOptions,
  threadId?: string,
  frameIndex?: number
): Promise<Variable>;
```

---

#### 10. 停止描述

**用途**: 获取线程停止的详细描述信息，如断点命中、信号接收等。

**Python API**:
```python
desc = thread.GetStopDescription(256)
```

**实现状态**: Python 端已实现，需暴露到 TypeScript API。

**TypeScript API**:
```typescript
async getStopDescription(threadId: string, maxLength?: number): Promise<string>;
```

---

### 低优先级 (P2)

#### 11. 按源代码正则设置断点

**Python API**:
```python
bp = target.BreakpointCreateBySourceRegex("pattern", "main.c")
```

---

#### 12. 目标元数据查询

**Python API**:
```python
exe_spec = target.GetExecutable()
triple = target.GetTriple()
num_modules = target.GetNumModules()
```

---

#### 13. 进程 I/O 操作

**Python API**:
```python
process.PutSTDIN(b"input data\n")
bytes_read = process.GetSTDOUT(buffer, len(buffer))
bytes_read = process.GetSTDERR(buffer, len(buffer))
```

---

#### 14. 批量信息获取

**Python API**:
```python
addrs = thread.GetAddresses()
mods = thread.GetModules()
symbols = thread.GetSymbols()
files = thread.GetFileNames()
lines = thread.GetLineNumbers()
funcs = thread.GetFunctionNames()
```

---

#### 15. 符号查询（无调试信息时）

**Python API**:
```python
symbol = frame.GetSymbol()
```

---

#### 16. 类型系统完善

**Python API**:
```python
basic_type = type_obj.GetBasicType()
is_reference = type_obj.IsReferenceType()
is_typedef = type_obj.IsTypedefType()
```

---

#### 17. 断点位置详情

**Python API**:
```python
num_locations = bp.GetNumLocations()
loc = bp.GetLocationAtIndex(i)
```

---

## 实现计划

### Phase 1: 核心功能补全 (P0)

1. **按地址设置断点** - 扩展现有 `setBreakpoint` 方法
2. **线程级挂起/恢复** - 完善现有 `suspend`/`resume` 方法
3. **寄存器访问** - 新增 `registers` 方法

### Phase 2: 状态管理增强 (P1)

4. **线程选择管理** - 新增 `getSelectedThread`/`setSelectedThread` 方法
5. **栈帧选择管理** - 新增 `getSelectedFrame`/`setSelectedFrame` 方法
6. **进程退出信息** - 新增 `getExitInfo` 方法
7. **停止描述** - 新增 `getStopDescription` 方法

### Phase 3: 高级功能 (P1)

8. **按路径获取变量** - 新增 `getVariableByPath` 方法
9. **断点启用/禁用** - 新增 `enableBreakpoint`/`disableBreakpoint` 方法
10. **表达式求值选项** - 扩展现有 `eval` 方法

### Phase 4: 辅助功能 (P2)

11-17. 低优先级功能按需实现

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-19 | 1.0 | 初始版本，完成功能缺口分析 |
