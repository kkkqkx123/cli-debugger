# LLDB Python API 参考

## 概述

LLDB 提供了完整的 Python 绑定，允许通过 Python 脚本控制调试器。本文档整理了实现 `cli-debugger` LLDB 协议所需的核心 API。

## 核心类层次结构

```
SBDebugger
    └── SBTarget (调试目标)
            ├── SBProcess (进程)
            │       └── SBThread (线程)
            │               └── SBFrame (栈帧)
            │                       └── SBValue (变量/值)
            ├── SBBreakpoint (断点)
            └── SBModule (模块)
```

## SBDebugger

调试器主对象，是所有调试操作的入口点。

### 创建和初始化

```python
import lldb

# 创建调试器实例
debugger = lldb.SBDebugger.Create()

# 设置同步模式（推荐用于脚本控制）
debugger.SetAsync(False)

# 获取版本信息
version = debugger.GetVersionString()
```

### 创建调试目标

```python
# 从可执行文件创建目标
target = debugger.CreateTargetWithFileAndArch(
    "/path/to/executable",
    lldb.LLDB_ARCH_DEFAULT
)

# 或使用简化方法
target = debugger.CreateTarget(
    "/path/to/executable",
    None,  # triple
    None,  # platform_name
    False  # add_dependent_modules
)

# 删除目标
debugger.DeleteTarget(target)
```

## SBTarget

代表被调试的程序（可执行文件）。

### 断点管理

```python
# 按函数名设置断点
bp = target.BreakpointCreateByName("main", "executable_name")

# 按文件和行号设置断点
bp = target.BreakpointCreateByLocation("main.c", 42)

# 按源代码正则设置断点
bp = target.BreakpointCreateBySourceRegex("pattern", "main.c")

# 按地址设置断点
bp = target.BreakpointCreateByAddress(0x12345678)

# 删除断点
target.BreakpointDelete(bp.GetID())

# 删除所有断点
target.DeleteAllBreakpoints()

# 获取所有断点
for i in range(target.GetNumBreakpoints()):
    bp = target.GetBreakpointAtIndex(i)
```

### 启动进程

```python
import os

# 简单启动
process = target.LaunchSimple(
    None,           # argv
    None,           # envp
    os.getcwd()     # working directory
)

# 使用 SBLaunchInfo 启动（更多控制）
launch_info = lldb.SBLaunchInfo(["--arg1", "--arg2"])
launch_info.SetWorkingDirectory("/custom/dir")
launch_info.SetLaunchFlags(lldb.eLaunchFlagStopAtEntry)

error = lldb.SBError()
process = target.Launch(launch_info, error)
```

### 附加到进程

```python
# 按 PID 附加
listener = lldb.SBListener("my_listener")
error = lldb.SBError()
process = target.AttachToProcessWithID(listener, pid, error)

# 按名称附加（等待启动）
process = target.AttachToProcessWithName(
    listener,
    "process_name",
    True,  # wait_for_process
    error
)
```

### 加载 Core Dump

```python
error = lldb.SBError()
process = target.LoadCore("/path/to/core.dump", error)
```

### 表达式求值

```python
# 在目标上下文求值
result = target.EvaluateExpression("variable + 1")

# 使用选项求值
options = lldb.SBExpressionOptions()
options.SetTimeoutInMicroseconds(5000000)  # 5秒超时
result = target.EvaluateExpression("complex_expr", options)
```

### 获取目标信息

```python
# 可执行文件路径
exe_spec = target.GetExecutable()
print(exe_spec.fullpath)

# 架构三元组
triple = target.GetTriple()  # e.g., "x86_64-apple-macosx"

# 模块数量
num_modules = target.GetNumModules()
```

## SBProcess

代表被调试的进程。

### 进程控制

```python
# 继续执行
error = process.Continue()

# 停止执行
error = process.Stop()

# 终止进程
error = process.Kill()

# 分离进程（保持运行）
error = process.Detach()

# 分离并保持停止状态
error = process.Detach(True)
```

### 获取进程状态

