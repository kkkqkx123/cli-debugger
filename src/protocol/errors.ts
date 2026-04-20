/**
 * Error types and error codes for the debugging protocol
 */

/** Error type enumeration */
export enum ErrorType {
  ConnectionError = "connection",
  ProtocolError = "protocol",
  CommandError = "command",
  InputError = "input",
  InternalError = "internal",
}

/** Error codes */
export const ErrorCodes = {
  // Connection errors (2xxx)
  ConnectionFailed: 2001,
  ConnectionRefused: 2002,
  ConnectionTimeout: 2003,
  HandshakeFailed: 2004,
  ConnectionClosed: 2005,

  // Resource errors (3xxx)
  ResourceNotFound: 3001,
  InvalidInput: 3002,
  UnsupportedCommand: 3003,
  InvalidThreadId: 3004,
  InvalidBreakpointId: 3005,
  InvalidObjectId: 3006,
  ThreadNotSuspended: 3007,

  // Protocol errors (4xxx)
  ProtocolError: 4001,
  DecodeError: 4002,
  EncodeError: 4003,
  InvalidPacket: 4004,
  UnexpectedReply: 4005,

  // Internal errors (5xxx)
  InternalError: 5001,
  NotImplemented: 5002,
  Timeout: 5003,

  // Delve-specific error codes (6xxx)
  NotFound: 6001,
  NotReadable: 6002,
  NotSupported: 6003,
} as const;

/**
 * JDWP error code mapping
 * Maps JDWP protocol error codes to our internal error codes and types
 * Reference: https://docs.oracle.com/javase/8/docs/technotes/guides/jpda/jdwp-spec.html
 */
export const JDWPErrorCodes = {
  // VM errors
  VM_DEAD: 11,
  OUT_OF_MEMORY: 110,
  INTERNAL: 113,

  // Thread errors
  INVALID_THREAD: 10,
  INVALID_THREAD_GROUP: 12,
  INVALID_PRIORITY: 14,
  THREAD_NOT_SUSPENDED: 23,
  THREAD_SUSPENDED: 24,
  INVALID_COUNT: 51,

  // Object errors
  INVALID_OBJECT: 20,
  INVALID_CLASS: 21,
  CLASS_NOT_PREPARED: 22,
  INVALID_METHODID: 25,
  INVALID_LOCATION: 26,
  INVALID_FIELDID: 27,
  INVALID_FRAMEID: 30,

  // Type errors
  TYPE_MISMATCH: 34,
  INVALID_SLOT: 35,

  // Array errors
  INVALID_TAG: 100,
  ALREADY_INVOKING: 112,
  INVALID_INDEX: 102,

  // Class errors
  INVALID_TYPESTATE: 115,
  INVALID_LINE: 114,
  INVALID_VARIABLE: 102,

  // Field errors
  INVALID_CLASS_FORMAT: 113,
  CIRCULAR_CLASS_DEFINITION: 113,
  FAILS_VERIFICATION: 113,
  ADD_METHOD_NOT_IMPLEMENTED: 113,
  SCHEMA_CHANGE_NOT_IMPLEMENTED: 113,
  HIERARCHY_CHANGE_NOT_IMPLEMENTED: 113,
  DELETE_METHOD_NOT_IMPLEMENTED: 113,
  CLASS_MODIFIERS_CHANGE_NOT_IMPLEMENTED: 113,
  METHOD_MODIFIERS_CHANGE_NOT_IMPLEMENTED: 113,
  NOT_IMPLEMENTED: 113,

  // General errors
  NOT_FOUND: 35,
  INVALID_MONITOR: 50,
  ILLEGAL_ARGUMENT: 111,
} as const;

/**
 * Map JDWP error code to internal error code and type
 */
