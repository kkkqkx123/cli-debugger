package output

import (
	"encoding/json"
	"io"
	"os"

	"cli-debugger/pkg/types"
)

// JSONFormatter JSON Formatter
type JSONFormatter struct {
	writer io.Writer
}

// NewJSONFormatter Creates a JSON formatter.
func NewJSONFormatter() *JSONFormatter {
	return &JSONFormatter{
		writer: os.Stdout,
	}
}

// SetWriter Sets the output writer
func (f *JSONFormatter) SetWriter(writer io.Writer) {
	f.writer = writer
}

// FormatVersion Formatting version information
func (f *JSONFormatter) FormatVersion(info *types.VersionInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":    "version",
		"version": info,
	})
}

// FormatThreads Format threads list
func (f *JSONFormatter) FormatThreads(threads []*types.ThreadInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":    "threads",
		"count":   len(threads),
		"threads": threads,
	})
}

// FormatStack Format call stack
func (f *JSONFormatter) FormatStack(frames []*types.StackFrame) error {
	return f.encodeJSON(map[string]interface{}{
		"type":   "stack",
		"count":  len(frames),
		"frames": frames,
	})
}

// FormatVariables Format variable list
func (f *JSONFormatter) FormatVariables(variables []*types.Variable) error {
	return f.encodeJSON(map[string]interface{}{
		"type":      "variables",
		"count":     len(variables),
		"variables": variables,
	})
}

// FormatBreakpoints Format the breakpoint list.
func (f *JSONFormatter) FormatBreakpoints(breakpoints []*types.BreakpointInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":        "breakpoints",
		"count":       len(breakpoints),
		"breakpoints": breakpoints,
	})
}

// FormatEvent Format debug event
func (f *JSONFormatter) FormatEvent(event *types.DebugEvent) error {
	return f.encodeJSON(map[string]interface{}{
		"type": "event",
		"event": event,
	})
}

// FormatError Formatting error
func (f *JSONFormatter) FormatError(err error) error {
	return f.encodeJSON(map[string]interface{}{
		"type": "error",
		"error": map[string]interface{}{
			"message": err.Error(),
		},
	})
}

// encodeJSON Encoding JSON
func (f *JSONFormatter) encodeJSON(data interface{}) error {
	encoder := json.NewEncoder(f.writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}