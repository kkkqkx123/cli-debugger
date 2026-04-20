"""
Metadata Handler
Handles debugger version and capabilities queries
"""

import sys
from typing import Any, Dict


class MetadataHandler:
    """Handler for metadata-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_version(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get LLDB version info"""
        self.state.ensure_initialized()
        return {
            "lldbVersion": self.state.debugger.GetVersionString(),
            "pythonVersion": sys.version,
        }

    def handle_capabilities(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get debugger capabilities"""
        return {
            "supportsThreads": True,
            "supportsStack": True,
            "supportsLocals": True,
            "supportsBreakpoints": True,
            "supportsSuspend": True,
            "supportsResume": True,
            "supportsStep": True,
            "supportsEvents": True,
            "supportsWatchpoints": True,
            "supportsExpressions": True,
        }
