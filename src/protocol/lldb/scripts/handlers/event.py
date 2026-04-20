"""
Event Handler
Handles debug event operations
"""

import lldb
from typing import Any, Dict, Optional

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.converters import get_process_state, get_event_type


class EventHandler:
    """Handler for event-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_wait_for_event(
        self, params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Wait for a debug event"""
        timeout = params.get("timeout", 30)

        process = self.state.ensure_process()

        # Use listener to wait for event
        event = lldb.SBEvent()
        if self.state.listener.WaitForEventForBroadcasterClassName(
            timeout, "SBProcess", event
        ):
            return self._event_to_dict(event)

        return None

    def _event_to_dict(self, event: lldb.SBEvent) -> Dict[str, Any]:
        """Convert event to dict"""
        return {
            "type": get_event_type(event),
            "state": get_process_state(self.state.process),
            "description": event.GetDescription(),
        }
