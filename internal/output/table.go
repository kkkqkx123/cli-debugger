package output

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
	"github.com/olekukonko/tablewriter/tw"
	"cli-debugger/pkg/types"
)

// TableFormatter Table Formatter
type TableFormatter struct {
	writer io.Writer
	color  bool
}

// NewTableFormatter creates a table formatter
func NewTableFormatter(color bool) *TableFormatter {
	return &TableFormatter{
		writer: os.Stdout,
		color:  color,
	}
}

// SetWriter Sets the output writer
func (f *TableFormatter) SetWriter(writer io.Writer) {
	f.writer = writer
}

// FormatVersion Format version information
func (f *TableFormatter) FormatVersion(info *types.VersionInfo) error {
	table := tablewriter.NewTable(f.writer,
		tablewriter.WithHeader([]string{"causality", "value"}),
		tablewriter.WithRendition(tw.Rendition{Borders: tw.Border{Top: tw.State(1), Bottom: tw.State(1)}}),
	)

	table.Append([]string{"protocol version", info.ProtocolVersion})
	table.Append([]string{"runtime version", info.RuntimeVersion})
	table.Append([]string{"Runtime name", info.RuntimeName})
	if info.Description != "" {
		table.Append([]string{"described", info.Description})
	}

	table.Render()
	return nil
}

// FormatThreads Format threads list
func (f *TableFormatter) FormatThreads(threads []*types.ThreadInfo) error {
	if len(threads) == 0 {
		fmt.Fprintln(f.writer, "No thread found")
		return nil
	}

	table := tablewriter.NewTable(f.writer,
		tablewriter.WithHeader([]string{"ID", "name", "state", "prioritization", "daemon thread", "pending"}),
		tablewriter.WithRendition(tw.Rendition{Borders: tw.Border{Top: tw.State(1), Bottom: tw.State(1), Left: tw.State(1), Right: tw.State(1)}}),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)

	for _, thread := range threads {
		table.Append([]string{
			thread.ID,
			thread.Name,
			thread.State,
			strconv.Itoa(thread.Priority),
			f.formatBool(thread.IsDaemon),
			f.formatBool(thread.IsSuspended),
		})
	}

	table.Render()
	fmt.Fprintf(f.writer, "\nTotal: %d threads\n", len(threads))
	return nil
}

// FormatStack formats the call stack
func (f *TableFormatter) FormatStack(frames []*types.StackFrame) error {
	if len(frames) == 0 {
		fmt.Fprintln(f.writer, "Call stack is empty")
		return nil
	}

	table := tablewriter.NewTable(f.writer,
		tablewriter.WithHeader([]string{"#", "method", "position", "line number", "local method"}),
		tablewriter.WithRendition(tw.Rendition{Borders: tw.Border{Top: tw.State(1), Bottom: tw.State(1), Left: tw.State(1), Right: tw.State(1)}}),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)

	for i, frame := range frames {
		table.Append([]string{
			strconv.Itoa(i),
			frame.Method,
			frame.Location,
			strconv.Itoa(frame.Line),
			f.formatBool(frame.IsNative),
		})
	}

	table.Render()
	fmt.Fprintf(f.writer, "\nTotal: %d stack frames\n", len(frames))
	return nil
}

// FormatVariables formats a list of variables
func (f *TableFormatter) FormatVariables(variables []*types.Variable) error {
	if len(variables) == 0 {
		fmt.Fprintln(f.writer, "No variables")
		return nil
	}

	table := tablewriter.NewTable(f.writer,
		tablewriter.WithHeader([]string{"name", "typology", "value", "Original type", "null value"}),
		tablewriter.WithRendition(tw.Rendition{Borders: tw.Border{Top: tw.State(1), Bottom: tw.State(1), Left: tw.State(1), Right: tw.State(1)}}),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)

	for _, variable := range variables {
		valueStr := f.formatValue(variable.Value)
		table.Append([]string{
			variable.Name,
			variable.Type,
			valueStr,
			f.formatBool(variable.IsPrimitive),
			f.formatBool(variable.IsNull),
		})
	}

	table.Render()
	fmt.Fprintf(f.writer, "\nTotal: %d variables\n", len(variables))
	return nil
}

// FormatBreakpoints Format the breakpoint list.
func (f *TableFormatter) FormatBreakpoints(breakpoints []*types.BreakpointInfo) error {
	if len(breakpoints) == 0 {
		fmt.Fprintln(f.writer, "No breakpoints")
		return nil
	}

	table := tablewriter.NewTable(f.writer,
		tablewriter.WithHeader([]string{"ID", "position", "enabled", "Number of hits", "conditions"}),
		tablewriter.WithRendition(tw.Rendition{Borders: tw.Border{Top: tw.State(1), Bottom: tw.State(1), Left: tw.State(1), Right: tw.State(1)}}),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)

	for _, bp := range breakpoints {
		table.Append([]string{
			bp.ID,
			bp.Location,
			f.formatBool(bp.Enabled),
			strconv.Itoa(bp.HitCount),
			bp.Condition,
		})
	}

	table.Render()
	fmt.Fprintf(f.writer, "\nTotal: %d breakpoints\n", len(breakpoints))
	return nil
}

// FormatEvent Format debug event
func (f *TableFormatter) FormatEvent(event *types.DebugEvent) error {
	table := tablewriter.NewTable(f.writer,
		tablewriter.WithHeader([]string{"attribute", "值"}),
		tablewriter.WithRendition(tw.Rendition{Borders: tw.Border{Top: tw.State(1), Bottom: tw.State(1)}}),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)

	table.Append([]string{"event type", event.Type})
	table.Append([]string{"Thread ID", event.ThreadID})
	table.Append([]string{"position", event.Location})
	table.Append([]string{"timestamp", event.Timestamp.String()})

	if event.Data != nil {
		table.Append([]string{"data", fmt.Sprintf("%v", event.Data)})
	}

	table.Render()
	return nil
}

// FormatError Formatting error
func (f *TableFormatter) FormatError(err error) error {
	if f.color {
		errorColor := color.New(color.FgRed, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s: %v\n", errorColor("error"), err)
	} else {
		fmt.Fprintf(f.writer, "Error: %v\n", err)
	}
	return nil
}

// formatBool Formatting Boolean Values
func (f *TableFormatter) formatBool(b bool) string {
	if !f.color {
		if b {
			return "is"
		}
		return "否"
	}

	if b {
		return color.GreenString("is")
	}
	return color.RedString("否")
}

// formatValue formatValue
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

// formatThreadState formatThreadState
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
