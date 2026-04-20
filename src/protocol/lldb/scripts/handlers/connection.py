"""
Connection Handler
Handles debugger connection, disconnection, and process launch
"""

import lldb
import os
from typing import Any, Dict

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError


class ConnectionHandler:
    """Handler for connection-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_connect(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Connect to debug target

        Params:
            target: Path to executable
            coreFile: Optional core dump file
            attachPid: Optional PID to attach
            waitFor: Wait for process to launch (for attach)
        """
        self.state.ensure_initialized()

        target_path = params.get("target")
        if not target_path:
            raise LLDBError("INVALID_INPUT", "Target path required")

        if not os.path.exists(target_path):
            raise LLDBError("TARGET_NOT_FOUND", f"Target not found: {target_path}")

        error = lldb.SBError()

        # Create target
        self.state.target = self.state.debugger.CreateTarget(
            target_path, None, None, False, error
        )

        if error.Fail():
            raise LLDBError("CREATE_TARGET_FAILED", str(error))

        core_file = params.get("coreFile")
        attach_pid = params.get("attachPid")
        wait_for = params.get("waitFor", False)

        if core_file:
            # Load core dump
            self.state.process = self.state.target.LoadCore(core_file, error)
            if error.Fail():
                raise LLDBError("LOAD_CORE_FAILED", str(error))
        elif attach_pid:
            # Attach to running process
            self.state.process = self.state.target.AttachToProcessWithID(
                self.state.listener, attach_pid, error
            )
            if error.Fail():
                raise LLDBError("ATTACH_FAILED", str(error))
        elif wait_for:
            # Wait for process to launch
            self.state.process = self.state.target.AttachToProcessWithName(
                self.state.listener, os.path.basename(target_path), True, error
            )
            if error.Fail():
                raise LLDBError("WAIT_FOR_PROCESS_FAILED", str(error))

        return {
            "success": True,
            "targetId": str(self.state.target.GetFileSpec()),
            "triple": self.state.target.GetTriple(),
        }

    def handle_disconnect(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Disconnect from debug target"""
        if self.state.process:
            # Detach or kill process
            keep_alive = params.get("keepAlive", False)
            if keep_alive:
                self.state.process.Detach()
            else:
                self.state.process.Kill()
            self.state.process = None

        if self.state.target:
            self.state.debugger.DeleteTarget(self.state.target)
            self.state.target = None

        self.state.breakpoint_map.clear()
        return {"success": True}

    def handle_launch(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Launch the target process

        Params:
            args: List of arguments
            env: Environment variables
            stopAtEntry: Stop at program entry
            workingDir: Working directory
        """
        target = self.state.ensure_target()

        args = params.get("args", [])
        env = params.get("env", {})
        stop_at_entry = params.get("stopAtEntry", False)
        working_dir = params.get("workingDir")

        error = lldb.SBError()

        # Build launch info
        launch_info = lldb.SBLaunchInfo(args)
        launch_info.SetLaunchFlags(lldb.eLaunchFlagStopAtEntry if stop_at_entry else 0)

        if working_dir:
            launch_info.SetWorkingDirectory(working_dir)

        if env:
            env_list = [f"{k}={v}" for k, v in env.items()]
            launch_info.SetEnvironmentEntries(env_list, True)

        self.state.process = target.Launch(launch_info, error)

        if error.Fail():
            raise LLDBError("LAUNCH_FAILED", str(error))

        return {
            "success": True,
            "pid": self.state.process.GetProcessID(),
            "state": self.state.get_process_state(),
        }
