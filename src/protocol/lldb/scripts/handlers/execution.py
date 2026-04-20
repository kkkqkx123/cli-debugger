"""
Execution Handler
Handles execution control (suspend, resume, step operations)
"""

from typing import Any, Dict


class ExecutionHandler:
    """Handler for execution control operations"""

    def __init__(self, state):
        self.state = state

    def handle_suspend(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Suspend execution (process or thread level)"""
        thread_id = params.get("threadId")

        if thread_id:
            # Thread-level suspend
            thread = self.state.get_thread_by_id(thread_id)
            thread.Suspend()
            return {"success": True, "level": "thread", "threadId": thread_id}
        else:
            # Process-level stop
            process = self.state.ensure_process()
            process.Stop()
            return {"success": True, "level": "process", "state": self.state.get_process_state()}

    def handle_resume(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Resume execution (process or thread level)"""
        thread_id = params.get("threadId")

        if thread_id:
            # Thread-level resume
            thread = self.state.get_thread_by_id(thread_id)
            thread.Resume()
            return {"success": True, "level": "thread", "threadId": thread_id}
        else:
            # Process-level continue
            process = self.state.ensure_process()
            process.Continue()
            return {"success": True, "level": "process"}

    def handle_step_into(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Step into"""
        thread_id = params.get("threadId")
        thread = self.state.get_thread_by_id(thread_id)
        thread.StepInto()
        return {"success": True}

    def handle_step_over(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Step over"""
        thread_id = params.get("threadId")
        thread = self.state.get_thread_by_id(thread_id)
        thread.StepOver()
        return {"success": True}

    def handle_step_out(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Step out"""
        thread_id = params.get("threadId")
        thread = self.state.get_thread_by_id(thread_id)
        thread.StepOut()
        return {"success": True}
