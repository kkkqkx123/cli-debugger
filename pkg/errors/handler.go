package errors

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// ErrorFormatter Interface for error formatting
type ErrorFormatter interface {
	FormatError(err error) error
	FormatVerboseError(err error) error
	SetWriter(writer io.Writer)
}

// ErrorHandler Error handler interface
type ErrorHandler interface {
	Handle(err error)
	SetVerbose(verbose bool)
	SetFormatter(formatter ErrorFormatter)
}

// DefaultErrorHandler Default error handler
type DefaultErrorHandler struct {
	verbose   bool
	formatter ErrorFormatter
}

// NewErrorHandler Create a new error handler
func NewErrorHandler() ErrorHandler {
	return &DefaultErrorHandler{
		verbose: false,
	}
}

// SetVerbose Set verbose mode
func (h *DefaultErrorHandler) SetVerbose(verbose bool) {
	h.verbose = verbose
}

// SetFormatter Set error formatter
func (h *DefaultErrorHandler) SetFormatter(formatter ErrorFormatter) {
	h.formatter = formatter
}

// Handle Handle error
func (h *DefaultErrorHandler) Handle(err error) {
	if err == nil {
		return
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		// Unknown error type
		if h.formatter != nil {
			h.formatter.SetWriter(os.Stderr)
			h.formatter.FormatError(err)
		} else {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		}
		os.Exit(1)
	}

	// Print error message
	if h.verbose {
		// Verbose mode: print detailed error information
		h.printVerboseError(apiErr)
	} else {
		// Normal mode: print simple error message
		h.printSimpleError(apiErr)
	}

	// Exit with error code
	os.Exit(GetExitCode(apiErr.Code))
}

// printSimpleError Print simple error message
func (h *DefaultErrorHandler) printSimpleError(err *APIError) {
	if h.formatter != nil {
		h.formatter.SetWriter(os.Stderr)
		h.formatter.FormatError(err)
	} else {
		fmt.Fprintf(os.Stderr, "Error: %s\n", err.Message)
	}
}

// printVerboseError Print verbose error message
func (h *DefaultErrorHandler) printVerboseError(err *APIError) {
	if h.formatter != nil {
		h.formatter.SetWriter(os.Stderr)
		h.formatter.FormatVerboseError(err)
	} else {
		fmt.Fprintf(os.Stderr, "\n")
		fmt.Fprintf(os.Stderr, "Error Type: %s\n", ErrorTypeToString(err.Type))
		fmt.Fprintf(os.Stderr, "Error Code: %d\n", err.Code)
		fmt.Fprintf(os.Stderr, "Message: %s\n", err.Message)
		if err.Cause != nil {
			fmt.Fprintf(os.Stderr, "Cause: %v\n", err.Cause)
		}
		fmt.Fprintf(os.Stderr, "\n")
	}
}

// PrintError Print error to output
func PrintError(err error) {
	PrintErrorTo(err, os.Stderr)
}

// PrintErrorTo Print error to specified output
func PrintErrorTo(err error, output io.Writer) {
	if err == nil {
		return
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		fmt.Fprintf(output, "Error: %v\n", err)
		return
	}

	fmt.Fprintf(output, "Error: %s\n", apiErr.Message)
}

// PrintVerboseError Print verbose error to output
func PrintVerboseError(err error) {
	PrintVerboseErrorTo(err, os.Stderr)
}

// PrintVerboseErrorTo Print verbose error to specified output
func PrintVerboseErrorTo(err error, output io.Writer) {
	if err == nil {
		return
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		fmt.Fprintf(output, "Error: %v\n", err)
		return
	}

	fmt.Fprintf(output, "\n")
	fmt.Fprintf(output, "Error Type: %s\n", ErrorTypeToString(apiErr.Type))
	fmt.Fprintf(output, "Error Code: %d\n", apiErr.Code)
	fmt.Fprintf(output, "Message: %s\n", apiErr.Message)
	if apiErr.Cause != nil {
		fmt.Fprintf(output, "Cause: %v\n", apiErr.Cause)
	}
	fmt.Fprintf(output, "\n")
}

// ExitWithError Exit with error
func ExitWithError(err error) {
	if err == nil {
		return
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	PrintError(err)
	os.Exit(GetExitCode(apiErr.Code))
}

// ExitWithVerboseError Exit with verbose error
func ExitWithVerboseError(err error) {
	if err == nil {
		return
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	PrintVerboseError(err)
	os.Exit(GetExitCode(apiErr.Code))
}

// GetExitCodeFromError Get exit code from error
func GetExitCodeFromError(err error) int {
	if err == nil {
		return 0
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		return 1
	}

	return GetExitCode(apiErr.Code)
}

// FormatError Format error as string
func FormatError(err error, verbose bool) string {
	if err == nil {
		return ""
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		return fmt.Sprintf("Error: %v", err)
	}

	if verbose {
		var sb strings.Builder
		sb.WriteString("\n")
		sb.WriteString(fmt.Sprintf("Error Type: %s\n", ErrorTypeToString(apiErr.Type)))
		sb.WriteString(fmt.Sprintf("Error Code: %d\n", apiErr.Code))
		sb.WriteString(fmt.Sprintf("Message: %s\n", apiErr.Message))
		if apiErr.Cause != nil {
			sb.WriteString(fmt.Sprintf("Cause: %v\n", apiErr.Cause))
		}
		sb.WriteString("\n")
		return sb.String()
	}

	return fmt.Sprintf("Error: %s", apiErr.Message)
}

// ValidateRequired Validate required field
func ValidateRequired(fieldName string, value interface{}) error {
	if value == nil {
		return NewInputError(ErrMissingRequiredField, fmt.Sprintf("Field '%s' is required", fieldName))
	}

	switch v := value.(type) {
	case string:
		if strings.TrimSpace(v) == "" {
			return NewInputError(ErrMissingRequiredField, fmt.Sprintf("Field '%s' is required", fieldName))
		}
	case []string:
		if len(v) == 0 {
			return NewInputError(ErrMissingRequiredField, fmt.Sprintf("Field '%s' is required", fieldName))
		}
	}

	return nil
}

// ValidateRange Validate range
func ValidateRange(fieldName string, value int, min, max int) error {
	if value < min || value > max {
		return NewInputError(ErrOutOfRange, fmt.Sprintf("Field '%s' must be between %d and %d", fieldName, min, max))
	}
	return nil
}

// ValidatePositive Validate positive number
func ValidatePositive(fieldName string, value int) error {
	if value <= 0 {
		return NewInputError(ErrOutOfRange, fmt.Sprintf("Field '%s' must be greater than 0", fieldName))
	}
	return nil
}

// ValidateNonNegative Validate non-negative number
func ValidateNonNegative(fieldName string, value int) error {
	if value < 0 {
		return NewInputError(ErrOutOfRange, fmt.Sprintf("Field '%s' must be greater than or equal to 0", fieldName))
	}
	return nil
}