```python
# 获取状态
state = process.GetState()

# 状态常量
lldb.eStateInvalid     # 无效
lldb.eStateUnloaded    # 未加载
lldb.eStateConnected   # 已连接
lldb.eStateAttaching   # 正在附加
lldb.eStateLaunching   # 正在启动
lldb.eStateStopped     # 已停止
lldb.eStateRunning     # 运行中
lldb.eStateStepping    # 单步中
lldb.eStateCrashed     # 已崩溃
lldb.eStateDetached    # 已分离
lldb.eStateExited      # 已退出
lldb.eStateSuspended   # 已挂起

# 转换为字符串
state_str = lldb.SBDebugger.StateAsCString(state)

# 获取退出状态
exit_status = process.GetExitStatus()
exit_desc = process.GetExitDescription()

# 获取 PID
pid = process.GetProcessID()
```

### 线程管理

```python
# 获取线程数量
num_threads = process.GetNumThreads()

# 按索引获取线程
thread = process.GetThreadAtIndex(0)

# 按 ID 获取线程
thread = process.GetThreadByID(thread_id)

# 按索引 ID 获取线程
thread = process.GetThreadByIndexID(index_id)

# 获取选中的线程
selected_thread = process.GetSelectedThread()

# 设置选中的线程
process.SetSelectedThread(thread)
process.SetSelectedThreadByID(thread_id)
process.SetSelectedThreadByIndexID(index_id)

# 迭代所有线程
for thread in process:
    print(thread)
```

### I/O 操作

```python
# 写入 stdin
process.PutSTDIN(b"input data\n")

# 读取 stdout
buffer = bytearray(1024)
bytes_read = process.GetSTDOUT(buffer, len(buffer))

# 读取 stderr
bytes_read = process.GetSTDERR(buffer, len(buffer))
```

## SBThread

代表进程中的一个线程。

### 线程信息

```python
# 线程 ID
tid = thread.GetThreadID()

# 线程名称
name = thread.GetName()

# 线程索引 ID
index_id = thread.GetIndexID()

# 线程状态
state = thread.GetState()

# 停止原因
stop_reason = thread.GetStopReason()

# 停止原因常量
lldb.eStopReasonInvalid      # 无效
lldb.eStopReasonNone         # 无
lldb.eStopReasonTrace        # 跟踪
lldb.eStopReasonBreakpoint   # 断点
lldb.eStopReasonWatchpoint   # 观察点
lldb.eStopReasonSignal       # 信号
lldb.eStopReasonException    # 异常
lldb.eStopReasonExec         # exec
lldb.eStopReasonPlanComplete # 计划完成
lldb.eStopReasonThreadExiting # 线程退出

# 停止描述
desc = thread.GetStopDescription(256)  # max length

# 栈帧数量
num_frames = thread.GetNumFrames()
```

### 执行控制

```python
# 单步进入
thread.StepInto()

# 单步进入（带选项）
thread.StepInto(lldb.eOnlyDuringStepping)

# 单步跳过
thread.StepOver()

# 单步跳出
thread.StepOut()

# 挂起线程
thread.Suspend()

# 恢复线程
thread.Resume()
```

### 栈帧访问

```python
# 按索引获取栈帧
frame = thread.GetFrameAtIndex(0)

# 迭代所有栈帧
for frame in thread:
    print(frame)

# 获取选中的栈帧
selected_frame = thread.GetSelectedFrame()

# 设置选中的栈帧
thread.SetSelectedFrame(0)
```

### 批量获取信息

```python
# 获取所有地址
addrs = thread.GetAddresses()

# 获取所有模块
mods = thread.GetModules()

# 获取所有符号
symbols = thread.GetSymbols()

# 获取所有文件名
files = thread.GetFileNames()

# 获取所有行号
lines = thread.GetLineNumbers()

# 获取所有函数名
funcs = thread.GetFunctionNames()
```

## SBFrame

代表线程中的一个栈帧。

### 栈帧信息

```python
# 栈帧索引
index = frame.GetFrameID()

# PC 地址
pc_addr = frame.GetPCAddress()
pc = frame.GetPC()  # 直接获取值

# 函数
function = frame.GetFunction()
func_name = frame.GetFunctionName()

# 符号（无调试信息时）
symbol = frame.GetSymbol()

# 模块
module = frame.GetModule()
module_name = module.GetFileSpec().GetFilename()

# 行号信息
line_entry = frame.GetLineEntry()
file_spec = line_entry.GetFileSpec()
file_name = file_spec.filename
full_path = file_spec.fullpath
line_num = line_entry.GetLine()
column = line_entry.GetColumn()

# 是否为内联帧
is_inlined = frame.IsInlined()

# 所属线程
thread = frame.GetThread()
```

