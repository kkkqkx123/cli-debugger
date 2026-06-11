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
        use_dynamic_types = params.get("useDynamicTypes", True)
        try_all_threads = params.get("tryAllThreads", False)

        if not expression:
            raise LLDBError("INVALID_INPUT", "Expression required")

        # Create expression options
        options = lldb.SBExpressionOptions()

        if timeout_ms is not None:
            options.SetTimeoutInMicroseconds(int(timeout_ms) * 1000)

        options.SetUnwindOnError(unwind_on_error)
        options.SetIgnoreBreakpoints(ignore_breakpoints)
        options.SetDynamicTypeInfo(use_dynamic_types)

        def evaluate_in_context(thread=None, frame_idx=None):
            """Evaluate expression in specific context"""
            if thread:
                frame = thread.GetFrameAtIndex(frame_idx)
                result = frame.EvaluateExpression(expression, options)
            else:
                target = self.state.ensure_target()
                result = target.EvaluateExpression(expression, options)

            if not result.IsValid():
                error = result.GetError()
                if error.Fail():
                    raise LLDBError("EVAL_FAILED", error.GetCString() or "Expression evaluation failed")
                raise LLDBError("EVAL_FAILED", "Expression evaluation failed")

            return result

        # Try evaluating in the specified context
        if thread_id:
            try:
                thread = self.state.get_thread_by_id(thread_id)
                result = evaluate_in_context(thread, frame_index)
            except LLDBError as e:
                if try_all_threads:
                    # If tryAllThreads is enabled, try other threads
                    process = self.state.ensure_process()
                    for i in range(process.GetNumThreads()):
                        thread = process.GetThreadAtIndex(i)
                        if thread.GetThreadID() != int(thread_id):
                            try:
                                result = evaluate_in_context(thread, frame_index)
                                break
                            except LLDBError:
                                continue
                    else:
                        # All threads failed
                        raise e
                else:
                    raise e
        else:
            # Evaluate in target context
            result = evaluate_in_context()

        return variable_to_dict(result, "result")
