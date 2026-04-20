"""
LLDB Error Types
"""


class LLDBError(Exception):
    """Custom error for LLDB operations"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
