# Python 桥接脚本详细设计

## 概述

`lldb_bridge.py` 是 LLDB 协议实现的核心组件，负责：
- 接收来自 TypeScript 的 JSON 命令
- 调用 LLDB Python API 执行调试操作
- 返回 JSON 格式的结果

## 文件位置

```
src/protocol/lldb/scripts/lldb_bridge.py
```

## 完整实现

```python
#!/usr/bin/env python3
"""
LLDB Bridge Script
Provides JSON-RPC interface to LLDB Python API for cli-debugger

Usage:
    python3 lldb_bridge.py

Protocol:
    - Input: JSON-RPC request from stdin (one per line)
    - Output: JSON-RPC response to stdout (one per line)
"""

import lldb
import json
import sys
import os
from typing import Any, Dict, List, Optional, Union


class LLDBError(Exception):
    """Custom error for LLDB operations"""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class LLDBBridge:
    """Bridge between JSON-RPC and LLDB Python API"""

    def __init__(self):
        self.debugger: Optional[lldb.SBDebugger] = None
        self.target: Optional[lldb.SBTarget] = None
        self.process: Optional[lldb.SBProcess] = None
        self.listener: Optional[lldb.SBListener] = None
        self.breakpoint_map: Dict[str, lldb.SBBreakpoint] = {}
        self._initialized = False

    def _ensure_initialized(self) -> None:
        """Ensure debugger is initialized"""
        if not self._initialized:
            self.debugger = lldb.SBDebugger.Create()
            self.debugger.SetAsync(False)  # Synchronous mode by default
            self.listener = lldb.SBListener("bridge_listener")
            self._initialized = True

    def _ensure_target(self) -> lldb.SBTarget:
        """Ensure target exists"""
        if not self.target:
            raise LLDBError("NO_TARGET", "No target loaded")
        return self.target

    def _ensure_process(self) -> lldb.SBProcess:
        """Ensure process exists and is valid"""
        if not self.process or not self.process.IsValid():
            raise LLDBError("NO_PROCESS", "No process running")
        return self.process

    def _get_thread_by_id(self, thread_id: Union[str, int]) -> lldb.SBThread:
        """Get thread by ID"""
        process = self._ensure_process()
        tid = int(thread_id)

        for i in range(process.GetNumThreads()):
            thread = process.GetThreadAtIndex(i)
            if thread.GetThreadID() == tid:
                return thread

        raise LLDBError("THREAD_NOT_FOUND", f"Thread {thread_id} not found")

    # ==================== Connection Methods ====================

    def handle_connect(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Connect to debug target

        Params:
            target: Path to executable
            coreFile: Optional core dump file
            attachPid: Optional PID to attach
            waitFor: Wait for process to launch (for attach)
        """
        self._ensure_initialized()

        target_path = params.get('target')
        if not target_path:
            raise LLDBError("INVALID_INPUT", "Target path required")

        if not os.path.exists(target_path):
            raise LLDBError("TARGET_NOT_FOUND", f"Target not found: {target_path}")

        error = lldb.SBError()

        # Create target
        self.target = self.debugger.CreateTarget(
            target_path, None, None, False, error
        )

        if error.Fail():
            raise LLDBError("CREATE_TARGET_FAILED", str(error))

        core_file = params.get('coreFile')
        attach_pid = params.get('attachPid')
        wait_for = params.get('waitFor', False)

        if core_file:
            # Load core dump
            self.process = self.target.LoadCore(core_file, error)
            if error.Fail():
                raise LLDBError("LOAD_CORE_FAILED", str(error))
        elif attach_pid:
            # Attach to running process
            self.process = self.target.AttachToProcessWithID(
                self.listener, attach_pid, error
            )
            if error.Fail():
                raise LLDBError("ATTACH_FAILED", str(error))
        elif wait_for:
            # Wait for process to launch
            self.process = self.target.AttachToProcessWithName(
                self.listener, os.path.basename(target_path), True, error
            )
            if error.Fail():
                raise LLDBError("WAIT_FOR_PROCESS_FAILED", str(error))

        return {
            'success': True,
            'targetId': str(self.target.GetFileSpec()),
            'triple': self.target.GetTriple(),
        }

    def handle_disconnect(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Disconnect from debug target"""
        if self.process:
            # Detach or kill process
            keep_alive = params.get('keepAlive', False)
            if keep_alive:
                self.process.Detach()
            else:
                self.process.Kill()
            self.process = None

        if self.target:
            self.debugger.DeleteTarget(self.target)
            self.target = None

        self.breakpoint_map.clear()
        return {'success': True}

    def handle_launch(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Launch the target process

        Params:
            args: List of arguments
            env: Environment variables
            stopAtEntry: Stop at program entry
            workingDir: Working directory
        """
        target = self._ensure_target()

        args = params.get('args', [])
        env = params.get('env', {})
        stop_at_entry = params.get('stopAtEntry', False)
        working_dir = params.get('workingDir')

        error = lldb.SBError()

        # Build launch info
        launch_info = lldb.SBLaunchInfo(args)
        launch_info.SetLaunchFlags(lldb.eLaunchFlagStopAtEntry if stop_at_entry else 0)

        if working_dir:
            launch_info.SetWorkingDirectory(working_dir)

        if env:
            env_list = [f"{k}={v}" for k, v in env.items()]
            launch_info.SetEnvironmentEntries(env_list, True)

        self.process = target.Launch(launch_info, error)

        if error.Fail():
            raise LLDBError("LAUNCH_FAILED", str(error))

        return {
            'success': True,
            'pid': self.process.GetProcessID(),
            'state': self._get_process_state(),
        }

    # ==================== Metadata Methods ====================

    def handle_version(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get LLDB version info"""
        self._ensure_initialized()
        return {
            'lldbVersion': self.debugger.GetVersionString(),
            'pythonVersion': sys.version,
        }

    def handle_capabilities(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get debugger capabilities"""
        return {
            'supportsThreads': True,
            'supportsStack': True,
            'supportsLocals': True,
            'supportsBreakpoints': True,
            'supportsSuspend': True,
            'supportsResume': True,
            'supportsStep': True,
            'supportsEvents': True,
            'supportsWatchpoints': True,
            'supportsExpressions': True,
        }

    # ==================== Thread Methods ====================

    def handle_threads(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get all threads"""
        process = self._ensure_process()

        threads = []
        for i in range(process.GetNumThreads()):
            thread = process.GetThreadAtIndex(i)
            threads.append({
                'id': thread.GetThreadID(),
                'name': thread.GetName() or f'thread-{thread.GetThreadID()}',
                'state': self._get_thread_state(thread),
                'stopReason': self._get_stop_reason(thread),
                'numFrames': thread.GetNumFrames(),
            })

        return threads

    def handle_thread_state(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get thread state"""
        thread_id = params.get('threadId')
        thread = self._get_thread_by_id(thread_id)

        return {
            'id': thread.GetThreadID(),
            'state': self._get_thread_state(thread),
            'stopReason': self._get_stop_reason(thread),
            'stopDescription': thread.GetStopDescription(256),
        }

    def _get_thread_state(self, thread: lldb.SBThread) -> str:
        """Convert LLDB state to string"""
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
            lldb.eStateResuming: 'resuming',
            lldb.eStateSuspended: 'suspended',
        }
        return state_map.get(thread.GetState(), 'unknown')

    def _get_stop_reason(self, thread: lldb.SBThread) -> str:
        """Convert LLDB stop reason to string"""
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
        return reason_map.get(thread.GetStopReason(), 'unknown')

    # ==================== Stack Methods ====================

    def handle_stack(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get call stack for a thread"""
        thread_id = params.get('threadId')
        depth = params.get('depth', 50)

        thread = self._get_thread_by_id(thread_id)

        frames = []
        num_frames = min(thread.GetNumFrames(), depth)

        for i in range(num_frames):
            frame = thread.GetFrameAtIndex(i)
            frames.append(self._frame_to_dict(frame, i))

        return frames

    def _frame_to_dict(self, frame: lldb.SBFrame, index: int) -> Dict[str, Any]:
        """Convert frame to dict"""
        line_entry = frame.GetLineEntry()
        file_spec = line_entry.GetFileSpec()

        return {
            'id': index,
            'location': f"{file_spec.filename}:{line_entry.line}" if file_spec else "<unknown>",
            'file': file_spec.fullpath if file_spec else None,
            'line': line_entry.line,
            'column': line_entry.column,
            'method': frame.GetFunctionName() or '<unknown>',
            'module': frame.GetModule().GetFileSpec().filename if frame.GetModule() else None,
            'address': frame.GetPC(),
            'isInlined': frame.IsInlined(),
        }

    # ==================== Execution Control Methods ====================

    def handle_suspend(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Suspend execution"""
        process = self._ensure_process()
        process.Stop()
        return {'success': True, 'state': self._get_process_state()}

    def handle_resume(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Resume execution"""
        thread_id = params.get('threadId')

        if thread_id:
            thread = self._get_thread_by_id(thread_id)
            thread.Resume()
        else:
            process = self._ensure_process()
            process.Continue()

        return {'success': True}

    def handle_step_into(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Step into"""
        thread_id = params.get('threadId')
        thread = self._get_thread_by_id(thread_id)
        thread.StepInto()
        return {'success': True}

    def handle_step_over(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Step over"""
        thread_id = params.get('threadId')
        thread = self._get_thread_by_id(thread_id)
        thread.StepOver()
        return {'success': True}

    def handle_step_out(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Step out"""
        thread_id = params.get('threadId')
        thread = self._get_thread_by_id(thread_id)
        thread.StepOut()
        return {'success': True}

    def _get_process_state(self) -> str:
        """Get process state string"""
        if not self.process:
            return 'none'

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
            lldb.eStateResuming: 'resuming',
            lldb.eStateSuspended: 'suspended',
        }
        return state_map.get(self.process.GetState(), 'unknown')

    # ==================== Breakpoint Methods ====================

    def handle_set_breakpoint(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Set a breakpoint"""
        target = self._ensure_target()

        location = params.get('location')
        condition = params.get('condition')
        ignore_count = params.get('ignoreCount', 0)

        if not location:
            raise LLDBError("INVALID_INPUT", "Breakpoint location required")

        # Parse location: "file:line" or "function"
        if ':' in location and location.split(':')[-1].isdigit():
            parts = location.rsplit(':', 1)
            file_name = parts[0]
            line_num = int(parts[1])
            bp = target.BreakpointCreateByLocation(file_name, line_num)
        else:
            # Function name
            bp = target.BreakpointCreateByName(location)

        if not bp.IsValid():
            raise LLDBError("BREAKPOINT_FAILED", f"Failed to create breakpoint at {location}")

        if condition:
            bp.SetCondition(condition)

        if ignore_count > 0:
            bp.SetIgnoreCount(ignore_count)

        bp_id = f"lldb_bp_{bp.GetID()}"
        self.breakpoint_map[bp_id] = bp

        return {
            'id': bp_id,
            'internalId': bp.GetID(),
            'location': location,
            'enabled': bp.IsEnabled(),
            'hitCount': bp.GetHitCount(),
        }

    def handle_remove_breakpoint(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Remove a breakpoint"""
        target = self._ensure_target()

        bp_id = params.get('id')
        if bp_id not in self.breakpoint_map:
            raise LLDBError("BREAKPOINT_NOT_FOUND", f"Breakpoint {bp_id} not found")

        bp = self.breakpoint_map[bp_id]
        target.BreakpointDelete(bp.GetID())
        del self.breakpoint_map[bp_id]

        return {'success': True}

    def handle_clear_breakpoints(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Clear all breakpoints"""
        target = self._ensure_target()
        target.DeleteAllBreakpoints()
        self.breakpoint_map.clear()
        return {'success': True}

    def handle_breakpoints(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """List all breakpoints"""
        target = self._ensure_target()

        breakpoints = []
        for i in range(target.GetNumBreakpoints()):
            bp = target.GetBreakpointAtIndex(i)
            if bp.IsValid():
                # Get location info
                locations = []
                for j in range(bp.GetNumLocations()):
                    loc = bp.GetLocationAtIndex(j)
                    addr = loc.GetAddress()
                    line_entry = addr.GetLineEntry()
                    if line_entry:
                        file_spec = line_entry.GetFileSpec()
                        locations.append(f"{file_spec.filename}:{line_entry.line}")

                breakpoints.append({
                    'id': f"lldb_bp_{bp.GetID()}",
                    'internalId': bp.GetID(),
                    'locations': locations,
                    'enabled': bp.IsEnabled(),
                    'hitCount': bp.GetHitCount(),
                    'ignoreCount': bp.GetIgnoreCount(),
                    'condition': bp.GetCondition() or None,
                })

        return breakpoints

    # ==================== Variable Methods ====================

    def handle_locals(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get local variables"""
        thread_id = params.get('threadId')
        frame_index = params.get('frameIndex', 0)

        thread = self._get_thread_by_id(thread_id)

        if frame_index >= thread.GetNumFrames():
            raise LLDBError("FRAME_NOT_FOUND", f"Frame {frame_index} not found")

        frame = thread.GetFrameAtIndex(frame_index)
        variables = []

        # Get arguments
        for i in range(frame.GetNumArguments()):
            var = frame.GetArgumentAtIndex(i)
            variables.append(self._variable_to_dict(var, 'arg'))

        # Get local variables
        for i in range(frame.GetNumVariables()):
            var = frame.GetVariableAtIndex(i)
            variables.append(self._variable_to_dict(var, 'local'))

        return variables

    def handle_fields(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get object/struct fields"""
        thread_id = params.get('threadId')
        frame_index = params.get('frameIndex', 0)
        var_name = params.get('varName')

        thread = self._get_thread_by_id(thread_id)
        frame = thread.GetFrameAtIndex(frame_index)

        # Find the variable
        var = frame.FindVariable(var_name)
        if not var.IsValid():
            raise LLDBError("VARIABLE_NOT_FOUND", f"Variable {var_name} not found")

        # Get children (fields/elements)
        fields = []
        for i in range(var.GetNumChildren()):
            child = var.GetChildAtIndex(i)
            fields.append(self._variable_to_dict(child, 'field'))

        return fields

    def handle_eval(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate an expression"""
        expression = params.get('expression')
        thread_id = params.get('threadId')
        frame_index = params.get('frameIndex', 0)

        if not expression:
            raise LLDBError("INVALID_INPUT", "Expression required")

        if thread_id:
            thread = self._get_thread_by_id(thread_id)
            frame = thread.GetFrameAtIndex(frame_index)
            result = frame.EvaluateExpression(expression)
        else:
            target = self._ensure_target()
            result = target.EvaluateExpression(expression)

        if not result.IsValid():
            raise LLDBError("EVAL_FAILED", "Expression evaluation failed")

        return self._variable_to_dict(result, 'result')

    def _variable_to_dict(self, var: lldb.SBValue, kind: str) -> Dict[str, Any]:
        """Convert variable to dict"""
        type_obj = var.GetType()

        return {
            'name': var.GetName() or '<anonymous>',
            'type': type_obj.GetName() or '<unknown>',
            'value': self._get_value_string(var),
            'kind': kind,
            'isPointer': type_obj.IsPointerType(),
            'isArray': type_obj.IsArrayType(),
            'isStruct': type_obj.IsStructType(),
            'numChildren': var.GetNumChildren(),
            'isNil': var.GetValueAsUnsigned() == 0 if type_obj.IsPointerType() else False,
        }

    def _get_value_string(self, var: lldb.SBValue) -> str:
        """Get value as string"""
        # Try to get summary first (for containers, etc.)
        summary = var.GetSummary()
        if summary:
            return summary

        # Get value
        value = var.GetValue()
        if value:
            return value

        # For complex types, show type name
        return f"<{var.GetType().GetName()}>"

    # ==================== Event Methods ====================

    def handle_wait_for_event(self, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Wait for a debug event"""
        timeout = params.get('timeout', 30)

        process = self._ensure_process()

        # Use listener to wait for event
        event = lldb.SBEvent()
        if self.listener.WaitForEventForBroadcasterClassName(
            timeout, "SBProcess", event
        ):
            return self._event_to_dict(event)

        return None

    def _event_to_dict(self, event: lldb.SBEvent) -> Dict[str, Any]:
        """Convert event to dict"""
        state = lldb.SBProcess.GetStateFromEvent(event)

        return {
            'type': self._get_event_type(event),
            'state': self._get_process_state(),
            'description': event.GetDescription(),
        }

    def _get_event_type(self, event: lldb.SBEvent) -> str:
        """Get event type string"""
        if lldb.SBProcess.GetRestartedFromEvent(event):
            return 'restarted'
        if lldb.SBProcess.GetProcessFromEvent(event).GetState() == lldb.eStateCrashed:
            return 'crashed'
        if lldb.SBProcess.GetProcessFromEvent(event).GetState() == lldb.eStateStopped:
            return 'stopped'
        if lldb.SBProcess.GetProcessFromEvent(event).GetState() == lldb.eStateExited:
            return 'exited'
        return 'unknown'

    # ==================== Main Loop ====================

    def run(self) -> None:
        """Main loop: read JSON commands from stdin"""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                req_id = request.get('id', 0)
                method = request.get('method', '')
                params = request.get('params', {})

                handler_name = f'handle_{method}'
                handler = getattr(self, handler_name, None)

                if handler:
                    result = handler(params)
                    self._send_response(req_id, result)
                else:
                    self._send_error(req_id, 'UNKNOWN_METHOD', f'Unknown method: {method}')

            except json.JSONDecodeError as e:
                self._send_error(0, 'PARSE_ERROR', str(e))
            except LLDBError as e:
                self._send_error(request.get('id', 0), e.code, e.message)
            except Exception as e:
                self._send_error(request.get('id', 0), 'INTERNAL_ERROR', str(e))

    def _send_response(self, req_id: int, result: Any) -> None:
        """Send success response"""
        response = {'id': req_id, 'result': result}
        print(json.dumps(response), flush=True)

    def _send_error(self, req_id: int, code: str, message: str) -> None:
        """Send error response"""
        response = {
            'id': req_id,
            'error': {'code': code, 'message': message}
        }
        print(json.dumps(response), flush=True)


def main():
    """Entry point"""
    bridge = LLDBBridge()
    bridge.run()


if __name__ == '__main__':
    main()
```

