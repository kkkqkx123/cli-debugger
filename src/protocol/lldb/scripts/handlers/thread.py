"""
Thread Handler
Handles thread listing and state queries
"""

from typing import Any, Dict, List

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError
from utils.converters import get_thread_state, get_stop_reason


class ThreadHandler:
    """Handler for thread-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_threads(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get all threads"""
        process = self.state.ensure_process()

        threads = []
        for i in range(process.GetNumThreads()):
            thread = process.GetThreadAtIndex(i)
            threads.append(
                {
                    "id": thread.GetThreadID(),
                    "name": thread.GetName() or f"thread-{thread.GetThreadID()}",
                    "state": get_thread_state(thread),
                    "stopReason": get_stop_reason(thread),
                    "numFrames": thread.GetNumFrames(),
                }
            )

        return threads

    def handle_thread_state(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get thread state"""
        thread_id = params.get("threadId")
        thread = self.state.get_thread_by_id(thread_id)

        return {
            "id": thread.GetThreadID(),
            "state": get_thread_state(thread),
            "stopReason": get_stop_reason(thread),
            "stopDescription": thread.GetStopDescription(256),
        }
