"""
Type Handler
Handles type information queries
"""

import lldb
from typing import Any, Dict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError


class TypeHandler:
    """Handler for type-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_get_type_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get detailed type information"""
        type_name = params.get("typeName")
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)
        var_name = params.get("varName")

        target = self.state.ensure_target()

        # Get type from different sources
        type_obj = None

        if type_name:
            # Find type by name
            type_obj = target.FindFirstType(type_name)
        elif var_name and thread_id:
            # Get type from variable
            thread = self.state.get_thread_by_id(thread_id)
            frame = thread.GetFrameAtIndex(frame_index)
            var = frame.FindVariable(var_name)
            if var.IsValid():
                type_obj = var.GetType()

        if not type_obj or not type_obj.IsValid():
            raise LLDBError("TYPE_NOT_FOUND", f"Type not found: {type_name or var_name}")

        # Map basic type
        basic_type_map = {
            lldb.eBasicTypeInvalid: "invalid",
            lldb.eBasicTypeVoid: "void",
            lldb.eBasicTypeChar: "char",
            lldb.eBasicTypeSignedChar: "signed_char",
            lldb.eBasicTypeUnsignedChar: "unsigned_char",
            lldb.eBasicTypeShort: "short",
            lldb.eBasicTypeUnsignedShort: "unsigned_short",
            lldb.eBasicTypeInt: "int",
            lldb.eBasicTypeUnsignedInt: "unsigned_int",
            lldb.eBasicTypeLong: "long",
            lldb.eBasicTypeUnsignedLong: "unsigned_long",
            lldb.eBasicTypeLongLong: "long_long",
            lldb.eBasicTypeUnsignedLongLong: "unsigned_long_long",
            lldb.eBasicTypeFloat: "float",
            lldb.eBasicTypeDouble: "double",
            lldb.eBasicTypeLongDouble: "long_double",
            lldb.eBasicTypeBool: "bool",
            lldb.eBasicTypeNullPtr: "nullptr",
        }
        basic_type = basic_type_map.get(type_obj.GetBasicType(), "other")

        return {
            "name": type_obj.GetName() or "<anonymous>",
            "basicType": basic_type,
            "byteSize": type_obj.GetByteSize(),
            "isPointer": type_obj.IsPointerType(),
            "isReference": type_obj.IsReferenceType(),
            "isArray": type_obj.IsArrayType(),
            "isStruct": type_obj.IsStructType(),
            "isTypedef": type_obj.IsTypedefType(),
            "numChildren": type_obj.GetNumberOfFields(),
        }
