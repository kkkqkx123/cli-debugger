package output

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/fatih/color"
	"cli-debugger/pkg/types"
)

// TextFormatter 文本格式化器
type TextFormatter struct {
	writer io.Writer
	color  bool
}

// NewTextFormatter 创建文本格式化器
func NewTextFormatter(color bool) *TextFormatter {
	return &TextFormatter{
		writer: os.Stdout,
		color:  color,
	}
}

// SetWriter 设置输出写入器
func (f *TextFormatter) SetWriter(writer io.Writer) {
	f.writer = writer
}

// FormatVersion 格式化版本信息
func (f *TextFormatter) FormatVersion(info *types.VersionInfo) error {
	if f.color {
		cyan := color.New(color.FgCyan).SprintFunc()
		green := color.New(color.FgGreen).SprintFunc()
		magenta := color.New(color.FgMagenta).SprintFunc()

		fmt.Fprintf(f.writer, "%s: %s\n", cyan("协议版本"), info.ProtocolVersion)
		fmt.Fprintf(f.writer, "%s: %s\n", green("运行时版本"), info.RuntimeVersion)
		fmt.Fprintf(f.writer, "%s: %s\n", magenta("运行时名称"), info.RuntimeName)
		if info.Description != "" {
			fmt.Fprintf(f.writer, "%s: %s\n", cyan("描述"), info.Description)
		}
	} else {
		fmt.Fprintf(f.writer, "协议版本: %s\n", info.ProtocolVersion)
		fmt.Fprintf(f.writer, "运行时版本: %s\n", info.RuntimeVersion)
		fmt.Fprintf(f.writer, "运行时名称: %s\n", info.RuntimeName)
		if info.Description != "" {
			fmt.Fprintf(f.writer, "描述: %s\n", info.Description)
		}
	}
	return nil
}

// FormatThreads 格式化线程列表
func (f *TextFormatter) FormatThreads(threads []*types.ThreadInfo) error {
	if len(threads) == 0 {
		f.printColored("没有找到线程", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d):\n", header("线程列表"), len(threads))
	} else {
		fmt.Fprintf(f.writer, "线程列表 (%d):\n", len(threads))
	}

	for i, thread := range threads {
		f.formatThread(i, thread)
	}

	return nil
}

// formatThread 格式化单个线程
func (f *TextFormatter) formatThread(index int, thread *types.ThreadInfo) {
	stateColor := f.getThreadStateColor(thread.State)
	daemonStr := ""
	if thread.IsDaemon {
		daemonStr = " [守护线程]"
	}

	if f.color {
		idColor := color.New(color.FgYellow).SprintFunc()
		nameColor := color.New(color.FgGreen).SprintFunc()
		stateColorFunc := color.New(stateColor).SprintFunc()
		priorityColor := color.New(color.FgMagenta).SprintFunc()

		fmt.Fprintf(f.writer, "  %2d. %s %s (%s) 优先级: %s%s\n",
			index+1,
			idColor(thread.ID),
			nameColor(thread.Name),
			stateColorFunc(thread.State),
			priorityColor(fmt.Sprintf("%d", thread.Priority)),
			daemonStr)
	} else {
		fmt.Fprintf(f.writer, "  %2d. %s %s (%s) 优先级: %d%s\n",
			index+1,
			thread.ID,
			thread.Name,
			thread.State,
			thread.Priority,
			daemonStr)
	}
}

// getThreadStateColor 获取线程状态对应的颜色
func (f *TextFormatter) getThreadStateColor(state string) color.Attribute {
	if !f.color {
		return color.FgWhite
	}

	switch strings.ToLower(state) {
	case "running", "run":
		return color.FgGreen
	case "suspended", "suspend":
		return color.FgYellow
	case "waiting", "wait":
		return color.FgCyan
	case "blocked", "block":
		return color.FgRed
	case "terminated", "term":
		return color.FgHiBlack
	default:
		return color.FgWhite
	}
}

// FormatStack 格式化调用栈
func (f *TextFormatter) FormatStack(frames []*types.StackFrame) error {
	if len(frames) == 0 {
		f.printColored("调用栈为空", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d 帧):\n", header("调用栈"), len(frames))
	} else {
		fmt.Fprintf(f.writer, "调用栈 (%d 帧):\n", len(frames))
	}

	for i, frame := range frames {
		f.formatStackFrame(i, frame)
	}

	return nil
}

// formatStackFrame 格式化单个栈帧
func (f *TextFormatter) formatStackFrame(index int, frame *types.StackFrame) {
	nativeStr := ""
	if frame.IsNative {
		nativeStr = " [本地方法]"
	}

	if f.color {
		frameColor := color.New(color.FgYellow).SprintFunc()
		methodColor := color.New(color.FgGreen).SprintFunc()
		locationColor := color.New(color.FgCyan).SprintFunc()
		lineColor := color.New(color.FgMagenta).SprintFunc()

		fmt.Fprintf(f.writer, "  #%2d %s at %s:%s%s\n",
			index,
			methodColor(frame.Method),
			locationColor(frame.Location),
			lineColor(fmt.Sprintf("%d", frame.Line)),
			nativeStr)
	} else {
		fmt.Fprintf(f.writer, "  #%2d %s at %s:%d%s\n",
			index,
			frame.Method,
			frame.Location,
			frame.Line,
			nativeStr)
	}
}

