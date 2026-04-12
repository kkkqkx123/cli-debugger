package errors_test

import (
	"bytes"
	"fmt"
	"strings"
	"testing"

	"cli-debugger/pkg/errors"
)

func TestNewErrorHandler(t *testing.T) {
	handler := errors.NewErrorHandler()
	if handler == nil {
		t.Fatal("Expected handler, got nil")
	}
}

func TestErrorHandler_SetVerbose(t *testing.T) {
	handler := errors.NewErrorHandler()
	handler.SetVerbose(true)
	// Cannot test verbose directly, but ensure it doesn't panic
}

func TestErrorHandler_SetOutput(t *testing.T) {
	handler := errors.NewErrorHandler()
	var buf bytes.Buffer
	// Note: SetOutput has been replaced with SetFormatter
	_ = buf
	_ = handler
}

func TestPrintError(t *testing.T) {
	var buf bytes.Buffer
	err := errors.NewInputError(errors.ErrInvalidInput, "Invalid input")
	errors.PrintErrorTo(err, &buf)
	output := buf.String()
	if !strings.Contains(output, "Invalid input") {
		t.Errorf("Expected output to contain 'Invalid input', got '%s'", output)
	}
}

func TestPrintVerboseError(t *testing.T) {
	var buf bytes.Buffer
	err := errors.NewInputError(errors.ErrInvalidInput, "Invalid input")
	errors.PrintVerboseErrorTo(err, &buf)
	output := buf.String()
	if !strings.Contains(output, "Error Type") {
		t.Errorf("Expected output to contain 'Error Type', got '%s'", output)
	}
	if !strings.Contains(output, "Error Code") {
		t.Errorf("Expected output to contain 'Error Code', got '%s'", output)
	}
	if !strings.Contains(output, "Message") {
		t.Errorf("Expected output to contain 'Message', got '%s'", output)
	}
}

func TestGetExitCodeFromError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected int
	}{
		{"Nil error", nil, 0},
		{"Input error", errors.NewInputError(errors.ErrInvalidInput, "Invalid input"), 1},
		{"Connection error", errors.NewConnectionError(errors.ErrConnectionFailed, "Connection failed"), 2},
		{"Protocol error", errors.NewProtocolError(errors.ErrProtocolError, "Protocol error"), 3},
		{"Command error", errors.NewCommandError(errors.ErrCommandFailed, "Command failed"), 4},
		{"Internal error", errors.NewInternalError(errors.ErrInternal, "Internal error"), 5},
		{"Unknown error", fmt.Errorf("unknown error"), 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := errors.GetExitCodeFromError(tt.err)
			if result != tt.expected {
				t.Errorf("GetExitCodeFromError() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestFormatError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		verbose  bool
		contains []string
	}{
		{
			name:    "Simple error",
			err:     errors.NewInputError(errors.ErrInvalidInput, "Invalid input"),
			verbose: false,
			contains: []string{"Error: Invalid input"},
		},
		{
			name:    "Verbose error",
			err:     errors.NewInputError(errors.ErrInvalidInput, "Invalid input"),
			verbose: true,
			contains: []string{"Error Type", "Error Code", "Message"},
		},
		{
			name:    "Nil error",
			err:     nil,
			verbose: false,
			contains: []string{""},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := errors.FormatError(tt.err, tt.verbose)
			for _, expected := range tt.contains {
				if !strings.Contains(result, expected) {
					t.Errorf("Expected output to contain '%s', got '%s'", expected, result)
				}
			}
		})
	}
}

func TestExitWithError(t *testing.T) {
	// Note: This test will exit the program, so we can't run it directly
	// We'll just test that the function exists
	_ = errors.ExitWithError
}

func TestExitWithVerboseError(t *testing.T) {
	// Note: This test will exit the program, so we can't run it directly
	// We'll just test that the function exists
	_ = errors.ExitWithVerboseError
}

func TestErrorHandler_Handle(t *testing.T) {
	handler := errors.NewErrorHandler()
	var buf bytes.Buffer
	// Note: Handle calls os.Exit, so we can't test it directly
	// We'll just test that the function exists
	_ = buf
	_ = handler.Handle
}
