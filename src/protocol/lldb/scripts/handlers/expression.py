"""
Expression Handler
Handles expression evaluation operations
"""

import lldb
from typing import Any, Dict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.errors import LLDBError
from utils.converters import variable_to_dict


class ExpressionHandler:
    """Handler for expression-related operations"""

    def __init__(self, state):
        self.state = state

    def handle_eval(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate an expression with optional options"""
        expression = params.get("expression")
        thread_id = params.get("threadId")
        frame_index = params.get("frameIndex", 0)
        timeout_ms = params.get("timeout")
        unwind_on_error = params.get("unwindOnError", True)
        ignore_breakpoints = params.get("ignoreBreakpoints", False)

        if not expression:
            raise LLDBError("INVALID_INPUT", "Expression required")

        # Create expression options
        options = lldb.SBExpressionOptions()

        if timeout_ms is not None:
            options.SetTimeoutInMicroseconds(int(timeout_ms) * 1000)

        options.SetUnwindOnError(unwind_on_error)
        options.SetIgnoreBreakpoints(ignore_breakpoints)

        if thread_id:
            thread = self.state.get_thread_by_id(thread_id)
            frame = thread.GetFrameAtIndex(frame_index)
            result = frame.EvaluateExpression(expression, options)
        else:
            target = self.state.ensure_target()
            result = target.EvaluateExpression(expression, options)

        if not result.IsValid():
            error = result.GetError()
            if error.Fail():
                raise LLDBError("EVAL_FAILED", error.GetCString() or "Expression evaluation failed")
            raise LLDBError("EVAL_FAILED", "Expression evaluation failed")

        return variable_to_dict(result, "result")
