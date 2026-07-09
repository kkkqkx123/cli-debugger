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

    def handle_expand_variable(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Recursively expand variable fields using SBValue API"""
        object_id = params.get("objectId")
        depth = params.get("depth", 1)
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)

        thread = self.state.get_thread_by_id(thread_id)
        if frame_index >= thread.GetNumFrames():
            raise LLDBError("FRAME_NOT_FOUND", f"Frame {frame_index} not found")

        frame = thread.GetFrameAtIndex(frame_index)

        # Try to find the variable - it could be a path expression
        var = frame.GetValueForVariablePath(object_id)
        if not var.IsValid():
            raise LLDBError("VARIABLE_NOT_FOUND", f"Variable '{object_id}' not found")

        return self._expand_children(var, depth)

    def _expand_children(self, var: Any, depth: int) -> List[Dict[str, Any]]:
        """Recursively expand children of a variable"""
        import lldb
        from utils.converters import variable_to_dict

        num_children = var.GetNumChildren()
        if num_children == 0:
            return []

        result = []
        for i in range(num_children):
            child = var.GetChildAtIndex(i)
            if not child.IsValid():
                continue

            child_dict = variable_to_dict(child, "field")

            # Check if child has further children
            type_obj = child.GetType()
            has_children = child.GetNumChildren() > 0
            is_primitive = (
                type_obj.IsPointerType() or
                type_obj.IsArrayType() or
                type_obj.IsStructType() or
                type_obj.IsClassType()
            )

            child_dict["isPrimitive"] = not has_children or (
                not type_obj.IsStructType() and
                not type_obj.IsClassType() and
                not type_obj.IsPointerType() and
                not type_obj.IsArrayType()
            )
            child_dict["isNull"] = (
                child.GetValueAsUnsigned() == 0 if type_obj.IsPointerType() else False
            )

            # Recursively expand if depth > 1 and has children
            if depth > 1 and has_children:
                child_dict["children"] = self._expand_children(child, depth - 1)

            result.append(child_dict)

        return result
