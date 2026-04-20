"""
Target Info Handler
Handles target information queries
"""

from typing import Any, Dict


class TargetInfoHandler:
    """Handler for target info-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_get_target_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get target information"""
        target = self.state.ensure_target()

        exe_spec = target.GetExecutable()
        num_modules = target.GetNumModules()
        num_breakpoints = target.GetNumBreakpoints()

        return {
            "executable": exe_spec.fullpath if exe_spec else None,
            "triple": target.GetTriple(),
            "numModules": num_modules,
            "numBreakpoints": num_breakpoints,
            "byteOrder": str(target.GetByteOrder()),
        }
