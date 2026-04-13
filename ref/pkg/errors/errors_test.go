package errors_test

import (
	stderrors "errors"
	"testing"

	"cli-debugger/pkg/errors"
)

func TestNewAPIError(t *testing.T) {
	err := errors.NewAPIError(errors.ErrorTypeInput, errors.ErrInvalidInput, "Invalid input", nil)
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	if err.Type != errors.ErrorTypeInput {
		t.Errorf("Expected error type %d, got %d", errors.ErrorTypeInput, err.Type)
	}
	if err.Code != errors.ErrInvalidInput {
		t.Errorf("Expected error code %d, got %d", errors.ErrInvalidInput, err.Code)
	}
	if err.Message != "Invalid input" {
		t.Errorf("Expected message 'Invalid input', got '%s'", err.Message)
	}
}

func TestWrapError(t *testing.T) {
	originalErr := stderrors.New("original error")
	wrappedErr := errors.WrapError(originalErr, errors.ErrorTypeConnection, errors.ErrConnectionFailed, "Connection failed")
	if wrappedErr == nil {
		t.Fatal("Expected wrapped error, got nil")
	}
	if !stderrors.Is(wrappedErr, originalErr) {
		t.Error("Wrapped error should wrap original error")
	}
}

func TestWrapConnectionError(t *testing.T) {
	originalErr := stderrors.New("network error")
	wrappedErr := errors.WrapConnectionError(originalErr, 0, "Failed to connect")
	if wrappedErr == nil {
		t.Fatal("Expected wrapped error, got nil")
	}
	if !errors.IsConnectionError(wrappedErr) {
		t.Error("Expected connection error")
	}
}

func TestWrapProtocolError(t *testing.T) {
	originalErr := stderrors.New("invalid packet")
	wrappedErr := errors.WrapProtocolError(originalErr, 0, "Protocol error")
	if wrappedErr == nil {
		t.Fatal("Expected wrapped error, got nil")
	}
	if !errors.IsProtocolError(wrappedErr) {
		t.Error("Expected protocol error")
	}
}

func TestWrapCommandError(t *testing.T) {
	originalErr := stderrors.New("command failed")
	wrappedErr := errors.WrapCommandError(originalErr, 0, "Command execution failed")
	if wrappedErr == nil {
		t.Fatal("Expected wrapped error, got nil")
	}
	if !errors.IsCommandError(wrappedErr) {
		t.Error("Expected command error")
	}
}

func TestWrapInputError(t *testing.T) {
	originalErr := stderrors.New("invalid format")
	wrappedErr := errors.WrapInputError(originalErr, 0, "Input validation failed")
	if wrappedErr == nil {
		t.Fatal("Expected wrapped error, got nil")
	}
	if !errors.IsInputError(wrappedErr) {
		t.Error("Expected input error")
	}
}

func TestWrapInternalError(t *testing.T) {
	originalErr := stderrors.New("internal failure")
	wrappedErr := errors.WrapInternalError(originalErr, 0, "Internal error occurred")
	if wrappedErr == nil {
		t.Fatal("Expected wrapped error, got nil")
	}
	if !errors.IsInternalError(wrappedErr) {
		t.Error("Expected internal error")
	}
}

func TestNewInputError(t *testing.T) {
	err := errors.NewInputError(errors.ErrInvalidInput, "Invalid input")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	var apiErr *errors.APIError
	if !stderrors.As(err, &apiErr) {
		t.Fatal("Expected APIError type")
	}
	if apiErr.Type != errors.ErrorTypeInput {
		t.Errorf("Expected error type %d, got %d", errors.ErrorTypeInput, apiErr.Type)
	}
	if apiErr.Code != errors.ErrInvalidInput {
		t.Errorf("Expected error code %d, got %d", errors.ErrInvalidInput, apiErr.Code)
	}
}

