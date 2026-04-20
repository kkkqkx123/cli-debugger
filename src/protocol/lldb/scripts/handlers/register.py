"""
Register Handler
Handles register inspection operations
"""

import lldb
from typing import Any, Dict, List

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError


class RegisterHandler:
    """Handler for register-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_registers(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get register sets for a frame"""
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)

        thread = self.state.get_thread_by_id(thread_id)

        if frame_index >= thread.GetNumFrames():
            raise LLDBError("FRAME_NOT_FOUND", f"Frame {frame_index} not found")

        frame = thread.GetFrameAtIndex(frame_index)
        register_sets = frame.GetRegisters()

        result = []
        for i in range(register_sets.GetSize()):
            reg_set = register_sets.GetValueAtIndex(i).CastToBasicType(
                lldb.eBasicTypeVoid
            )
            # Get register set as SBValue
            reg_set_value = register_sets.GetValueAtIndex(i)

            registers = []
            for j in range(reg_set_value.GetNumChildren()):
                reg = reg_set_value.GetChildAtIndex(j)
                registers.append({
                    "name": reg.GetName() or f"reg_{j}",
                    "value": reg.GetValue() or "",
                    "type": reg.GetType().GetName() if reg.GetType() else None,
                    "size": reg.GetByteSize(),
                })

            result.append({
                "name": reg_set_value.GetName() or f"set_{i}",
                "registers": registers,
            })

        return result
