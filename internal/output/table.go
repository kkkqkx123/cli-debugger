package output

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
	"cli-debugger/pkg/types"
)

// TableFormatter 表格格式化器
type TableFormatter struct {
	writer io.Writer
	color  bool
}

// NewTableFormatter 创建表格格式化器
func NewTableFormatter(color bool) *TableFormatter {
	return &TableFormatter{
		writer: os.Stdout,
		color:  color,
	}
}

// SetWriter 设置输出写入器
func (f *TableFormatter) SetWriter(writer io.Writer) {
	f.writer = writer
}

// FormatVersion 格式化版本信息
func (f *TableFormatter) FormatVersion(info *types.VersionInfo) error {
	table := tablewriter.NewWriter(f.writer)
	table.SetHeader([]string{"属性", "值"})
	table.SetBorder(false)
	table.SetAlignment(tablewriter.ALIGN_LEFT)

	if f.color {
		table.SetHeaderColor(
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgCyanColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgGreenColor},
		)
	}

	table.Append([]string{"协议版本", info.ProtocolVersion})
	table.Append([]string{"运行时版本", info.RuntimeVersion})
	table.Append([]string{"运行时名称", info.RuntimeName})
	if info.Description != "" {
		table.Append([]string{"描述", info.Description})
	}

	table.Render()
	return nil
}

// FormatThreads 格式化线程列表
func (f *TableFormatter) FormatThreads(threads []*types.ThreadInfo) error {
	if len(threads) == 0 {
		fmt.Fprintln(f.writer, "没有找到线程")
		return nil
	}

	table := tablewriter.NewWriter(f.writer)
	table.SetHeader([]string{"ID", "名称", "状态", "优先级", "守护线程", "挂起"})
	table.SetBorder(true)
	table.SetAutoWrapText(false)
	table.SetAutoFormatHeaders(true)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.SetCenterSeparator("|")
	table.SetColumnSeparator("|")
	table.SetRowSeparator("-")
	table.SetHeaderLine(true)
	table.SetTablePadding("\t")
	table.SetNoWhiteSpace(true)

	if f.color {
		table.SetHeaderColor(
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgCyanColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgGreenColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgYellowColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgMagentaColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgBlueColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgRedColor},
		)
	}

	for _, thread := range threads {
		row := []string{
			thread.ID,
			thread.Name,
			thread.State,
			strconv.Itoa(thread.Priority),
			f.formatBool(thread.IsDaemon),
			f.formatBool(thread.IsSuspended),
		}
		table.Append(row)
	}

	table.Render()
	fmt.Fprintf(f.writer, "\n总计: %d 个线程\n", len(threads))
	return nil
}

// FormatStack 格式化调用栈
func (f *TableFormatter) FormatStack(frames []*types.StackFrame) error {
	if len(frames) == 0 {
		fmt.Fprintln(f.writer, "调用栈为空")
		return nil
	}

	table := tablewriter.NewWriter(f.writer)
	table.SetHeader([]string{"#", "方法", "位置", "行号", "本地方法"})
	table.SetBorder(true)
	table.SetAutoWrapText(false)
	table.SetAutoFormatHeaders(true)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.SetCenterSeparator("|")
	table.SetColumnSeparator("|")
	table.SetRowSeparator("-")
	table.SetHeaderLine(true)
	table.SetTablePadding("\t")
	table.SetNoWhiteSpace(true)

	if f.color {
		table.SetHeaderColor(
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgCyanColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgGreenColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgYellowColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgMagentaColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgBlueColor},
		)
	}

	for i, frame := range frames {
		row := []string{
			strconv.Itoa(i),
			frame.Method,
			frame.Location,
			strconv.Itoa(frame.Line),
			f.formatBool(frame.IsNative),
		}
		table.Append(row)
	}

	table.Render()
	fmt.Fprintf(f.writer, "\n总计: %d 个栈帧\n", len(frames))
	return nil
}

// FormatVariables 格式化变量列表
func (f *TableFormatter) FormatVariables(variables []*types.Variable) error {
	if len(variables) == 0 {
		fmt.Fprintln(f.writer, "没有变量")
		return nil
	}

	table := tablewriter.NewWriter(f.writer)
	table.SetHeader([]string{"名称", "类型", "值", "原始类型", "空值"})
	table.SetBorder(true)
	table.SetAutoWrapText(false)
	table.SetAutoFormatHeaders(true)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.SetCenterSeparator("|")
	table.SetColumnSeparator("|")
	table.SetRowSeparator("-")
	table.SetHeaderLine(true)
	table.SetTablePadding("\t")
	table.SetNoWhiteSpace(true)

	if f.color {
		table.SetHeaderColor(
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgCyanColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgGreenColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgYellowColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgMagentaColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgBlueColor},
		)
	}

	for _, variable := range variables {
		valueStr := f.formatValue(variable.Value)
		row := []string{
			variable.Name,
			variable.Type,
			valueStr,
			f.formatBool(variable.IsPrimitive),
			f.formatBool(variable.IsNull),
		}
		table.Append(row)
	}

	table.Render()
	fmt.Fprintf(f.writer, "\n总计: %d 个变量\n", len(variables))
	return nil
}

