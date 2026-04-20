"""
Selection Handler
Handles thread and frame selection operations
"""

from typing import Any, Dict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError
from utils.converters import get_thread_state, get_stop_reason, frame_to_dict


class SelectionHandler:
    """Handler for selection-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_get_selected_thread(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get the currently selected thread"""
        process = self.state.ensure_process()
        thread = process.GetSelectedThread()

        if not thread.IsValid():
            raise LLDBError("THREAD_NOT_FOUND", "No selected thread")

        return {
            "id": thread.GetThreadID(),
            "name": thread.GetName() or f"thread-{thread.GetThreadID()}",
            "state": get_thread_state(thread),
            "stopReason": get_stop_reason(thread),
            "numFrames": thread.GetNumFrames(),
        }

    def handle_set_selected_thread(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Set the selected thread"""
        process = self.state.ensure_process()
        thread_id = params.get("threadId")

        if not thread_id:
            raise LLDBError("INVALID_INPUT", "threadId required")

        success = process.SetSelectedThreadByID(int(thread_id))
        if not success:
            raise LLDBError("THREAD_NOT_FOUND", f"Thread {thread_id} not found")

        return {"success": True, "threadId": thread_id}

    def handle_get_selected_frame(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get the currently selected frame for a thread"""
        thread_id = params.get("threadId")
        thread = self.state.get_thread_by_id(thread_id)

        frame = thread.GetSelectedFrame()
        if not frame.IsValid():
            raise LLDBError("FRAME_NOT_FOUND", "No selected frame")

        return frame_to_dict(frame, frame.GetFrameID())

    def handle_set_selected_frame(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Set the selected frame for a thread"""
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex")

        if frame_index is None:
            raise LLDBError("INVALID_INPUT", "frameIndex required")

        thread = self.state.get_thread_by_id(thread_id)
        thread.SetSelectedFrame(int(frame_index))

        return {"success": True, "threadId": thread_id, "frameIndex": frame_index}
