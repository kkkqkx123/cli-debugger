/**
 * LLDB protocol module exports
 */

export { LLDBClient } from "./client.js";
export { LLDBBridge } from "./bridge.js";
export { checkLLDBEnvironment } from "./env.js";
export type {
  LLDBConfig,
  LLDBThreadInfo,
  LLDBStackFrame,
  LLDBVariable,
  LLDBBreakpoint,
  LLDBEvent,
  LLDBRegister,
  LLDBRegisterSet,
  LLDBExitInfo,
  LLDBEvalOptions,
  LLDBTargetInfo,
  BridgeRequest,
  BridgeResponse,
  BridgeErrorCode,
} from "./types.js";
