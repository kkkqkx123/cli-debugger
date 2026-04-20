# LLDB Python API 示例代码

本文档包含实现 `cli-debugger` LLDB 协议所需的实用代码示例。

## 基础调试会话

### 完整的调试流程示例

```python
import lldb
import os

def debug_session(exe_path, break_func="main"):
    """Complete debug session example"""
    
    # 1. 创建调试器
    debugger = lldb.SBDebugger.Create()
    debugger.SetAsync(False)  # 同步模式
    
    # 2. 创建目标
    target = debugger.CreateTargetWithFileAndArch(
        exe_path,
        lldb.LLDB_ARCH_DEFAULT
    )
    
    if not target:
        print(f"Failed to create target for {exe_path}")
        return
    
    # 3. 设置断点
    breakpoint = target.BreakpointCreateByName(
        break_func,
        target.GetExecutable().GetFilename()
    )
    print(f"Breakpoint created: {breakpoint}")
    
    # 4. 启动进程
    process = target.LaunchSimple(None, None, os.getcwd())
    
    if not process:
        print("Failed to launch process")
        return
    
    # 5. 检查状态
    state = process.GetState()
    print(f"Process state: {debugger.StateAsCString(state)}")
    
    if state == lldb.eStateStopped:
        # 6. 获取线程
        thread = process.GetThreadAtIndex(0)
        print(f"Thread: {thread}")
        
        # 7. 获取栈帧
        frame = thread.GetFrameAtIndex(0)
        print(f"Frame: {frame}")
        
        # 8. 打印调用栈
        print("\nBacktrace:")
        for i in range(thread.GetNumFrames()):
            f = thread.GetFrameAtIndex(i)
            print(f"  #{i}: {f.GetFunctionName()} at {f.GetLineEntry().GetFileSpec().filename}:{f.GetLineEntry().GetLine()}")
        
        # 9. 打印局部变量
        print("\nLocal variables:")
        for i in range(frame.GetNumVariables()):
            var = frame.GetVariableAtIndex(i)
            print(f"  {var.GetName()} = {var.GetValue()}")
        
        # 10. 继续执行
        process.Continue()
    
    # 11. 清理
    process.Kill()
    debugger.DeleteTarget(target)
    lldb.SBDebugger.Destroy(debugger)
```

## 线程操作

### 获取所有线程信息

```python
def get_threads_info(process):
    """Get information about all threads"""
    threads = []
    
    for i in range(process.GetNumThreads()):
        thread = process.GetThreadAtIndex(i)
        
        # 获取停止原因描述
        stop_desc = thread.GetStopDescription(256)
        
        threads.append({
            'id': thread.GetThreadID(),
            'index_id': thread.GetIndexID(),
            'name': thread.GetName() or f'thread-{thread.GetThreadID()}',
            'state': get_state_string(thread.GetState()),
            'stop_reason': get_stop_reason_string(thread.GetStopReason()),
            'stop_description': stop_desc,
            'num_frames': thread.GetNumFrames(),
        })
    
    return threads

def get_state_string(state):
    """Convert state enum to string"""
    state_map = {
        lldb.eStateInvalid: 'invalid',
        lldb.eStateUnloaded: 'unloaded',
        lldb.eStateConnected: 'connected',
        lldb.eStateAttaching: 'attaching',
        lldb.eStateLaunching: 'launching',
        lldb.eStateStopped: 'stopped',
        lldb.eStateRunning: 'running',
        lldb.eStateStepping: 'stepping',
        lldb.eStateCrashed: 'crashed',
        lldb.eStateDetached: 'detached',
        lldb.eStateExited: 'exited',
        lldb.eStateSuspended: 'suspended',
    }
    return state_map.get(state, 'unknown')

def get_stop_reason_string(reason):
    """Convert stop reason enum to string"""
    reason_map = {
        lldb.eStopReasonInvalid: 'invalid',
        lldb.eStopReasonNone: 'none',
        lldb.eStopReasonTrace: 'trace',
        lldb.eStopReasonBreakpoint: 'breakpoint',
        lldb.eStopReasonWatchpoint: 'watchpoint',
        lldb.eStopReasonSignal: 'signal',
        lldb.eStopReasonException: 'exception',
        lldb.eStopReasonExec: 'exec',
        lldb.eStopReasonPlanComplete: 'planComplete',
        lldb.eStopReasonThreadExiting: 'threadExiting',
    }
    return reason_map.get(reason, 'unknown')
```

### 按名称查找线程

```python
def find_thread_by_name(process, name):
    """Find thread by name"""
    for i in range(process.GetNumThreads()):
        thread = process.GetThreadAtIndex(i)
        if thread.GetName() == name:
            return thread
    return None

def find_thread_by_id(process, tid):
    """Find thread by thread ID"""
    return process.GetThreadByID(tid)
```