## 错误码定义

| 错误码 | 说明 |
|--------|------|
| `PARSE_ERROR` | JSON 解析失败 |
| `UNKNOWN_METHOD` | 未知方法 |
| `INVALID_INPUT` | 无效输入参数 |
| `INTERNAL_ERROR` | 内部错误 |
| `NO_TARGET` | 未加载调试目标 |
| `NO_PROCESS` | 进程未运行 |
| `TARGET_NOT_FOUND` | 目标文件不存在 |
| `CREATE_TARGET_FAILED` | 创建目标失败 |
| `LOAD_CORE_FAILED` | 加载 core dump 失败 |
| `ATTACH_FAILED` | 附加进程失败 |
| `LAUNCH_FAILED` | 启动进程失败 |
| `THREAD_NOT_FOUND` | 线程不存在 |
| `FRAME_NOT_FOUND` | 栈帧不存在 |
| `BREAKPOINT_NOT_FOUND` | 断点不存在 |
| `BREAKPOINT_FAILED` | 设置断点失败 |
| `VARIABLE_NOT_FOUND` | 变量不存在 |
| `EVAL_FAILED` | 表达式求值失败 |

## 测试

```python
# test_lldb_bridge.py
import unittest
import json
from io import StringIO
from unittest.mock import patch

class TestLLDBBridge(unittest.TestCase):
    def test_handle_version(self):
        bridge = LLDBBridge()
        result = bridge.handle_version({})
        self.assertIn('lldbVersion', result)

    # ... 更多测试
```
