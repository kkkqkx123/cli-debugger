"""
LLDB State and Type Converters
"""

import lldb
from typing import Any, Dict


def get_thread_state(thread: lldb.SBThread) -> str:
    """Convert LLDB thread state to string"""
    state_map = {
        lldb.eStateInvalid: "invalid",
        lldb.eStateUnloaded: "unloaded",
        lldb.eStateConnected: "connected",
        lldb.eStateAttaching: "attaching",
        lldb.eStateLaunching: "launching",
        lldb.eStateStopped: "stopped",
        lldb.eStateRunning: "running",
        lldb.eStateStepping: "stepping",
        lldb.eStateCrashed: "crashed",
        lldb.eStateDetached: "detached",
        lldb.eStateResuming: "resuming",
        lldb.eStateSuspended: "suspended",
    }
    return state_map.get(thread.GetState(), "unknown")


def get_stop_reason(thread: lldb.SBThread) -> str:
    """Convert LLDB stop reason to string"""
    reason_map = {
        lldb.eStopReasonInvalid: "invalid",
        lldb.eStopReasonNone: "none",
        lldb.eStopReasonTrace: "trace",
        lldb.eStopReasonBreakpoint: "breakpoint",
        lldb.eStopReasonWatchpoint: "watchpoint",
        lldb.eStopReasonSignal: "signal",
        lldb.eStopReasonException: "exception",
        lldb.eStopReasonExec: "exec",
        lldb.eStopReasonPlanComplete: "planComplete",
        lldb.eStopReasonThreadExiting: "threadExiting",
    }
    return reason_map.get(thread.GetStopReason(), "unknown")


def get_process_state(process: lldb.SBProcess) -> str:
    """Convert LLDB process state to string"""
    if not process:
        return "none"

    state_map = {
        lldb.eStateInvalid: "invalid",
        lldb.eStateUnloaded: "unloaded",
        lldb.eStateConnected: "connected",
        lldb.eStateAttaching: "attaching",
        lldb.eStateLaunching: "launching",
        lldb.eStateStopped: "stopped",
        lldb.eStateRunning: "running",
        lldb.eStateStepping: "stepping",
        lldb.eStateCrashed: "crashed",
        lldb.eStateDetached: "detached",
        lldb.eStateResuming: "resuming",
        lldb.eStateSuspended: "suspended",
    }
    return state_map.get(process.GetState(), "unknown")


def get_event_type(event: lldb.SBEvent) -> str:
    """Convert LLDB event type to string"""
    if lldb.SBProcess.GetRestartedFromEvent(event):
        return "restarted"
    if (
        lldb.SBProcess.GetProcessFromEvent(event).GetState()
        == lldb.eStateCrashed
    ):
        return "crashed"
    if (
        lldb.SBProcess.GetProcessFromEvent(event).GetState()
        == lldb.eStateStopped
    ):
        return "stopped"
    if (
        lldb.SBProcess.GetProcessFromEvent(event).GetState()
        == lldb.eStateExited
    ):
        return "exited"
    return "unknown"


def frame_to_dict(frame: lldb.SBFrame, index: int) -> Dict[str, Any]:
    """Convert LLDB frame to dictionary"""
    line_entry = frame.GetLineEntry()
    file_spec = line_entry.GetFileSpec()

    return {
        "id": index,
        "location": (
            f"{file_spec.filename}:{line_entry.line}" if file_spec else "<unknown>"
        ),
        "file": file_spec.fullpath if file_spec else None,
        "line": line_entry.line,
        "column": line_entry.column,
        "method": frame.GetFunctionName() or "<unknown>",
        "module": (
            frame.GetModule().GetFileSpec().filename if frame.GetModule() else None
        ),
        "address": frame.GetPC(),
        "isInlined": frame.IsInlined(),
    }


def variable_to_dict(var: lldb.SBValue, kind: str) -> Dict[str, Any]:
    """Convert LLDB variable to dictionary"""
    type_obj = var.GetType()

    return {
        "name": var.GetName() or "<anonymous>",
        "type": type_obj.GetName() or "<unknown>",
        "value": get_value_string(var),
        "kind": kind,
        "isPointer": type_obj.IsPointerType(),
        "isArray": type_obj.IsArrayType(),
        "isStruct": type_obj.IsStructType(),
        "numChildren": var.GetNumChildren(),
        "isNil": (
            var.GetValueAsUnsigned() == 0 if type_obj.IsPointerType() else False
        ),
    }


def get_value_string(var: lldb.SBValue) -> str:
    """Get LLDB variable value as string"""
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
