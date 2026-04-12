package output

import (
	"io"

	"cli-debugger/pkg/types"
)

// Formatter 输出格式化接口
type Formatter interface {
	// 格式化版本信息
	FormatVersion(info *types.VersionInfo) error
	// 格式化线程列表
	FormatThreads(threads []*types.ThreadInfo) error
	// 格式化调用栈
	FormatStack(frames []*types.StackFrame) error
	// 格式化变量列表
	FormatVariables(variables []*types.Variable) error
	// 格式化断点列表
	FormatBreakpoints(breakpoints []*types.BreakpointInfo) error
	// 格式化调试事件
	FormatEvent(event *types.DebugEvent) error
	// 格式化错误
	FormatError(err error) error
	// 设置输出写入器
	SetWriter(writer io.Writer)
}

// FormatterType 格式化器类型
type FormatterType string

const (
	// TextFormatter 文本格式化器
	TextFormatter FormatterType = "text"
	// JSONFormatter JSON格式化器
	JSONFormatter FormatterType = "json"
	// TableFormatter 表格格式化器
	TableFormatter FormatterType = "table"
)

// FormatterFactory 格式化器工厂函数
type FormatterFactory func(color bool) Formatter

// NewFormatter 创建格式化器
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

// GetFormatterType 获取格式化器类型
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