func TestNewConnectionError(t *testing.T) {
	err := errors.NewConnectionError(errors.ErrConnectionFailed, "Connection failed")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	var apiErr *errors.APIError
	if !stderrors.As(err, &apiErr) {
		t.Fatal("Expected APIError type")
	}
	if apiErr.Type != errors.ErrorTypeConnection {
		t.Errorf("Expected error type %d, got %d", errors.ErrorTypeConnection, apiErr.Type)
	}
	if apiErr.Code != errors.ErrConnectionFailed {
		t.Errorf("Expected error code %d, got %d", errors.ErrConnectionFailed, apiErr.Code)
	}
}

func TestNewProtocolError(t *testing.T) {
	err := errors.NewProtocolError(errors.ErrProtocolError, "Protocol error")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	var apiErr *errors.APIError
	if !stderrors.As(err, &apiErr) {
		t.Fatal("Expected APIError type")
	}
	if apiErr.Type != errors.ErrorTypeProtocol {
		t.Errorf("Expected error type %d, got %d", errors.ErrorTypeProtocol, apiErr.Type)
	}
	if apiErr.Code != errors.ErrProtocolError {
		t.Errorf("Expected error code %d, got %d", errors.ErrProtocolError, apiErr.Code)
	}
}

func TestNewCommandError(t *testing.T) {
	err := errors.NewCommandError(errors.ErrCommandFailed, "Command failed")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	var apiErr *errors.APIError
	if !stderrors.As(err, &apiErr) {
		t.Fatal("Expected APIError type")
	}
	if apiErr.Type != errors.ErrorTypeCommand {
		t.Errorf("Expected error type %d, got %d", errors.ErrorTypeCommand, apiErr.Type)
	}
	if apiErr.Code != errors.ErrCommandFailed {
		t.Errorf("Expected error code %d, got %d", errors.ErrCommandFailed, apiErr.Code)
	}
}

func TestNewInternalError(t *testing.T) {
	err := errors.NewInternalError(errors.ErrInternal, "Internal error")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	var apiErr *errors.APIError
	if !stderrors.As(err, &apiErr) {
		t.Fatal("Expected APIError type")
	}
	if apiErr.Type != errors.ErrorTypeInternal {
		t.Errorf("Expected error type %d, got %d", errors.ErrorTypeInternal, apiErr.Type)
	}
	if apiErr.Code != errors.ErrInternal {
		t.Errorf("Expected error code %d, got %d", errors.ErrInternal, apiErr.Code)
	}
}

func TestErrorTypeToString(t *testing.T) {
	tests := []struct {
		errorType errors.ErrorType
		expected  string
	}{
		{errors.ErrorTypeInput, "input"},
		{errors.ErrorTypeConnection, "connection"},
		{errors.ErrorTypeProtocol, "protocol"},
		{errors.ErrorTypeCommand, "command"},
		{errors.ErrorTypeInternal, "internal"},
		{errors.ErrorType(999), "unknown"},
	}

	for _, test := range tests {
		result := errors.ErrorTypeToString(test.errorType)
		if result != test.expected {
			t.Errorf("Expected '%s', got '%s'", test.expected, result)
		}
	}
}

func TestGetErrorCodeType(t *testing.T) {
	tests := []struct {
		code     errors.ErrorCode
		expected errors.ErrorType
	}{
		{errors.ErrInvalidInput, errors.ErrorTypeInput},
		{errors.ErrConnectionFailed, errors.ErrorTypeConnection},
		{errors.ErrProtocolError, errors.ErrorTypeProtocol},
		{errors.ErrCommandFailed, errors.ErrorTypeCommand},
		{errors.ErrInternal, errors.ErrorTypeInternal},
	}

	for _, test := range tests {
		result := errors.GetErrorCodeType(test.code)
		if result != test.expected {
			t.Errorf("Expected error type %d, got %d", test.expected, result)
		}
	}
}

func TestGetExitCode(t *testing.T) {
	tests := []struct {
		code     errors.ErrorCode
		expected int
	}{
		{errors.ErrInvalidInput, 1},
		{errors.ErrConnectionFailed, 2},
		{errors.ErrProtocolError, 3},
		{errors.ErrCommandFailed, 4},
		{errors.ErrInternal, 5},
	}

	for _, test := range tests {
		result := errors.GetExitCode(test.code)
		if result != test.expected {
			t.Errorf("Expected exit code %d, got %d", test.expected, result)
		}
	}
}

