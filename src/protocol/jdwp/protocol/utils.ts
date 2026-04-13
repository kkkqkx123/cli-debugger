/**
 * JDWP Protocol Utility Functions
 */

import { JDWPError, ThreadState } from "./constants.js";

// Error messages map
const ErrorMessages: Record<number, string> = {
  [JDWPError.None]: "error-free",
  [JDWPError.InvalidThread]: "Invalid thread ID",
  [JDWPError.InvalidMethodID]: "Invalid Method ID",
  [JDWPError.InvalidLocation]: "void",
  [JDWPError.InvalidFieldID]: "Invalid Field ID",
  [JDWPError.InvalidClass]: "void class",
  [JDWPError.ClassNotPrepared]: "Class not ready",
  [JDWPError.InvalidObject]: "null object",
  [JDWPError.InvalidFrameID]: "Invalid Frame ID",
  [JDWPError.OutOfMemory]: "lack of memory",
  [JDWPError.NotImplemented]: "unrealized",
  [JDWPError.NullObject]: "empty object",
  [JDWPError.InvalidTag]: "Invalid labels",
  [JDWPError.AlreadyInvoking]: "Already in call",
  [JDWPError.InvalidIndex]: "Invalid Index",
  [JDWPError.InvalidLength]: "Invalid length",
  [JDWPError.InvalidString]: "Invalid String",
  [JDWPError.InvalidCount]: "invalid count",
  [JDWPError.NotSuspended]: "Thread not hung",
  [JDWPError.Busy]: "VM is busy.",
  [JDWPError.ThreadNotExist]: "Thread does not exist",
};

/**
 * Get error message for JDWP error code
 */
export function getErrorMessage(errorCode: number): string {
  return ErrorMessages[errorCode] ?? `Unknown error (${errorCode})`;
}

/**
 * Get thread state string
 */
export function getThreadStateString(state: number): string {
  switch (state) {
    case ThreadState.Zombie:
      return "zombie";
    case ThreadState.Running:
      return "running";
    case ThreadState.Sleeping:
      return "sleeping";
    case ThreadState.Monitor:
      return "waiting-for-monitor";
    case ThreadState.Wait:
      return "waiting";
    case ThreadState.NotStarted:
      return "not-started";
    case ThreadState.Started:
      return "started";
    default:
      return `unknown(${state})`;
  }
}
