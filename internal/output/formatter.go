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
	// Setting the Output Writer
	SetWriter(writer io.Writer)
}

// FormatterType Formatter type
type FormatterType string

const (
	// TextFormatter Text Formatter
	TextFormatter FormatterType = "text"
	// JSONFormatter JSON Formatter
	JSONFormatter FormatterType = "json"
	// TableFormatter Table Formatter
	TableFormatter FormatterType = "table"
)

// FormatterFactory Formatter factory function
type FormatterFactory func(color bool) Formatter

// NewFormatter Creates a formatter
func NewFormatter(formatterType FormatterType, color bool) Formatter {
	switch formatterType {
	case JSONFormatter:
		return NewJSONFormatter()
	case TableFormatter:
		return NewTableFormatter(color)
	default:
		return NewTextFormatter(color)
	}
}

// GetFormatterType Get Formatter Type
func GetFormatterType(outputFormat string) FormatterType {
	switch outputFormat {
	case "json":
		return JSONFormatter
	case "table":
		return TableFormatter
	default:
		return TextFormatter
	}
}