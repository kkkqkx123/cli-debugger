"""
Process Info Handler
Handles process information queries
"""

import lldb
from typing import Any, Dict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.converters import get_stop_reason


class ProcessInfoHandler:
    """Handler for process info-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_get_exit_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get process exit information"""
        process = self.state.ensure_process()

        state = process.GetState()
        if state != lldb.eStateExited:
            return {"status": None, "description": None, "state": self.state.get_process_state()}

        return {
            "status": process.GetExitStatus(),
            "description": process.GetExitDescription(),
            "state": "exited",
        }

    def handle_get_stop_description(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get thread stop description"""
        thread_id = params.get("threadId")
        max_length = params.get("maxLength", 256)

        thread = self.state.get_thread_by_id(thread_id)
        description = thread.GetStopDescription(max_length)

        return {
            "threadId": thread_id,
            "description": description,
            "stopReason": get_stop_reason(thread),
        }
