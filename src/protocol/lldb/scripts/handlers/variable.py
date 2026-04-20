"""
Variable Handler
Handles variable inspection operations
"""

from typing import Any, Dict, List

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError
from utils.converters import variable_to_dict


class VariableHandler:
    """Handler for variable-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_locals(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get local variables"""
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)

        thread = self.state.get_thread_by_id(thread_id)

        if frame_index >= thread.GetNumFrames():
            raise LLDBError("FRAME_NOT_FOUND", f"Frame {frame_index} not found")

        frame = thread.GetFrameAtIndex(frame_index)
        variables = []

        # Get arguments
        for i in range(frame.GetNumArguments()):
            var = frame.GetArgumentAtIndex(i)
            variables.append(variable_to_dict(var, "arg"))

        # Get local variables
        for i in range(frame.GetNumVariables()):
            var = frame.GetVariableAtIndex(i)
            variables.append(variable_to_dict(var, "local"))

        return variables

    def handle_fields(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get object/struct fields"""
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)
        var_name = params.get("varName")

        thread = self.state.get_thread_by_id(thread_id)
        frame = thread.GetFrameAtIndex(frame_index)

        # Find the variable
        var = frame.FindVariable(var_name)
        if not var.IsValid():
            raise LLDBError("VARIABLE_NOT_FOUND", f"Variable {var_name} not found")

        # Get children (fields/elements)
        fields = []
        for i in range(var.GetNumChildren()):
            child = var.GetChildAtIndex(i)
            fields.append(variable_to_dict(child, "field"))

        return fields

    def handle_get_variable_by_path(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get variable by path (e.g., 'obj->field', 'array[0]')"""
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)
        path = params.get("path")

        if not path:
            raise LLDBError("INVALID_INPUT", "Variable path required")

        thread = self.state.get_thread_by_id(thread_id)

        if frame_index >= thread.GetNumFrames():
            raise LLDBError("FRAME_NOT_FOUND", f"Frame {frame_index} not found")

        frame = thread.GetFrameAtIndex(frame_index)
        var = frame.GetValueForVariablePath(path)

        if not var.IsValid():
            raise LLDBError("VARIABLE_NOT_FOUND", f"Variable path '{path}' not found")

        return variable_to_dict(var, "field")
