package output

import (
	"io"

	"cli-debugger/pkg/types"
)

// Formatter output formatting interface
type Formatter interface {
	// Formatting version information
	FormatVersion(info *types.VersionInfo) error
	// Formatting the thread list
	FormatThreads(threads []*types.ThreadInfo) error
	// Formatting the call stack
	FormatStack(frames []*types.StackFrame) error
	// Formatting a list of variables
	FormatVariables(variables []*types.Variable) error
	// Formatting the Breakpoint List
	FormatBreakpoints(breakpoints []*types.BreakpointInfo) error
	// Formatting debug events
	FormatEvent(event *types.DebugEvent) error
	// formatting error
	FormatError(err error) error
	// formatting verbose error
	FormatVerboseError(err error) error
	// Setting the Output Writer
	SetWriter(writer io.Writer)
}

// FormatterType Formatter type
type FormatterType string

const (
	// TextFormatType Text Formatter
	TextFormatType FormatterType = "text"
	// JSONFormatType JSON Formatter
	JSONFormatType FormatterType = "json"
	// TableFormatType Table Formatter
	TableFormatType FormatterType = "table"
)

// FormatterFactory Formatter factory function
type FormatterFactory func(color bool) Formatter

// NewFormatter Creates a formatter
func NewFormatter(formatterType FormatterType, color bool) Formatter {
	switch formatterType {
	case JSONFormatType:
		return NewJSONFormatter()
	case TableFormatType:
		return NewTableFormatter(color)
	default:
		return NewTextFormatter(color)
	}
}

// GetFormatterType Get Formatter Type
func GetFormatterType(outputFormat string) FormatterType {
	switch outputFormat {
	case "json":
		return JSONFormatType
	case "table":
		return TableFormatType
	default:
		return TextFormatType
	}
}