## 栈帧操作

### 获取调用栈

```python
def get_stacktrace(thread, target, max_depth=50):
    """Get stack trace for a thread"""
    frames = []
    depth = min(thread.GetNumFrames(), max_depth)
    
    for i in range(depth):
        frame = thread.GetFrameAtIndex(i)
        
        # 获取地址
        pc_addr = frame.GetPCAddress()
        load_addr = pc_addr.GetLoadAddress(target)
        
        # 获取模块名
        module = frame.GetModule()
        mod_name = module.GetFileSpec().GetFilename() if module else None
        
        # 获取函数信息
        function = frame.GetFunction()
        
        if function:
            # 有调试信息
            func_name = frame.GetFunctionName()
            line_entry = frame.GetLineEntry()
            file_spec = line_entry.GetFileSpec()
            
            frames.append({
                'index': i,
                'address': load_addr,
                'module': mod_name,
                'function': func_name,
                'file': file_spec.fullpath if file_spec else None,
                'line': line_entry.GetLine(),
                'column': line_entry.GetColumn(),
                'is_inlined': frame.IsInlined(),
            })
        else:
            # 无调试信息，使用符号
            symbol = frame.GetSymbol()
            if symbol:
                symbol_name = symbol.GetName()
                file_addr = pc_addr.GetFileAddress()
                start_addr = symbol.GetStartAddress().GetFileAddress()
                offset = file_addr - start_addr
                
                frames.append({
                    'index': i,
                    'address': load_addr,
                    'module': mod_name,
                    'symbol': symbol_name,
                    'offset': offset,
                    'is_inlined': False,
                })
            else:
                frames.append({
                    'index': i,
                    'address': load_addr,
                    'module': mod_name,
                    'function': '<unknown>',
                    'is_inlined': False,
                })
    
    return frames
```

### 格式化栈帧输出

```python
def format_frame(frame_info, target):
    """Format a frame for display"""
    idx = frame_info['index']
    addr = frame_info['address']
    mod = frame_info.get('module', '??')
    
    if 'function' in frame_info:
        func = frame_info['function']
        if frame_info.get('is_inlined'):
            func = f"{func} [inlined]"
        
        if frame_info.get('file'):
            file_name = os.path.basename(frame_info['file'])
            line = frame_info['line']
            return f"  frame #{idx}: {addr:#016x} {mod}`{func} at {file_name}:{line}"
        else:
            return f"  frame #{idx}: {addr:#016x} {mod}`{func}"
    
    elif 'symbol' in frame_info:
        sym = frame_info['symbol']
        offset = frame_info['offset']
        return f"  frame #{idx}: {addr:#016x} {mod}`{sym} + {offset}"
    
    else:
        return f"  frame #{idx}: {addr:#016x}"
```

## 变量操作

### 获取局部变量

```python
def get_local_variables(frame):
    """Get all local variables in a frame"""
    variables = []
    
    # 获取参数
    for i in range(frame.GetNumArguments()):
        arg = frame.GetArgumentAtIndex(i)
        if arg.IsValid():
            variables.append(variable_to_dict(arg, 'arg'))
    
    # 获取局部变量
    for i in range(frame.GetNumVariables()):
        var = frame.GetVariableAtIndex(i)
        if var.IsValid():
            variables.append(variable_to_dict(var, 'local'))
    
    return variables

def variable_to_dict(value, kind):
    """Convert SBValue to dictionary"""
    type_obj = value.GetType()
    
    # 获取值字符串
    val_str = get_value_string(value)
    
    return {
        'name': value.GetName() or '<anonymous>',
        'type': type_obj.GetName() or '<unknown>',
        'value': val_str,
        'kind': kind,
        'is_pointer': type_obj.IsPointerType(),
        'is_array': type_obj.IsArrayType(),
        'is_struct': type_obj.IsStructType(),
        'num_children': value.GetNumChildren(),
        'is_nil': is_nil(value),
    }

def get_value_string(value):
    """Get value as display string"""
    # 尝试获取摘要（用于容器等）
    summary = value.GetSummary()
    if summary:
        return summary
    
    # 获取值
    val = value.GetValue()
    if val:
        return val
    
    # 复杂类型
    return f"<{value.GetType().GetName()}>"

def is_nil(value):
    """Check if value is nil/null"""
    type_obj = value.GetType()
    
    if type_obj.IsPointerType():
        return value.GetValueAsUnsigned() == 0
    
    # 检查是否为 None/nil
    val = value.GetValue()
    if val in ('nil', 'None', 'NULL', '0x0'):
        return True
    
    return False