// FormatVariables 格式化变量列表
func (f *TextFormatter) FormatVariables(variables []*types.Variable) error {
	if len(variables) == 0 {
		f.printColored("没有变量", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d):\n", header("变量列表"), len(variables))
	} else {
		fmt.Fprintf(f.writer, "变量列表 (%d):\n", len(variables))
	}

	for _, variable := range variables {
		f.formatVariable(variable)
	}

	return nil
}

// formatVariable 格式化单个变量
func (f *TextFormatter) formatVariable(variable *types.Variable) {
	valueStr := f.formatValue(variable.Value)
	nullStr := ""
	if variable.IsNull {
		nullStr = " [null]"
	}

	if f.color {
		nameColor := color.New(color.FgGreen).SprintFunc()
		typeColor := color.New(color.FgYellow).SprintFunc()
		valueColor := f.getValueColor(variable.Value)

		fmt.Fprintf(f.writer, "  %s: %s = %s%s\n",
			nameColor(variable.Name),
			typeColor(variable.Type),
			valueColor(valueStr),
			nullStr)
	} else {
		fmt.Fprintf(f.writer, "  %s: %s = %s%s\n",
			variable.Name,
			variable.Type,
			valueStr,
			nullStr)
	}
}

// formatValue 格式化值
func (f *TextFormatter) formatValue(value interface{}) string {
	if value == nil {
		return "<nil>"
	}

	switch v := value.(type) {
	case string:
		return fmt.Sprintf("\"%s\"", v)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%v", v)
	case float32, float64:
		return fmt.Sprintf("%v", v)
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// getValueColor 获取值对应的颜色
func (f *TextFormatter) getValueColor(value interface{}) func(...interface{}) string {
	if !f.color {
		return fmt.Sprint
	}

	switch value.(type) {
	case string:
		return color.New(color.FgGreen).SprintFunc()
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return color.New(color.FgYellow).SprintFunc()
	case float32, float64:
		return color.New(color.FgMagenta).SprintFunc()
	case bool:
		return color.New(color.FgCyan).SprintFunc()
	default:
		return color.New(color.FgWhite).SprintFunc()
	}
}

// FormatBreakpoints 格式化断点列表
func (f *TextFormatter) FormatBreakpoints(breakpoints []*types.BreakpointInfo) error {
	if len(breakpoints) == 0 {
		f.printColored("没有断点", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d):\n", header("断点列表"), len(breakpoints))
	} else {
		fmt.Fprintf(f.writer, "断点列表 (%d):\n", len(breakpoints))
	}

	for i, bp := range breakpoints {
		f.formatBreakpoint(i, bp)
	}

	return nil
}

// formatBreakpoint 格式化单个断点
func (f *TextFormatter) formatBreakpoint(index int, bp *types.BreakpointInfo) {
	enabledStr := ""
	if !bp.Enabled {
		enabledStr = " [已禁用]"
	}

	hitCountStr := ""
	if bp.HitCount > 0 {
		hitCountStr = fmt.Sprintf(" 命中: %d", bp.HitCount)
	}

	conditionStr := ""
	if bp.Condition != "" {
		conditionStr = fmt.Sprintf(" 条件: %s", bp.Condition)
	}

	if f.color {
		idColor := color.New(color.FgYellow).SprintFunc()
		locationColor := color.New(color.FgGreen).SprintFunc()
		hitCountColor := color.New(color.FgMagenta).SprintFunc()
		conditionColor := color.New(color.FgCyan).SprintFunc()

		fmt.Fprintf(f.writer, "  %2d. %s at %s%s%s%s\n",
			index+1,
			idColor(bp.ID),
			locationColor(bp.Location),
			enabledStr,
			hitCountColor(hitCountStr),
			conditionColor(conditionStr))
	} else {
		fmt.Fprintf(f.writer, "  %2d. %s at %s%s%s%s\n",
			index+1,
			bp.ID,
			bp.Location,
			enabledStr,
			hitCountStr,
			conditionStr)
	}
}

// FormatEvent 格式化调试事件
func (f *TextFormatter) FormatEvent(event *types.DebugEvent) error {
	if f.color {
		eventTypeColor := color.New(color.FgCyan, color.Bold).SprintFunc()
		threadColor := color.New(color.FgYellow).SprintFunc()
		locationColor := color.New(color.FgGreen).SprintFunc()
		timeColor := color.New(color.FgHiBlack).SprintFunc()

		fmt.Fprintf(f.writer, "%s 事件: 线程 %s at %s (%s)\n",
			eventTypeColor(event.Type),
			threadColor(event.ThreadID),
			locationColor(event.Location),
			timeColor(event.Timestamp.Format(time.RFC3339)))
	} else {
		fmt.Fprintf(f.writer, "%s 事件: 线程 %s at %s (%s)\n",
			event.Type,
			event.ThreadID,
			event.Location,
			event.Timestamp.Format(time.RFC3339))
	}

	if event.Data != nil {
		fmt.Fprintf(f.writer, "数据: %v\n", event.Data)
	}

	return nil
}

// FormatError 格式化错误
func (f *TextFormatter) FormatError(err error) error {
	if f.color {
		errorColor := color.New(color.FgRed, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s: %v\n", errorColor("错误"), err)
	} else {
		fmt.Fprintf(f.writer, "错误: %v\n", err)
	}
	return nil
}

// printColored 打印彩色文本
func (f *TextFormatter) printColored(text string, attr color.Attribute) {
	if f.color {
		colorFunc := color.New(attr).SprintFunc()
		fmt.Fprintln(f.writer, colorFunc(text))
	} else {
		fmt.Fprintln(f.writer, text)
	}
}