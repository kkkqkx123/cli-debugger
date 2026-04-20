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
from typing import Any, Dict, Optional, Union

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from utils.errors import LLDBError
from utils.converters import get_process_state
from handlers import (
    ConnectionHandler,
    MetadataHandler,
    ThreadHandler,
    StackHandler,
    ExecutionHandler,
    BreakpointHandler,
    VariableHandler,
    RegisterHandler,
    SelectionHandler,
    ProcessInfoHandler,
    ExpressionHandler,
    TargetInfoHandler,
    EventHandler,
    ModuleHandler,
    TypeHandler,
    IOHandler,
    BatchHandler,
)


class LLDBState:
    """Shared state for LLDB bridge"""

    def __init__(self):
        self.debugger: Optional[lldb.SBDebugger] = None
        self.target: Optional[lldb.SBTarget] = None
        self.process: Optional[lldb.SBProcess] = None
        self.listener: Optional[lldb.SBListener] = None
        self.breakpoint_map: Dict[str, lldb.SBBreakpoint] = {}
        self._initialized = False

    def ensure_initialized(self) -> None:
        """Ensure debugger is initialized"""
        if not self._initialized:
            self.debugger = lldb.SBDebugger.Create()
            self.debugger.SetAsync(False)  # Synchronous mode by default
            self.listener = lldb.SBListener("bridge_listener")
            self._initialized = True

    def ensure_target(self) -> lldb.SBTarget:
        """Ensure target exists"""
        if not self.target:
            raise LLDBError("NO_TARGET", "No target loaded")
        return self.target

    def ensure_process(self) -> lldb.SBProcess:
        """Ensure process exists and is valid"""
        if not self.process or not self.process.IsValid():
            raise LLDBError("NO_PROCESS", "No process running")
        return self.process

    def get_thread_by_id(self, thread_id: Union[str, int]) -> lldb.SBThread:
        """Get thread by ID"""
        process = self.ensure_process()
        tid = int(thread_id)

        for i in range(process.GetNumThreads()):
            thread = process.GetThreadAtIndex(i)
            if thread.GetThreadID() == tid:
                return thread

        raise LLDBError("THREAD_NOT_FOUND", f"Thread {thread_id} not found")

    def get_process_state(self) -> str:
        """Get process state string"""
        return get_process_state(self.process)


class LLDBBridge:
    """Bridge between JSON-RPC and LLDB Python API"""

    def __init__(self):
        self.state = LLDBState()

        # Initialize handlers
        self._handlers = {
            # Connection
            "connect": ConnectionHandler(self.state),
            "disconnect": ConnectionHandler(self.state),
            "launch": ConnectionHandler(self.state),
            # Metadata
            "version": MetadataHandler(self.state),
            "capabilities": MetadataHandler(self.state),
            # Thread
            "threads": ThreadHandler(self.state),
            "thread_state": ThreadHandler(self.state),
            # Stack
            "stack": StackHandler(self.state),
            # Execution
            "suspend": ExecutionHandler(self.state),
            "resume": ExecutionHandler(self.state),
            "step_into": ExecutionHandler(self.state),
            "step_over": ExecutionHandler(self.state),
            "step_out": ExecutionHandler(self.state),
            # Breakpoint
            "set_breakpoint": BreakpointHandler(self.state),
            "remove_breakpoint": BreakpointHandler(self.state),
            "clear_breakpoints": BreakpointHandler(self.state),
            "breakpoints": BreakpointHandler(self.state),
            "enable_breakpoint": BreakpointHandler(self.state),
            "disable_breakpoint": BreakpointHandler(self.state),
            "get_breakpoint_locations": BreakpointHandler(self.state),
            "set_breakpoint_by_regex": BreakpointHandler(self.state),
            # Variable
            "locals": VariableHandler(self.state),
            "fields": VariableHandler(self.state),
            "get_variable_by_path": VariableHandler(self.state),
            # Register
            "registers": RegisterHandler(self.state),
            # Selection
            "get_selected_thread": SelectionHandler(self.state),
            "set_selected_thread": SelectionHandler(self.state),
            "get_selected_frame": SelectionHandler(self.state),
            "set_selected_frame": SelectionHandler(self.state),
            # Process Info
            "get_exit_info": ProcessInfoHandler(self.state),
            "get_stop_description": ProcessInfoHandler(self.state),
            # Expression
            "eval": ExpressionHandler(self.state),
            # Target Info
            "get_target_info": TargetInfoHandler(self.state),
            # Event
            "wait_for_event": EventHandler(self.state),
            # Module
            "get_target_metadata": ModuleHandler(self.state),
            "get_modules": ModuleHandler(self.state),
            "get_symbol": ModuleHandler(self.state),
            # Type
            "get_type_info": TypeHandler(self.state),
            # IO
            "put_stdin": IOHandler(self.state),
            "get_stdout": IOHandler(self.state),
            "get_stderr": IOHandler(self.state),
            # Batch
            "get_thread_batch_info": BatchHandler(self.state),
        }

    def run(self) -> None:
        """Main loop: read JSON commands from stdin"""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                req_id = request.get("id", 0)
                method = request.get("method", "")
                params = request.get("params", {})

                handler = self._handlers.get(method)
                if handler:
                    handler_method = getattr(handler, f"handle_{method}", None)
                    if handler_method:
                        result = handler_method(params)
                        self._send_response(req_id, result)
                    else:
                        self._send_error(req_id, "UNKNOWN_METHOD", f"Unknown method: {method}")
                else:
                    self._send_error(req_id, "UNKNOWN_METHOD", f"Unknown method: {method}")

            except json.JSONDecodeError as e:
                self._send_error(0, "PARSE_ERROR", str(e))
            except LLDBError as e:
                self._send_error(request.get("id", 0), e.code, e.message)
            except Exception as e:
                self._send_error(request.get("id", 0), "INTERNAL_ERROR", str(e))

    def _send_response(self, req_id: int, result: Any) -> None:
        """Send success response"""
        response = {"id": req_id, "result": result}
        print(json.dumps(response), flush=True)

    def _send_error(self, req_id: int, code: str, message: str) -> None:
        """Send error response"""
        response = {"id": req_id, "error": {"code": code, "message": message}}
        print(json.dumps(response), flush=True)


def main():
    """Entry point"""
    bridge = LLDBBridge()
    bridge.run()


if __name__ == "__main__":
    main()
