"""
IO Handler
Handles process stdin/stdout/stderr operations
"""

import base64
from typing import Any, Dict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError


class IOHandler:
    """Handler for IO-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_put_stdin(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Write data to process stdin"""
        process = self.state.ensure_process()
        data_b64 = params.get("data")

        if not data_b64:
            raise LLDBError("INVALID_INPUT", "Data required")

        try:
            data = base64.b64decode(data_b64)
            process.PutSTDIN(data)
            return {"success": True, "bytesWritten": len(data)}
        except Exception as e:
            raise LLDBError("IO_ERROR", f"Failed to write to stdin: {e}")

    def handle_get_stdout(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Read data from process stdout"""
        process = self.state.ensure_process()
        size = params.get("size", 1024)

        try:
            buffer = bytearray(size)
            bytes_read = process.GetSTDOUT(buffer, size)

            if bytes_read > 0:
                data = bytes(buffer[:bytes_read])
                return {
                    "bytesRead": bytes_read,
                    "data": base64.b64encode(data).decode("ascii"),
                }
            else:
                return {"bytesRead": 0, "data": ""}
        except Exception as e:
            raise LLDBError("IO_ERROR", f"Failed to read from stdout: {e}")

    def handle_get_stderr(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Read data from process stderr"""
        process = self.state.ensure_process()
        size = params.get("size", 1024)

        try:
            buffer = bytearray(size)
            bytes_read = process.GetSTDERR(buffer, size)

            if bytes_read > 0:
                data = bytes(buffer[:bytes_read])
                return {
                    "bytesRead": bytes_read,
                    "data": base64.b64encode(data).decode("ascii"),
                }
            else:
                return {"bytesRead": 0, "data": ""}
        except Exception as e:
            raise LLDBError("IO_ERROR", f"Failed to read from stderr: {e}")
