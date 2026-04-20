"""
Breakpoint Handler
Handles breakpoint management operations
"""

import lldb
from typing import Any, Dict, List

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError


class BreakpointHandler:
    """Handler for breakpoint-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_set_breakpoint(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Set a breakpoint"""
        target = self.state.ensure_target()

        location = params.get("location")
        condition = params.get("condition")
        ignore_count = params.get("ignoreCount", 0)
        address = params.get("address")
        source_regex = params.get("sourceRegex")
        source_file = params.get("sourceFile")

        bp = None

        # Priority: address > source_regex > location
        if address is not None:
            # Set breakpoint by address
            bp = target.BreakpointCreateByAddress(int(address))
        elif source_regex and source_file:
            # Set breakpoint by source regex
            bp = target.BreakpointCreateBySourceRegex(source_regex, source_file)
        elif location:
            # Parse location: "file:line" or "function"
            if ":" in location and location.split(":")[-1].isdigit():
                parts = location.rsplit(":", 1)
                file_name = parts[0]
                line_num = int(parts[1])
                bp = target.BreakpointCreateByLocation(file_name, line_num)
            else:
                # Function name
                bp = target.BreakpointCreateByName(location)
        else:
            raise LLDBError(
                "INVALID_INPUT",
                "Breakpoint location, address, or sourceRegex required"
            )

        if not bp or not bp.IsValid():
            raise LLDBError(
                "BREAKPOINT_FAILED",
                f"Failed to create breakpoint at {location or address or source_regex}"
            )

        if condition:
            bp.SetCondition(condition)

        if ignore_count > 0:
            bp.SetIgnoreCount(ignore_count)

        bp_id = f"lldb_bp_{bp.GetID()}"
        self.state.breakpoint_map[bp_id] = bp

        # Get locations for the breakpoint
        locations = []
        for i in range(bp.GetNumLocations()):
            loc = bp.GetLocationAtIndex(i)
            addr = loc.GetAddress()
            line_entry = addr.GetLineEntry()
            if line_entry:
                file_spec = line_entry.GetFileSpec()
                locations.append(f"{file_spec.filename}:{line_entry.line}")

        return {
            "id": bp_id,
            "internalId": bp.GetID(),
            "locations": locations,
            "enabled": bp.IsEnabled(),
            "hitCount": bp.GetHitCount(),
            "ignoreCount": bp.GetIgnoreCount(),
            "condition": bp.GetCondition() or None,
        }

    def handle_remove_breakpoint(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Remove a breakpoint"""
        target = self.state.ensure_target()

        bp_id = params.get("id")
        if bp_id not in self.state.breakpoint_map:
            raise LLDBError("BREAKPOINT_NOT_FOUND", f"Breakpoint {bp_id} not found")

        bp = self.state.breakpoint_map[bp_id]
        target.BreakpointDelete(bp.GetID())
        del self.state.breakpoint_map[bp_id]

        return {"success": True}

    def handle_clear_breakpoints(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Clear all breakpoints"""
        target = self.state.ensure_target()
        target.DeleteAllBreakpoints()
        self.state.breakpoint_map.clear()
        return {"success": True}

    def handle_breakpoints(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """List all breakpoints"""
        target = self.state.ensure_target()

        breakpoints = []
        for i in range(target.GetNumBreakpoints()):
            bp = target.GetBreakpointAtIndex(i)
            if bp.IsValid():
                # Get location info
                locations = []
                for j in range(bp.GetNumLocations()):
                    loc = bp.GetLocationAtIndex(j)
                    addr = loc.GetAddress()
                    line_entry = addr.GetLineEntry()
                    if line_entry:
                        file_spec = line_entry.GetFileSpec()
                        locations.append(f"{file_spec.filename}:{line_entry.line}")

                breakpoints.append(
                    {
                        "id": f"lldb_bp_{bp.GetID()}",
                        "internalId": bp.GetID(),
                        "locations": locations,
                        "enabled": bp.IsEnabled(),
                        "hitCount": bp.GetHitCount(),
                        "ignoreCount": bp.GetIgnoreCount(),
                        "condition": bp.GetCondition() or None,
                    }
                )

        return breakpoints

    def handle_enable_breakpoint(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Enable a breakpoint"""
        bp_id = params.get("id")
        if bp_id not in self.state.breakpoint_map:
            raise LLDBError("BREAKPOINT_NOT_FOUND", f"Breakpoint {bp_id} not found")

        bp = self.state.breakpoint_map[bp_id]
        bp.SetEnabled(True)

        return {"success": True, "id": bp_id, "enabled": True}

    def handle_disable_breakpoint(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Disable a breakpoint"""
        bp_id = params.get("id")
        if bp_id not in self.state.breakpoint_map:
            raise LLDBError("BREAKPOINT_NOT_FOUND", f"Breakpoint {bp_id} not found")

        bp = self.state.breakpoint_map[bp_id]
        bp.SetEnabled(False)

        return {"success": True, "id": bp_id, "enabled": False}

    def handle_get_breakpoint_locations(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get detailed breakpoint locations"""
        bp_id = params.get("id")
        if bp_id not in self.state.breakpoint_map:
            raise LLDBError("BREAKPOINT_NOT_FOUND", f"Breakpoint {bp_id} not found")

        bp = self.state.breakpoint_map[bp_id]
        locations = []

        for i in range(bp.GetNumLocations()):
            loc = bp.GetLocationAtIndex(i)
            addr = loc.GetAddress()
            line_entry = addr.GetLineEntry()
            file_spec = line_entry.GetFileSpec() if line_entry else None

            locations.append({
                "id": loc.GetID(),
                "address": addr.GetLoadAddress(self.state.target),
                "file": file_spec.fullpath if file_spec else None,
                "line": line_entry.line if line_entry else 0,
                "column": line_entry.column if line_entry else 0,
                "enabled": loc.IsEnabled(),
                "resolved": loc.IsResolved(),
            })

        return locations

    def handle_set_breakpoint_by_regex(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Set breakpoint by source regex"""
        target = self.state.ensure_target()

        pattern = params.get("pattern")
        source_file = params.get("file")
        condition = params.get("condition")
        ignore_count = params.get("ignoreCount", 0)

        if not pattern:
            raise LLDBError("INVALID_INPUT", "Regex pattern required")

        if source_file:
            bp = target.BreakpointCreateBySourceRegex(pattern, source_file)
        else:
            # Create breakpoint by regex across all source files
            bp = target.BreakpointCreateBySourceRegex(pattern, lldb.SBFileSpec())

        if not bp or not bp.IsValid():
            raise LLDBError("BREAKPOINT_FAILED", f"Failed to create regex breakpoint: {pattern}")

        if condition:
            bp.SetCondition(condition)

        if ignore_count > 0:
            bp.SetIgnoreCount(ignore_count)

        bp_id = f"lldb_bp_{bp.GetID()}"
        self.state.breakpoint_map[bp_id] = bp

        # Get locations for the breakpoint
        locations = []
        for i in range(bp.GetNumLocations()):
            loc = bp.GetLocationAtIndex(i)
            addr = loc.GetAddress()
            line_entry = addr.GetLineEntry()
            if line_entry:
                file_spec = line_entry.GetFileSpec()
                locations.append(f"{file_spec.filename}:{line_entry.line}")

        return {
            "id": bp_id,
            "internalId": bp.GetID(),
            "locations": locations,
            "enabled": bp.IsEnabled(),
            "hitCount": bp.GetHitCount(),
            "ignoreCount": bp.GetIgnoreCount(),
            "condition": bp.GetCondition() or None,
        }
