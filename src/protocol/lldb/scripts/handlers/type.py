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
        include_fields = params.get("includeFields", True)
        include_template_args = params.get("includeTemplateArgs", True)

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

        result = {
            "name": type_obj.GetName() or "<anonymous>",
            "basicType": basic_type,
            "byteSize": type_obj.GetByteSize(),
            "isPointer": type_obj.IsPointerType(),
            "isReference": type_obj.IsReferenceType(),
            "isArray": type_obj.IsArrayType(),
            "isStruct": type_obj.IsStructType(),
            "isClass": type_obj.IsClassType(),
            "isTypedef": type_obj.IsTypedefType(),
            "isUnion": type_obj.IsUnionType(),
            "isEnumeration": type_obj.IsEnumerationType(),
            "numChildren": type_obj.GetNumberOfFields(),
            "numTemplateArgs": type_obj.GetNumberOfTemplateArguments(),
            "displayTypeName": type_obj.GetDisplayTypeName(),
            "byteAlign": type_obj.GetByteAlignment(),
        }

        # Add template arguments if requested
        if include_template_args and type_obj.GetNumberOfTemplateArguments() > 0:
            template_args = []
            for i in range(type_obj.GetNumberOfTemplateArguments()):
                template_arg = type_obj.GetTemplateArgumentType(i)
                if template_arg.IsValid():
                    template_args.append({
                        "index": i,
                        "name": template_arg.GetName() or "",
                        "type": template_arg.GetName() or "",
                    })
            result["templateArgs"] = template_args

        # Add fields if requested and applicable
        if include_fields and (type_obj.IsStructType() or type_obj.IsClassType()):
            fields = []
            for i in range(type_obj.GetNumberOfFields()):
                member = type_obj.GetFieldAtIndex(i)
                if member.IsValid():
                    field_type = member.GetType()
                    fields.append({
                        "name": member.GetName(),
                        "type": field_type.GetName() if field_type.IsValid() else "void",
                        "byteOffset": member.GetOffsetInBytes(),
                        "isBitfield": member.IsBitfield(),
                        "isBaseClass": member.IsBaseClass(),
                        "bitfieldSizeInBits": member.GetBitfieldSizeInBits() if member.IsBitfield() else None,
                    })
            result["fields"] = fields

        # Add base classes for class types
        if type_obj.IsClassType():
            base_classes = []
            for i in range(type_obj.GetNumberOfDirectBaseClasses()):
                base_class = type_obj.GetDirectBaseClassAtIndex(i)
                if base_class.IsValid():
                    base_classes.append({
                        "name": base_class.GetName(),
                        "type": base_class.GetName(),
                        "byteOffset": base_class.GetOffsetInBytes(),
                    })
            result["baseClasses"] = base_classes

        # Add enum values for enumeration types
        if type_obj.IsEnumerationType():
            enum_values = []
            for i in range(type_obj.GetNumberOfEnumerators()):
                enum_value = type_obj.GetEnumeratorAtIndex(i)
                if enum_value.IsValid():
                    enum_values.append({
                        "name": enum_value.GetName(),
                        "value": enum_value.GetValueAsSigned(),
                    })
            result["enumValues"] = enum_values

        return result