### 变量访问

```python
# 获取所有变量
all_vars = frame.GetVariables(
    True,  # arguments
    True,  # locals
    True,  # statics
    True   # in_scope_only
)

# 获取参数
args = frame.GetArguments()
for i in range(frame.GetNumArguments()):
    arg = frame.GetArgumentAtIndex(i)

# 获取局部变量
locals = frame.GetLocals()
for i in range(frame.GetNumVariables()):
    var = frame.GetVariableAtIndex(i)

# 按名称查找变量
var = frame.FindVariable("my_var")

# 考虑动态类型查找
var = frame.FindVariable("my_var", lldb.eDynamicCanLoad)

# 按路径获取变量
var = frame.GetValueForVariablePath("obj->field")
var = frame.GetValueForVariablePath("array[0]")
```

### 表达式求值

```python
# 在栈帧上下文求值
result = frame.EvaluateExpression("x + y")

# 使用选项求值
options = lldb.SBExpressionOptions()
result = frame.EvaluateExpression("expr", options)
```

### 寄存器访问

```python
# 获取寄存器组
register_sets = frame.GetRegisters()
for reg_set in register_sets:
    print(f"{reg_set.GetName()}:")
    for i in range(reg_set.GetNumChildren()):
        reg = reg_set.GetChildAtIndex(i)
        print(f"  {reg.GetName()} = {reg.GetValue()}")
```

## SBValue

代表一个值（变量、寄存器、表达式结果）。

### 值信息

```python
# 名称
name = value.GetName()

# 类型
type_obj = value.GetType()
type_name = type_obj.GetName()

# 值字符串
val_str = value.GetValue()

# 摘要（用于容器等复杂类型）
summary = value.GetSummary()

# 错误信息（如果求值失败）
error = value.GetError()
if error.Fail():
    print(error.GetCString())
```

### 类型检查

```python
type_obj = value.GetType()

# 基本类型检查
is_pointer = type_obj.IsPointerType()
is_array = type_obj.IsArrayType()
is_struct = type_obj.IsStructType()
is_reference = type_obj.IsReferenceType()
is_typedef = type_obj.IsTypedefType()

# 基本类型
basic_type = type_obj.GetBasicType()
lldb.eBasicTypeInvalid
lldb.eBasicTypeInt
lldb.eBasicTypeFloat
lldb.eBasicTypeDouble
lldb.eBasicTypeChar
# ... 更多类型
```

### 数值获取

```python
# 作为有符号整数
int_val = value.GetValueAsSigned()

# 作为无符号整数
uint_val = value.GetValueAsUnsigned()

# 作为布尔值
bool_val = value.GetValueAsBoolean()

# 作为浮点数
float_val = value.GetValueAsDouble()
```

### 子元素访问

```python
# 子元素数量
num_children = value.GetNumChildren()

# 按索引访问子元素
child = value.GetChildAtIndex(0)

# 按名称访问子元素
child = value.GetChildMemberWithName("field_name")

# 迭代所有子元素
for child in value:
    print(f"{child.GetName()} = {child.GetValue()}")

# 指针解引用
if value.GetType().IsPointerType():
    deref = value.Dereference()
```

### 地址获取

```python
# 获取地址
addr = value.GetAddress()
load_addr = value.GetLoadAddress()

# 获取数据
data = value.GetData()
```

## SBBreakpoint

代表一个断点。

### 断点信息

```python
# 断点 ID
bp_id = bp.GetID()

# 是否有效
is_valid = bp.IsValid()

# 是否启用
is_enabled = bp.IsEnabled()

# 启用/禁用
bp.SetEnabled(True)
bp.SetEnabled(False)

# 命中次数
hit_count = bp.GetHitCount()

# 忽略次数
ignore_count = bp.GetIgnoreCount()
bp.SetIgnoreCount(5)

# 条件
condition = bp.GetCondition()
bp.SetCondition("x > 10")

# 是否为一次性断点
is_one_shot = bp.IsOneShot()
bp.SetOneShot(True)

# 自动继续
auto_continue = bp.GetAutoContinue()
bp.SetAutoContinue(True)
```

### 断点位置