// FormatBreakpoints 格式化断点列表
func (f *TableFormatter) FormatBreakpoints(breakpoints []*types.BreakpointInfo) error {
	if len(breakpoints) == 0 {
		fmt.Fprintln(f.writer, "没有断点")
		return nil
	}

	table := tablewriter.NewWriter(f.writer)
	table.SetHeader([]string{"ID", "位置", "启用", "命中次数", "条件"})
	table.SetBorder(true)
	table.SetAutoWrapText(false)
	table.SetAutoFormatHeaders(true)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.SetCenterSeparator("|")
	table.SetColumnSeparator("|")
	table.SetRowSeparator("-")
	table.SetHeaderLine(true)
	table.SetTablePadding("\t")
	table.SetNoWhiteSpace(true)

	if f.color {
		table.SetHeaderColor(
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgCyanColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgGreenColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgYellowColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgMagentaColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgBlueColor},
		)
	}

	for _, bp := range breakpoints {
		row := []string{
			bp.ID,
			bp.Location,
			f.formatBool(bp.Enabled),
			strconv.Itoa(bp.HitCount),
			bp.Condition,
		}
		table.Append(row)
	}

	table.Render()
	fmt.Fprintf(f.writer, "\n总计: %d 个断点\n", len(breakpoints))
	return nil
}

// FormatEvent 格式化调试事件
func (f *TableFormatter) FormatEvent(event *types.DebugEvent) error {
	table := tablewriter.NewWriter(f.writer)
	table.SetHeader([]string{"属性", "值"})
	table.SetBorder(false)
	table.SetAlignment(tablewriter.ALIGN_LEFT)

	if f.color {
		table.SetHeaderColor(
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgCyanColor},
			tablewriter.Colors{tablewriter.Bold, tablewriter.FgGreenColor},
		)
	}

	table.Append([]string{"事件类型", event.Type})
	table.Append([]string{"线程ID", event.ThreadID})
	table.Append([]string{"位置", event.Location})
	table.Append([]string{"时间戳", event.Timestamp.String()})

	if event.Data != nil {
		table.Append([]string{"数据", fmt.Sprintf("%v", event.Data)})
	}

	table.Render()
	return nil
}

// FormatError 格式化错误
func (f *TableFormatter) FormatError(err error) error {
	if f.color {
		errorColor := color.New(color.FgRed, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s: %v\n", errorColor("错误"), err)
	} else {
		fmt.Fprintf(f.writer, "错误: %v\n", err)
	}
	return nil
}

// formatBool 格式化布尔值
func (f *TableFormatter) formatBool(b bool) string {
	if !f.color {
		if b {
			return "是"
		}
		return "否"
	}

	if b {
		return color.GreenString("是")
	}
	return color.RedString("否")
}

// formatValue 格式化值
func (f *TableFormatter) formatValue(value interface{}) string {
	if value == nil {
		if f.color {
			return color.HiBlackString("<nil>")
		}
		return "<nil>"
	}

	switch v := value.(type) {
	case string:
		if f.color {
			return color.GreenString(fmt.Sprintf("\"%s\"", v))
		}
		return fmt.Sprintf("\"%s\"", v)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		if f.color {
			return color.YellowString(fmt.Sprintf("%v", v))
		}
		return fmt.Sprintf("%v", v)
	case float32, float64:
		if f.color {
			return color.MagentaString(fmt.Sprintf("%v", v))
		}
		return fmt.Sprintf("%v", v)
	case bool:
		if f.color {
			if v {
				return color.CyanString("true")
			}
			return color.CyanString("false")
		}
		if v {
			return "true"
		}
		return "false"
	default:
		str := fmt.Sprintf("%v", v)
		if len(str) > 50 {
			str = str[:47] + "..."
		}
		return str
	}
}

// formatThreadState 格式化线程状态
func (f *TableFormatter) formatThreadState(state string) string {
	if !f.color {
		return state
	}

	stateLower := strings.ToLower(state)
	switch {
	case strings.Contains(stateLower, "run"):
		return color.GreenString(state)
	case strings.Contains(stateLower, "suspend"):
		return color.YellowString(state)
	case strings.Contains(stateLower, "wait"):
		return color.CyanString(state)
	case strings.Contains(stateLower, "block"):
		return color.RedString(state)
	case strings.Contains(stateLower, "term"):
		return color.HiBlackString(state)
	default:
		return state
	}
}