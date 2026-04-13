package errors

import (
	"errors"
	"fmt"
)

// ErrorCode Error code type
type ErrorCode int

// Error code constants
const (
	// General errors (0-99)
	ErrSuccess ErrorCode = 0
	ErrUnknown ErrorCode = 1
	ErrInternal ErrorCode = 2

	// Input errors (100-199)
	ErrInvalidInput ErrorCode = 100
	ErrMissingRequiredField ErrorCode = 101
	ErrInvalidFormat ErrorCode = 102
	ErrOutOfRange ErrorCode = 103

	// Connection errors (200-299)
	ErrConnectionFailed ErrorCode = 200
	ErrConnectionTimeout ErrorCode = 201
	ErrConnectionRefused ErrorCode = 202
	ErrConnectionClosed ErrorCode = 203
	ErrHandshakeFailed ErrorCode = 204

	// Protocol errors (300-399)
	ErrProtocolError ErrorCode = 300
	ErrInvalidResponse ErrorCode = 301
	ErrUnsupportedCommand ErrorCode = 302
	ErrPacketFormatError ErrorCode = 303

	// Command errors (400-499)
	ErrCommandFailed ErrorCode = 400
	ErrCommandTimeout ErrorCode = 401
	ErrResourceNotFound ErrorCode = 402
	ErrPermissionDenied ErrorCode = 403
	ErrOperationNotSupported ErrorCode = 404
)

// ErrorType Error type
type ErrorType int

const (
	ErrorTypeUnknown ErrorType = iota
	ErrorTypeInput
	ErrorTypeConnection
	ErrorTypeProtocol
	ErrorTypeCommand
	ErrorTypeInternal
)

// ErrorTypeToString Error type to string
func ErrorTypeToString(t ErrorType) string {
	switch t {
	case ErrorTypeInput:
		return "input"
	case ErrorTypeConnection:
		return "connection"
	case ErrorTypeProtocol:
		return "protocol"
	case ErrorTypeCommand:
		return "command"
	case ErrorTypeInternal:
		return "internal"
	default:
		return "unknown"
	}
}

// ErrorCodes Error messages
var ErrorMessages = map[ErrorCode]string{
	ErrSuccess:                      "Success",
	ErrUnknown:                      "Unknown error",
	ErrInternal:                     "Internal error",
	ErrInvalidInput:                 "Invalid input",
	ErrMissingRequiredField:         "Missing required field",
	ErrInvalidFormat:                "Invalid format",
	ErrOutOfRange:                   "Value out of range",
	ErrConnectionFailed:             "Connection failed",
	ErrConnectionTimeout:            "Connection timeout",
	ErrConnectionRefused:            "Connection refused",
	ErrConnectionClosed:             "Connection closed",
	ErrHandshakeFailed:              "Handshake failed",
	ErrProtocolError:                "Protocol error",
	ErrInvalidResponse:              "Invalid response",
	ErrUnsupportedCommand:           "Unsupported command",
	ErrPacketFormatError:            "Packet format error",
	ErrCommandFailed:                "Command failed",
	ErrCommandTimeout:               "Command timeout",
	ErrResourceNotFound:             "Resource not found",
	ErrPermissionDenied:             "Permission denied",
	ErrOperationNotSupported:        "Operation not supported",
}

// GetErrorCodeType Get error code type
func GetErrorCodeType(code ErrorCode) ErrorType {
	switch {
	case code >= 100 && code < 200:
		return ErrorTypeInput
	case code >= 200 && code < 300:
		return ErrorTypeConnection
	case code >= 300 && code < 400:
		return ErrorTypeProtocol
	case code >= 400 && code < 500:
		return ErrorTypeCommand
	case code >= 1 && code < 100:
		return ErrorTypeInternal
	default:
		return ErrorTypeUnknown
	}
}

// GetExitCode Get exit code
func GetExitCode(code ErrorCode) int {
	switch GetErrorCodeType(code) {
	case ErrorTypeInput:
		return 1
	case ErrorTypeConnection:
		return 2
	case ErrorTypeProtocol:
		return 3
	case ErrorTypeCommand:
		return 4
	case ErrorTypeInternal:
		return 5
	default:
		return 1
	}
}

