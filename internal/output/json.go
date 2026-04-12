package output

import (
	"encoding/json"
	"io"
	"os"

	"cli-debugger/pkg/types"
)

// JSONFormatter JSON格式化器
type JSONFormatter struct {
	writer io.Writer
}

// NewJSONFormatter 创建JSON格式化器
func NewJSONFormatter() *JSONFormatter {
	return &JSONFormatter{
		writer: os.Stdout,
	}
}

// SetWriter 设置输出写入器
func (f *JSONFormatter) SetWriter(writer io.Writer) {
	f.writer = writer
}

// FormatVersion 格式化版本信息
func (f *JSONFormatter) FormatVersion(info *types.VersionInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":    "version",
		"version": info,
	})
}

// FormatThreads 格式化线程列表
func (f *JSONFormatter) FormatThreads(threads []*types.ThreadInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":    "threads",
		"count":   len(threads),
		"threads": threads,
	})
}

// FormatStack 格式化调用栈
func (f *JSONFormatter) FormatStack(frames []*types.StackFrame) error {
	return f.encodeJSON(map[string]interface{}{
		"type":   "stack",
		"count":  len(frames),
		"frames": frames,
	})
}

// FormatVariables 格式化变量列表
func (f *JSONFormatter) FormatVariables(variables []*types.Variable) error {
	return f.encodeJSON(map[string]interface{}{
		"type":      "variables",
		"count":     len(variables),
		"variables": variables,
	})
}

// FormatBreakpoints 格式化断点列表
func (f *JSONFormatter) FormatBreakpoints(breakpoints []*types.BreakpointInfo) error {
	return f.encodeJSON(map[string]interface{}{
		"type":        "breakpoints",
		"count":       len(breakpoints),
		"breakpoints": breakpoints,
	})
}

// FormatEvent 格式化调试事件
func (f *JSONFormatter) FormatEvent(event *types.DebugEvent) error {
	return f.encodeJSON(map[string]interface{}{
		"type": "event",
		"event": event,
	})
}

// FormatError 格式化错误
func (f *JSONFormatter) FormatError(err error) error {
	return f.encodeJSON(map[string]interface{}{
		"type": "error",
		"error": map[string]interface{}{
			"message": err.Error(),
		},
	})
}

// encodeJSON 编码JSON
func (f *JSONFormatter) encodeJSON(data interface{}) error {
	encoder := json.NewEncoder(f.writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}