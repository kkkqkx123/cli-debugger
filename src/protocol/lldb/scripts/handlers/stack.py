"""
Stack Handler
Handles call stack queries
"""

from typing import Any, Dict, List

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.converters import frame_to_dict


class StackHandler:
    """Handler for stack-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_stack(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get call stack for a thread"""
        thread_id = params.get("threadId")
        depth = params.get("depth", 50)

        thread = self.state.get_thread_by_id(thread_id)

        frames = []
        num_frames = min(thread.GetNumFrames(), depth)

        for i in range(num_frames):
            frame = thread.GetFrameAtIndex(i)
            frames.append(frame_to_dict(frame, i))

        return frames
