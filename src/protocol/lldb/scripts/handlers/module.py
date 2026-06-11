"""
Module Handler
Handles module and symbol inspection operations
"""

from typing import Any, Dict, List

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError


class ModuleHandler:
    """Handler for module-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_get_target_metadata(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get target metadata"""
        target = self.state.ensure_target()

        exe_spec = target.GetExecutable()
        num_modules = target.GetNumModules()

        # Count total sections and symbols
        num_sections = 0
        num_symbols = 0
        for i in range(num_modules):
            module = target.GetModuleAtIndex(i)
            num_sections += module.GetNumSections()
            num_symbols += module.GetNumSymbols()

        return {
            "executable": exe_spec.fullpath if exe_spec else "",
            "triple": target.GetTriple(),
            "numModules": num_modules,
            "numSections": num_sections,
            "numSymbols": num_symbols,
        }

    def handle_get_modules(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get all modules"""
        target = self.state.ensure_target()

        modules = []
        for i in range(target.GetNumModules()):
            module = target.GetModuleAtIndex(i)
            file_spec = module.GetFileSpec()

            modules.append({
                "name": file_spec.filename if file_spec else "",
                "file": file_spec.fullpath if file_spec else "",
                "uuid": str(module.GetUUID()),
                "numSections": module.GetNumSections(),
                "numSymbols": module.GetNumSymbols(),
            })

        return modules

    def handle_get_symbol(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get symbol - can query by name (with fuzzy matching) or get symbol at current frame"""
        import lldb
        import fnmatch

        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)
        symbol_name = params.get("symbolName")
        fuzzy_match = params.get("fuzzyMatch", False)

        # If symbol name is provided, search for it
        if symbol_name:
            target = self.state.ensure_target()

            # Search through all modules for symbols matching the name
            matches = []

            for i in range(target.GetNumModules()):
                module = target.GetModuleAtIndex(i)
                for j in range(module.GetNumSymbols()):
                    symbol = module.GetSymbolAtIndex(j)
                    if symbol.IsValid():
                        sym_name = symbol.GetName()
                        if sym_name:
                            # Exact match or fuzzy match
                            if fuzzy_match:
                                if fnmatch.fnmatch(sym_name.lower(), symbol_name.lower()):
                                    matches.append(symbol)
                            else:
                                if sym_name == symbol_name:
                                    matches.append(symbol)

            if not matches:
                # Try case-insensitive exact match
                for i in range(target.GetNumModules()):
                    module = target.GetModuleAtIndex(i)
                    for j in range(module.GetNumSymbols()):
                        symbol = module.GetSymbolAtIndex(j)
                        if symbol.IsValid():
                            sym_name = symbol.GetName()
                            if sym_name and sym_name.lower() == symbol_name.lower():
                                matches.append(symbol)

            if not matches:
                raise LLDBError("SYMBOL_NOT_FOUND", f"Symbol '{symbol_name}' not found")

            # Return the first match (or could return all matches in the future)
            symbol = matches[0]

            # Determine symbol type
            sym_type = symbol.GetType()
            if symbol.IsSynthetic():
                type_str = "other"
            elif sym_type == lldb.eSymbolTypeCode:
                type_str = "code"
            elif sym_type == lldb.eSymbolTypeData:
                type_str = "data"
            elif sym_type == lldb.eSymbolTypeDebug:
                type_str = "debug"
            else:
                type_str = "other"

            return {
                "name": symbol.GetName() or "<unknown>",
                "type": type_str,
                "address": symbol.GetStartAddress().GetLoadAddress(self.state.target),
                "size": symbol.GetEndAddress().GetLoadAddress(self.state.target) -
                        symbol.GetStartAddress().GetLoadAddress(self.state.target),
                "module": symbol.GetModule().GetFileSpec().filename if symbol.GetModule() else None,
                "numMatches": len(matches),
            }

        # Otherwise, get symbol at current frame position
        else:
            if not thread_id:
                raise LLDBError("INVALID_INPUT", "Either symbolName or threadId must be provided")

            thread = self.state.get_thread_by_id(thread_id)

            if frame_index >= thread.GetNumFrames():
                raise LLDBError("FRAME_NOT_FOUND", f"Frame {frame_index} not found")

            frame = thread.GetFrameAtIndex(frame_index)
            symbol = frame.GetSymbol()

            if not symbol.IsValid():
                # If no symbol at this location, try to get from PC address
                pc_address = frame.GetPCAddress()
                if pc_address.IsValid():
                    module = pc_address.GetModule()
                    if module and module.IsValid():
                        symbol = module.ResolveSymbolContextForAddress(
                            pc_address, lldb.eSymbolContextSymbol
                        ).GetSymbol()

            if not symbol or not symbol.IsValid():
                raise LLDBError("SYMBOL_NOT_FOUND", "No symbol at this location")

            # Determine symbol type
            sym_type = symbol.GetType()
            if symbol.IsSynthetic():
                type_str = "other"
            elif sym_type == lldb.eSymbolTypeCode:
                type_str = "code"
            elif sym_type == lldb.eSymbolTypeData:
                type_str = "data"
            elif sym_type == lldb.eSymbolTypeDebug:
                type_str = "debug"
            else:
                type_str = "other"

            return {
                "name": symbol.GetName() or "<unknown>",
                "type": type_str,
                "address": symbol.GetStartAddress().GetLoadAddress(self.state.target),
                "size": symbol.GetEndAddress().GetLoadAddress(self.state.target) -
                        symbol.GetStartAddress().GetLoadAddress(self.state.target),
                "module": symbol.GetModule().GetFileSpec().filename if symbol.GetModule() else None,
            }
