package output

import (
	"encoding/json"
	"io"
	"os"

	"cli-debugger/pkg/errors"
	"cli-debugger/pkg/types"
)

// jsonFormatter JSON Formatter
type jsonFormatter struct {
	writer io.Writer
}

// NewJSONFormatter Creates a JSON formatter.
func NewJSONFormatter() Formatter {
	return &jsonFormatter{
		writer: os.Stdout,
	}
}

// SetWriter Sets the output writer
func (f *jsonFormatter) SetWriter(writer io.Writer) {
	f.writer = writer
}

// FormatVersion Formatting version information
func (f *jsonFormatter) FormatVersion(info *types.VersionInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":    "version",
		"version": info,
	})
}

// FormatThreads Format threads list
func (f *jsonFormatter) FormatThreads(threads []*types.ThreadInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":    "threads",
		"count":   len(threads),
		"threads": threads,
	})
}

// FormatStack Format call stack
func (f *jsonFormatter) FormatStack(frames []*types.StackFrame) error {
	return f.encodeJSON(map[string]interface{}{
		"type":   "stack",
		"count":  len(frames),
		"frames": frames,
	})
}

// FormatVariables Format variable list
func (f *jsonFormatter) FormatVariables(variables []*types.Variable) error {
	return f.encodeJSON(map[string]interface{}{
		"type":      "variables",
		"count":     len(variables),
		"variables": variables,
	})
}

// FormatBreakpoints Format the breakpoint list.
func (f *jsonFormatter) FormatBreakpoints(breakpoints []*types.BreakpointInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":        "breakpoints",
		"count":       len(breakpoints),
		"breakpoints": breakpoints,
	})
}

// FormatEvent Format debug event
func (f *jsonFormatter) FormatEvent(event *types.DebugEvent) error {
	return f.encodeJSON(map[string]interface{}{
		"type":  "event",
		"event": event,
	})
}

// FormatError Formatting error
func (f *jsonFormatter) FormatError(err error) error {
	return f.encodeJSON(map[string]interface{}{
		"type": "error",
		"error": map[string]interface{}{
			"type":    err.(*errors.APIError).Type,
			"code":    err.(*errors.APIError).Code,
			"message": err.(*errors.APIError).Message,
			"cause":   err.(*errors.APIError).Cause,
		},
	})
}

// FormatVerboseError Formatting verbose error
func (f *jsonFormatter) FormatVerboseError(err error) error {
	return f.encodeJSON(map[string]interface{}{
		"type": "error",
		"error": map[string]interface{}{
			"type":    err.(*errors.APIError).Type,
			"code":    err.(*errors.APIError).Code,
			"message": err.(*errors.APIError).Message,
			"cause":   err.(*errors.APIError).Cause,
		},
	})
}

// encodeJSON Encoding JSON
func (f *jsonFormatter) encodeJSON(data interface{}) error {
	encoder := json.NewEncoder(f.writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}