export function mapJDWPError(jdwpErrorCode: number): { code: number; type: ErrorType } {
  switch (jdwpErrorCode) {
    case JDWPErrorCodes.INVALID_THREAD:
      return { code: ErrorCodes.InvalidThreadId, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_THREAD_GROUP:
      return { code: ErrorCodes.InvalidThreadId, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_PRIORITY:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.THREAD_NOT_SUSPENDED:
      return { code: ErrorCodes.ThreadNotSuspended, type: ErrorType.InputError };

    case JDWPErrorCodes.THREAD_SUSPENDED:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_OBJECT:
      return { code: ErrorCodes.InvalidObjectId, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_CLASS:
    case JDWPErrorCodes.CLASS_NOT_PREPARED:
      return { code: ErrorCodes.ResourceNotFound, type: ErrorType.CommandError };

    case JDWPErrorCodes.INVALID_METHODID:
    case JDWPErrorCodes.INVALID_FIELDID:
    case JDWPErrorCodes.INVALID_FRAMEID:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_LOCATION:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_SLOT:
    case JDWPErrorCodes.INVALID_TAG:
    case JDWPErrorCodes.INVALID_INDEX:
    case JDWPErrorCodes.INVALID_LINE:
    case JDWPErrorCodes.INVALID_VARIABLE:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.TYPE_MISMATCH:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_MONITOR:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.VM_DEAD:
      return { code: ErrorCodes.ConnectionClosed, type: ErrorType.ConnectionError };

    case JDWPErrorCodes.OUT_OF_MEMORY:
      return { code: ErrorCodes.InternalError, type: ErrorType.InternalError };

    case JDWPErrorCodes.NOT_FOUND:
      return { code: ErrorCodes.ResourceNotFound, type: ErrorType.CommandError };

    case JDWPErrorCodes.ILLEGAL_ARGUMENT:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.ALREADY_INVOKING:
      return { code: ErrorCodes.ProtocolError, type: ErrorType.ProtocolError };

    case JDWPErrorCodes.INVALID_COUNT:
      return { code: ErrorCodes.InvalidInput, type: ErrorType.InputError };

    case JDWPErrorCodes.INVALID_TYPESTATE:
    case JDWPErrorCodes.INTERNAL:
    case JDWPErrorCodes.INVALID_CLASS_FORMAT:
    case JDWPErrorCodes.CIRCULAR_CLASS_DEFINITION:
    case JDWPErrorCodes.FAILS_VERIFICATION:
    case JDWPErrorCodes.ADD_METHOD_NOT_IMPLEMENTED:
    case JDWPErrorCodes.SCHEMA_CHANGE_NOT_IMPLEMENTED:
    case JDWPErrorCodes.HIERARCHY_CHANGE_NOT_IMPLEMENTED:
    case JDWPErrorCodes.DELETE_METHOD_NOT_IMPLEMENTED:
    case JDWPErrorCodes.CLASS_MODIFIERS_CHANGE_NOT_IMPLEMENTED:
    case JDWPErrorCodes.METHOD_MODIFIERS_CHANGE_NOT_IMPLEMENTED:
    case JDWPErrorCodes.NOT_IMPLEMENTED:
      return { code: ErrorCodes.InternalError, type: ErrorType.InternalError };

    default:
      return { code: ErrorCodes.ProtocolError, type: ErrorType.ProtocolError };
  }
}

/**
 * Handle JDWP protocol error and throw appropriate APIError
 * @param operation - Name of the operation that failed
 * @param reply - JDWP reply containing error code and message
 * @param context - Additional context for the error
 */
export function handleProtocolError(
  operation: string,
  reply: { errorCode: number; message: string },
  context?: Record<string, unknown>,
): never {
  const { code, type } = mapJDWPError(reply.errorCode);

  throw new APIError(
    type,
    code,
    `${operation} failed: ${reply.message}`,
    { ...context, jdwpErrorCode: reply.errorCode },
  );
}

/** Debugging API error */
export class APIError extends Error {
  public readonly type: ErrorType;
  public readonly code: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    type: ErrorType,
    code: number,
    message: string,
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message, { cause });
    this.type = type;
    this.code = code;
    this.context = context;
    this.name = "APIError";

    // Maintains proper stack trace for where the error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /** Convert error to string representation */
  override toString(): string {
    const parts = [`[${this.type}]`, `(${this.code})`, this.message];
    if (this.context && Object.keys(this.context).length > 0) {
      parts.push(`(context: ${JSON.stringify(this.context)})`);
    }
    if (this.cause instanceof Error) {
      parts.push(`: ${this.cause.message}`);
    }
    return parts.join(" ");
  }

  /** Convert to JSON-serializable object */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }
}

/** Create a connection error */
export function connectionError(
  code: number,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
): APIError {
  return new APIError(ErrorType.ConnectionError, code, message, context, cause);
}

/** Create a protocol error */
export function protocolError(
  code: number,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
): APIError {
  return new APIError(ErrorType.ProtocolError, code, message, context, cause);
}

/** Create a command error */
export function commandError(
  code: number,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
): APIError {
  return new APIError(ErrorType.CommandError, code, message, context, cause);
}

/** Create an input error */
export function inputError(
  code: number,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
): APIError {
  return new APIError(ErrorType.InputError, code, message, context, cause);
}

/** Create an internal error */
export function internalError(
  code: number,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
): APIError {
  return new APIError(ErrorType.InternalError, code, message, context, cause);
}