```

### 获取对象字段

```python
def get_object_fields(value):
    """Get fields of an object/struct"""
    fields = []
    
    for i in range(value.GetNumChildren()):
        child = value.GetChildAtIndex(i)
        if child.IsValid():
            fields.append(variable_to_dict(child, 'field'))
    
    return fields

def get_field_by_name(value, field_name):
    """Get a specific field by name"""
    return value.GetChildMemberWithName(field_name)
```

### 表达式求值

```python
def evaluate_expression(frame, expr, timeout_usec=5000000):
    """Evaluate an expression in frame context"""
    options = lldb.SBExpressionOptions()
    options.SetTimeoutInMicroseconds(timeout_usec)
    options.SetTrapExceptions(False)
    
    result = frame.EvaluateExpression(expr, options)
    
    if result.GetError().Success():
        return variable_to_dict(result, 'result')
    else:
        return {
            'error': True,
            'message': result.GetError().GetCString(),
        }
```

## 断点操作

### 创建断点

```python
def create_breakpoint(target, location, condition=None, ignore_count=0):
    """Create a breakpoint at the specified location"""
    
    # 解析位置
    if ':' in location:
        # 文件:行号 格式
        parts = location.rsplit(':', 1)
        if parts[1].isdigit():
            file_name = parts[0]
            line_num = int(parts[1])
            bp = target.BreakpointCreateByLocation(file_name, line_num)
        else:
            # 可能是类:方法
            bp = target.BreakpointCreateByName(location)
    else:
        # 函数名
        bp = target.BreakpointCreateByName(location)
    
    if not bp.IsValid():
        return None
    
    # 设置条件
    if condition:
        bp.SetCondition(condition)
    
    # 设置忽略次数
    if ignore_count > 0:
        bp.SetIgnoreCount(ignore_count)
    
    return {
        'id': bp.GetID(),
        'num_locations': bp.GetNumLocations(),
        'enabled': bp.IsEnabled(),
    }
```

### 获取断点列表

```python
def get_breakpoints(target):
    """Get all breakpoints"""
    breakpoints = []
    
    for i in range(target.GetNumBreakpoints()):
        bp = target.GetBreakpointAtIndex(i)
        
        if not bp.IsValid():
            continue
        
        # 获取位置信息
        locations = []
        for j in range(bp.GetNumLocations()):
            loc = bp.GetLocationAtIndex(j)
            if loc.IsValid():
                addr = loc.GetAddress()
                line_entry = addr.GetLineEntry()
                if line_entry:
                    file_spec = line_entry.GetFileSpec()
                    locations.append({
                        'id': loc.GetID(),
                        'file': file_spec.fullpath,
                        'line': line_entry.GetLine(),
                        'address': addr.GetLoadAddress(target),
                    })
        
        breakpoints.append({
            'id': bp.GetID(),
            'enabled': bp.IsEnabled(),
            'hit_count': bp.GetHitCount(),
            'ignore_count': bp.GetIgnoreCount(),
            'condition': bp.GetCondition(),
            'one_shot': bp.IsOneShot(),
            'locations': locations,
        })
    
    return breakpoints
```

### 断点控制

```python
def toggle_breakpoint(target, bp_id, enable):
    """Enable or disable a breakpoint"""
    bp = target.FindBreakpointByID(bp_id)
    if bp.IsValid():
        bp.SetEnabled(enable)
        return True
    return False

def delete_breakpoint(target, bp_id):
    """Delete a breakpoint"""
    return target.BreakpointDelete(bp_id)

def clear_all_breakpoints(target):
    """Clear all breakpoints"""
    target.DeleteAllBreakpoints()
```

## 进程控制

### 执行控制

```python
def continue_process(process):
    """Continue process execution"""
    error = process.Continue()
    return error.Success()

def stop_process(process):
    """Stop process execution"""
    error = process.Stop()
    return error.Success()

def kill_process(process):
    """Kill the process"""
    error = process.Kill()
    return error.Success()

def detach_process(process, keep_stopped=False):
    """Detach from the process"""
    error = process.Detach(keep_stopped)
    return error.Success()
```

### 单步执行

```python
def step_into(thread):
    """Step into function"""
    thread.StepInto()
    return True

def step_over(thread):
    """Step over current line"""
    thread.StepOver()
    return True

def step_out(thread):
    """Step out of current function"""
    thread.StepOut()
    return True

def run_to_location(thread, target, file_name, line_num):
    """Run until reaching specified location"""
    # 创建临时断点
    bp = target.BreakpointCreateByLocation(file_name, line_num)
    bp.SetOneShot(True)  # 命中后自动删除
    
    # 继续
    thread.GetProcess().Continue()