```python
# 位置数量
num_locations = bp.GetNumLocations()

# 获取位置
location = bp.GetLocationAtIndex(0)

# 位置信息
loc_id = location.GetID()
loc_addr = location.GetAddress()
loc_enabled = location.IsEnabled()
```

### 线程过滤

```python
# 按线程 ID
bp.SetThreadID(thread_id)

# 按线程索引
bp.SetThreadIndex(index)

# 按线程名称
bp.SetThreadName("WorkerThread")

# 按队列名称 (macOS/iOS)
bp.SetQueueName("com.example.queue")
```

### 回调

```python
# 设置 Python 回调
bp.SetScriptCallbackFunction("my_module.callback_function")

# 设置回调代码
bp.SetScriptCallbackBody("print('Breakpoint hit!')")

# 设置命令行命令
bp.SetCommandLineCommands(["frame variable", "continue"])
```

## SBEvent

代表调试事件。

### 事件处理

```python
# 创建监听器
listener = lldb.SBListener("my_listener")

# 获取广播器
broadcaster = process.GetBroadcaster()

# 添加监听器
broadcaster.AddListener(
    listener,
    lldb.SBProcess.eBroadcastBitStateChanged
)

# 等待事件
event = lldb.SBEvent()
if listener.WaitForEvent(timeout, event):
    # 处理事件
    pass

# 等待特定类型事件
if listener.WaitForEventForBroadcasterWithType(
    timeout,
    broadcaster,
    lldb.SBProcess.eBroadcastBitStateChanged,
    event
):
    # 处理事件
    pass
```

### 事件信息

```python
# 事件类型
event_type = event.GetType()

# 数据类型
data_flavor = event.GetDataFlavor()

# 获取描述
desc = event.GetDescription()

# 从事件获取进程状态
state = lldb.SBProcess.GetStateFromEvent(event)

# 检查是否重启
restarted = lldb.SBProcess.GetRestartedFromEvent(event)

# 从事件获取进程
process = lldb.SBProcess.GetProcessFromEvent(event)
```

## 常用代码模式

### 打印调用栈

```python
def print_stacktrace(thread, target):
    """Print stack trace for a thread"""
    for i in range(thread.GetNumFrames()):
        frame = thread.GetFrameAtIndex(i)
        function = frame.GetFunction()
        
        load_addr = frame.GetPCAddress().GetLoadAddress(target)
        mod_name = frame.GetModule().GetFileSpec().GetFilename()
        
        if function:
            # 有调试信息
            func_name = frame.GetFunctionName()
            file_name = frame.GetLineEntry().GetFileSpec().GetFilename()
            line_num = frame.GetLineEntry().GetLine()
            print(f"  frame #{i}: {load_addr:#016x} {mod_name}`{func_name} at {file_name}:{line_num}")
        else:
            # 无调试信息，使用符号
            symbol = frame.GetSymbol()
            if symbol:
                symbol_name = symbol.GetName()
                print(f"  frame #{i}: {load_addr:#016x} {mod_name}`{symbol_name}")
```

### 等待断点命中

```python
def wait_for_breakpoint(process, timeout=30):
    """Wait for process to stop at breakpoint"""
    import time
    start = time.time()
    
    while time.time() - start < timeout:
        state = process.GetState()
        
        if state == lldb.eStateStopped:
            for i in range(process.GetNumThreads()):
                thread = process.GetThreadAtIndex(i)
                if thread.GetStopReason() == lldb.eStopReasonBreakpoint:
                    return thread
        
        elif state == lldb.eStateExited:
            return None
        
        time.sleep(0.1)
    
    return None
```

### 获取变量值

```python
def get_variable_value(frame, var_name):
    """Get variable value as string"""
    var = frame.FindVariable(var_name)
    if not var.IsValid():
        return None
    
    # 尝试获取摘要（用于容器）
    summary = var.GetSummary()
    if summary:
        return summary
    
    # 获取值
    value = var.GetValue()
    if value:
        return value
    
    # 复杂类型，显示类型名
    return f"<{var.GetType().GetName()}>"
```

## 参考链接

- [LLDB Python API 官方文档](https://lldb.llvm.org/python_api)
- [LLDB Python Reference](https://lldb.llvm.org/python_reference)
- [LLDB Tutorial](https://lldb.llvm.org/use/tutorial)