// GetErrorMessage Get error message
func GetErrorMessage(code ErrorCode) string {
	if msg, ok := ErrorMessages[code]; ok {
		return msg
	}
	return ErrorMessages[ErrUnknown]
}

// IsErrorType Check if error is of specific type
func IsErrorType(err error, errorType ErrorType) bool {
	if err == nil {
		return false
	}
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.Type == errorType
}

// IsConnectionError Check if error is connection error
func IsConnectionError(err error) bool {
	return IsErrorType(err, ErrorTypeConnection)
}

// IsProtocolError Check if error is protocol error
func IsProtocolError(err error) bool {
	return IsErrorType(err, ErrorTypeProtocol)
}

// IsCommandError Check if error is command error
func IsCommandError(err error) bool {
	return IsErrorType(err, ErrorTypeCommand)
}

// IsInputError Check if error is input error
func IsInputError(err error) bool {
	return IsErrorType(err, ErrorTypeInput)
}

// IsInternalError Check if error is internal error
func IsInternalError(err error) bool {
	return IsErrorType(err, ErrorTypeInternal)
}

// APIError API error structure
type APIError struct {
	Type    ErrorType
	Code    ErrorCode
	Message string
	Cause   error
}

func (e *APIError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%s:%d] %s: %v", ErrorTypeToString(e.Type), e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%s:%d] %s", ErrorTypeToString(e.Type), e.Code, e.Message)
}

func (e *APIError) Unwrap() error {
	return e.Cause
}

// NewAPIError Create a new API error
func NewAPIError(errorType ErrorType, code ErrorCode, message string, cause error) *APIError {
	return &APIError{
		Type:    errorType,
		Code:    code,
		Message: message,
		Cause:   cause,
	}
}

// WrapError Wrap an error with additional context
func WrapError(err error, errorType ErrorType, code ErrorCode, message string) error {
	if err == nil {
		return nil
	}
	return NewAPIError(errorType, code, message, err)
}

// WrapConnectionError Wrap a connection error
func WrapConnectionError(err error, code ErrorCode, message string) error {
	if err == nil {
		return nil
	}
	if code == 0 {
		code = ErrConnectionFailed
	}
	return WrapError(err, ErrorTypeConnection, code, message)
}

// WrapProtocolError Wrap a protocol error
func WrapProtocolError(err error, code ErrorCode, message string) error {
	if err == nil {
		return nil
	}
	if code == 0 {
		code = ErrProtocolError
	}
	return WrapError(err, ErrorTypeProtocol, code, message)
}

// WrapCommandError Wrap a command error
func WrapCommandError(err error, code ErrorCode, message string) error {
	if err == nil {
		return nil
	}
	if code == 0 {
		code = ErrCommandFailed
	}
	return WrapError(err, ErrorTypeCommand, code, message)
}

// WrapInputError Wrap an input error
func WrapInputError(err error, code ErrorCode, message string) error {
	if err == nil {
		return nil
	}
	if code == 0 {
		code = ErrInvalidInput
	}
	return WrapError(err, ErrorTypeInput, code, message)
}

// WrapInternalError Wrap an internal error
func WrapInternalError(err error, code ErrorCode, message string) error {
	if err == nil {
		return nil
	}
	if code == 0 {
		code = ErrInternal
	}
	return WrapError(err, ErrorTypeInternal, code, message)
}

// NewInputError Create a new input error
func NewInputError(code ErrorCode, message string) error {
	return NewAPIError(ErrorTypeInput, code, message, nil)
}

// NewConnectionError Create a new connection error
func NewConnectionError(code ErrorCode, message string) error {
	return NewAPIError(ErrorTypeConnection, code, message, nil)
}

// NewProtocolError Create a new protocol error
func NewProtocolError(code ErrorCode, message string) error {
	return NewAPIError(ErrorTypeProtocol, code, message, nil)
}

// NewCommandError Create a new command error
func NewCommandError(code ErrorCode, message string) error {
	return NewAPIError(ErrorTypeCommand, code, message, nil)
}

// NewInternalError Create a new internal error
func NewInternalError(code ErrorCode, message string) error {
	return NewAPIError(ErrorTypeInternal, code, message, nil)
}
