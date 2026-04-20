"""
Batch Handler
Handles batch information queries for performance optimization
"""

from typing import Any, Dict


class BatchHandler:
    """Handler for batch-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_get_thread_batch_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get batch information for a thread"""
        thread_id = params.get("threadId")
        thread = self.state.get_thread_by_id(thread_id)

        addresses = []
        modules = []
        symbols = []
        files = []
        lines = []
        functions = []

        for i in range(thread.GetNumFrames()):
            frame = thread.GetFrameAtIndex(i)

            # Address
            addresses.append(frame.GetPC())

            # Module
            module = frame.GetModule()
            modules.append(module.GetFileSpec().filename if module else "")

            # Symbol
            symbol = frame.GetSymbol()
            symbols.append(symbol.GetName() if symbol and symbol.IsValid() else "")

            # File and line
            line_entry = frame.GetLineEntry()
            file_spec = line_entry.GetFileSpec()
            files.append(file_spec.fullpath if file_spec else "")
            lines.append(line_entry.line)

            # Function
            functions.append(frame.GetFunctionName() or "")

        return {
            "addresses": addresses,
            "modules": modules,
            "symbols": symbols,
            "files": files,
            "lines": lines,
            "functions": functions,
        }
