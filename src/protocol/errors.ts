/**
 * Error types and error codes for the debugging protocol
 */

/** Error type enumeration */
export enum ErrorType {
  ConnectionError = 'connection',
  ProtocolError = 'protocol',
  CommandError = 'command',
  InputError = 'input',
  InternalError = 'internal',
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
} as const;

/** Debugging API error */
export class APIError extends Error {
  public readonly type: ErrorType;
  public readonly code: number;

  constructor(
    type: ErrorType,
    code: number,
    message: string,
    cause?: Error
  ) {
    super(message, { cause });
    this.type = type;
    this.code = code;
    this.name = 'APIError';

    // Maintains proper stack trace for where the error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /** Convert error to string representation */
  override toString(): string {
    const parts = [`[${this.type}]`, `(${this.code})`, this.message];
    if (this.cause instanceof Error) {
      parts.push(`: ${this.cause.message}`);
    }
    return parts.join(' ');
  }

  /** Convert to JSON-serializable object */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }
}

/** Create a connection error */
export function connectionError(
  code: number,
  message: string,
  cause?: Error
): APIError {
  return new APIError(ErrorType.ConnectionError, code, message, cause);
}

/** Create a protocol error */
export function protocolError(
  code: number,
  message: string,
  cause?: Error
): APIError {
  return new APIError(ErrorType.ProtocolError, code, message, cause);
}

/** Create a command error */
export function commandError(
  code: number,
  message: string,
  cause?: Error
): APIError {
  return new APIError(ErrorType.CommandError, code, message, cause);
}

/** Create an input error */
export function inputError(
  code: number,
  message: string,
  cause?: Error
): APIError {
  return new APIError(ErrorType.InputError, code, message, cause);
}

/** Create an internal error */
export function internalError(
  code: number,
  message: string,
  cause?: Error
): APIError {
  return new APIError(ErrorType.InternalError, code, message, cause);
}