func TestGetErrorMessage(t *testing.T) {
	tests := []struct {
		code     errors.ErrorCode
		expected string
	}{
		{errors.ErrInvalidInput, "Invalid input"},
		{errors.ErrConnectionFailed, "Connection failed"},
		{errors.ErrProtocolError, "Protocol error"},
		{errors.ErrCommandFailed, "Command failed"},
		{errors.ErrInternal, "Internal error"},
	}

	for _, test := range tests {
		result := errors.GetErrorMessage(test.code)
		if result != test.expected {
			t.Errorf("Expected message '%s', got '%s'", test.expected, result)
		}
	}
}

func TestIsErrorType(t *testing.T) {
	err := errors.NewAPIError(errors.ErrorTypeConnection, errors.ErrConnectionFailed, "Connection failed", nil)
	if !errors.IsErrorType(err, errors.ErrorTypeConnection) {
		t.Error("Expected error type to be connection")
	}
	if errors.IsErrorType(err, errors.ErrorTypeProtocol) {
		t.Error("Expected error type not to be protocol")
	}
}

func TestIsConnectionError(t *testing.T) {
	err := errors.NewConnectionError(errors.ErrConnectionFailed, "Connection failed")
	if !errors.IsConnectionError(err) {
		t.Error("Expected connection error")
	}
}

func TestIsProtocolError(t *testing.T) {
	err := errors.NewProtocolError(errors.ErrProtocolError, "Protocol error")
	if !errors.IsProtocolError(err) {
		t.Error("Expected protocol error")
	}
}

func TestIsCommandError(t *testing.T) {
	err := errors.NewCommandError(errors.ErrCommandFailed, "Command failed")
	if !errors.IsCommandError(err) {
		t.Error("Expected command error")
	}
}

func TestIsInputError(t *testing.T) {
	err := errors.NewInputError(errors.ErrInvalidInput, "Invalid input")
	if !errors.IsInputError(err) {
		t.Error("Expected input error")
	}
}

func TestIsInternalError(t *testing.T) {
	err := errors.NewInternalError(errors.ErrInternal, "Internal error")
	if !errors.IsInternalError(err) {
		t.Error("Expected internal error")
	}
}

func TestValidateRequired(t *testing.T) {
	tests := []struct {
		name      string
		fieldName string
		value     interface{}
		wantErr   bool
	}{
		{"Valid string", "name", "test", false},
		{"Empty string", "name", "", true},
		{"Whitespace string", "name", "  ", true},
		{"Valid int", "age", 25, false},
		{"Nil", "name", nil, true},
		{"Empty slice", "items", []string{}, true},
		{"Non-empty slice", "items", []string{"a"}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := errors.ValidateRequired(tt.fieldName, tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRequired() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateRange(t *testing.T) {
	tests := []struct {
		name      string
		fieldName string
		value     int
		min       int
		max       int
		wantErr   bool
	}{
		{"Valid range", "age", 25, 0, 100, false},
		{"Below min", "age", -1, 0, 100, true},
		{"Above max", "age", 101, 0, 100, true},
		{"At min", "age", 0, 0, 100, false},
		{"At max", "age", 100, 0, 100, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := errors.ValidateRange(tt.fieldName, tt.value, tt.min, tt.max)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRange() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidatePositive(t *testing.T) {
	tests := []struct {
		name      string
		fieldName string
		value     int
		wantErr   bool
	}{
		{"Positive", "age", 25, false},
		{"Zero", "age", 0, true},
		{"Negative", "age", -1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := errors.ValidatePositive(tt.fieldName, tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePositive() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateNonNegative(t *testing.T) {
	tests := []struct {
		name      string
		fieldName string
		value     int
		wantErr   bool
	}{
		{"Positive", "age", 25, false},
		{"Zero", "age", 0, false},
		{"Negative", "age", -1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := errors.ValidateNonNegative(tt.fieldName, tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateNonNegative() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