```

## 事件处理

### 等待事件

```python
def wait_for_event(listener, broadcaster, timeout_sec=30):
    """Wait for a state change event"""
    event = lldb.SBEvent()
    
    if listener.WaitForEventForBroadcasterWithType(
        timeout_sec,
        broadcaster,
        lldb.SBProcess.eBroadcastBitStateChanged,
        event
    ):
        return event
    
    return None

def process_event(event, process):
    """Process an event and return info"""
    state = lldb.SBProcess.GetStateFromEvent(event)
    
    info = {
        'type': 'state_change',
        'state': get_state_string(state),
        'restarted': lldb.SBProcess.GetRestartedFromEvent(event),
    }
    
    if state == lldb.eStateStopped:
        # 找到停止的线程
        for i in range(process.GetNumThreads()):
            thread = process.GetThreadAtIndex(i)
            if thread.GetStopReason() != lldb.eStopReasonNone:
                info['stopped_thread'] = {
                    'id': thread.GetThreadID(),
                    'stop_reason': get_stop_reason_string(thread.GetStopReason()),
                    'stop_description': thread.GetStopDescription(256),
                }
                break
    
    return info
```

### 设置事件监听

```python
def setup_event_listener(process):
    """Setup event listener for a process"""
    listener = lldb.SBListener("process_listener")
    broadcaster = process.GetBroadcaster()
    
    # 监听状态变化
    broadcaster.AddListener(
        listener,
        lldb.SBProcess.eBroadcastBitStateChanged
    )
    
    return listener, broadcaster
```

## Core Dump 分析

```python
def analyze_core_dump(debugger, exe_path, core_path):
    """Analyze a core dump file"""
    # 创建目标
    target = debugger.CreateTargetWithFileAndArch(
        exe_path,
        lldb.LLDB_ARCH_DEFAULT
    )
    
    if not target:
        return None, "Failed to create target"
    
    # 加载 core dump
    error = lldb.SBError()
    process = target.LoadCore(core_path, error)
    
    if error.Fail():
        return None, error.GetCString()
    
    # 获取崩溃线程
    crashed_thread = None
    for i in range(process.GetNumThreads()):
        thread = process.GetThreadAtIndex(i)
        if thread.GetStopReason() == lldb.eStopReasonSignal or \
           thread.GetState() == lldb.eStateCrashed:
            crashed_thread = thread
            break
    
    result = {
        'process_id': process.GetProcessID(),
        'state': get_state_string(process.GetState()),
        'num_threads': process.GetNumThreads(),
        'crashed_thread_id': crashed_thread.GetThreadID() if crashed_thread else None,
    }
    
    if crashed_thread:
        result['crashed_stack'] = get_stacktrace(crashed_thread, target)
    
    return result, None
```

## 附加到运行中的进程

```python
def attach_to_process(debugger, target, pid, listener=None):
    """Attach to a running process by PID"""
    if listener is None:
        listener = lldb.SBListener("attach_listener")
    
    error = lldb.SBError()
    process = target.AttachToProcessWithID(listener, pid, error)
    
    if error.Fail():
        return None, error.GetCString()
    
    return process, None

def wait_for_process_by_name(debugger, target, process_name, listener=None):
    """Wait for a process to launch and attach"""
    if listener is None:
        listener = lldb.SBListener("wait_listener")
    
    error = lldb.SBError()
    process = target.AttachToProcessWithName(
        listener,
        process_name,
        True,  # wait_for_process
        error
    )
    
    if error.Fail():
        return None, error.GetCString()
    
    return process, None
```

## 寄存器访问

```python
def get_registers(frame):
    """Get all registers for a frame"""
    register_sets = frame.GetRegisters()
    result = []
    
    for i in range(register_sets.GetSize()):
        reg_set = register_sets.GetValueAtIndex(i)
        set_info = {
            'name': reg_set.GetName(),
            'registers': []
        }
        
        for j in range(reg_set.GetNumChildren()):
            reg = reg_set.GetChildAtIndex(j)
            set_info['registers'].append({
                'name': reg.GetName(),
                'value': reg.GetValue(),
                'type': reg.GetType().GetName(),
            })
        
        result.append(set_info)
    
    return result
```

## 内存读取

```python
def read_memory(process, address, size):
    """Read memory at address"""
    error = lldb.SBError()
    buffer = process.ReadMemory(address, size, error)
    
    if error.Fail():
        return None, error.GetCString()
    
    return buffer, None

def write_memory(process, address, data):
    """Write data to memory"""
    error = lldb.SBError()
    bytes_written = process.WriteMemory(address, data, error)
    
    if error.Fail():
        return 0, error.GetCString()
    
    return bytes_written, None
```
