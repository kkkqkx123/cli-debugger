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

// TextFormatter Text Formatter
type TextFormatter struct {
	writer io.Writer
	color  bool
}

// NewTextFormatter Creates a text formatter.
func NewTextFormatter(color bool) *TextFormatter {
	return &TextFormatter{
		writer: os.Stdout,
		color:  color,
	}
}

// SetWriter Sets the output writer
func (f *TextFormatter) SetWriter(writer io.Writer) {
	f.writer = writer
}

// FormatVersion Formatting version information
func (f *TextFormatter) FormatVersion(info *types.VersionInfo) error {
	if f.color {
		cyan := color.New(color.FgCyan).SprintFunc()
		green := color.New(color.FgGreen).SprintFunc()
		magenta := color.New(color.FgMagenta).SprintFunc()

		fmt.Fprintf(f.writer, "%s: %s\n", cyan("protocol version"), info.ProtocolVersion)
		fmt.Fprintf(f.writer, "%s: %s\n", green("run-time version"), info.RuntimeVersion)
		fmt.Fprintf(f.writer, "%s: %s\n", magenta("Runtime name"), info.RuntimeName)
		if info.Description != "" {
			fmt.Fprintf(f.writer, "%s: %s\n", cyan("descriptive"), info.Description)
		}
	} else {
		fmt.Fprintf(f.writer, "Protocol version: %s\n", info.ProtocolVersion)
		fmt.Fprintf(f.writer, "Runtime version: %s\n", info.RuntimeVersion)
		fmt.Fprintf(f.writer, "Runtime name: %s\n", info.RuntimeName)
		if info.Description != "" {
			fmt.Fprintf(f.writer, "Description: %s\n", info.Description)
		}
	}
	return nil
}

// FormatThreads Format threads list
func (f *TextFormatter) FormatThreads(threads []*types.ThreadInfo) error {
	if len(threads) == 0 {
		f.printColored("No thread found.", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d):\n", header("Thread List"), len(threads))
	} else {
		fmt.Fprintf(f.writer, "Thread list (%d):\n", len(threads))
	}

	for i, thread := range threads {
		f.formatThread(i, thread)
	}

	return nil
}

// formatThread Formatting individual threads
func (f *TextFormatter) formatThread(index int, thread *types.ThreadInfo) {
	stateColor := f.getThreadStateColor(thread.State)
	daemonStr := ""
	if thread.IsDaemon {
		daemonStr = " [Guardian Thread]"
	}

	if f.color {
		idColor := color.New(color.FgYellow).SprintFunc()
		nameColor := color.New(color.FgGreen).SprintFunc()
		stateColorFunc := color.New(stateColor).SprintFunc()
		priorityColor := color.New(color.FgMagenta).SprintFunc()

		fmt.Fprintf(f.writer, "%2d. %s %s (%s) Priority: %s%s\n",
			index+1,
			idColor(thread.ID),
			nameColor(thread.Name),
			stateColorFunc(thread.State),
			priorityColor(fmt.Sprintf("%d", thread.Priority)),
			daemonStr)
	} else {
		fmt.Fprintf(f.writer, "%2d. %s %s (%s) Priority: %d%s\n",
			index+1,
			thread.ID,
			thread.Name,
			thread.State,
			thread.Priority,
			daemonStr)
	}
}

// getThreadStateColor Get the color of the thread state.
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

// FormatStack Format call stack
func (f *TextFormatter) FormatStack(frames []*types.StackFrame) error {
	if len(frames) == 0 {
		f.printColored("Call stack is empty", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d frames):\n", header("callstack"), len(frames))
	} else {
		fmt.Fprintf(f.writer, "Call Stack (%d frames):", len(frames))
	}

	for i, frame := range frames {
		f.formatStackFrame(i, frame)
	}

	return nil
}

// formatStackFrame Formatting a single stack frame
func (f *TextFormatter) formatStackFrame(index int, frame *types.StackFrame) {
	nativeStr := ""
	if frame.IsNative {
		nativeStr = " [Local methods]"
	}

	if f.color {
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

// FormatVariables Format variable list
func (f *TextFormatter) FormatVariables(variables []*types.Variable) error {
	if len(variables) == 0 {
		f.printColored("No variables", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d):\n", header("variable list"), len(variables))
	} else {
		fmt.Fprintf(f.writer, "Variable list (%d):\n", len(variables))
	}

	for _, variable := range variables {
		f.formatVariable(variable)
	}

	return nil
}

// formatVariable Formats a single variable
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

// formatValue formatValue
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

// getValueColor Get the color of the value.
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

// FormatBreakpoints Format the breakpoint list.
func (f *TextFormatter) FormatBreakpoints(breakpoints []*types.BreakpointInfo) error {
	if len(breakpoints) == 0 {
		f.printColored("No breakpoints.", color.FgYellow)
		return nil
	}

	if f.color {
		header := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s (%d):\n", header("breakpoint list"), len(breakpoints))
	} else {
		fmt.Fprintf(f.writer, "Breakpoint list (%d):\n", len(breakpoints))
	}

	for i, bp := range breakpoints {
		f.formatBreakpoint(i, bp)
	}

	return nil
}

// formatBreakpoint Formatting a single breakpoint
func (f *TextFormatter) formatBreakpoint(index int, bp *types.BreakpointInfo) {
	enabledStr := ""
	if !bp.Enabled {
		enabledStr = " [Disabled]"
	}

	hitCountStr := ""
	if bp.HitCount > 0 {
		hitCountStr = fmt.Sprintf("Hit: %d", bp.HitCount)
	}

	conditionStr := ""
	if bp.Condition != "" {
		conditionStr = fmt.Sprintf("Condition: %s", bp.Condition)
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

// FormatEvent Format debug event
func (f *TextFormatter) FormatEvent(event *types.DebugEvent) error {
	if f.color {
		eventTypeColor := color.New(color.FgCyan, color.Bold).SprintFunc()
		threadColor := color.New(color.FgYellow).SprintFunc()
		locationColor := color.New(color.FgGreen).SprintFunc()
		timeColor := color.New(color.FgHiBlack).SprintFunc()

		fmt.Fprintf(f.writer, "%s Event: Thread %s at %s (%s)\n",
			eventTypeColor(event.Type),
			threadColor(event.ThreadID),
			locationColor(event.Location),
			timeColor(event.Timestamp.Format(time.RFC3339)))
	} else {
		fmt.Fprintf(f.writer, "%s Event: Thread %s at %s (%s)\n",
			event.Type,
			event.ThreadID,
			event.Location,
			event.Timestamp.Format(time.RFC3339))
	}

	if event.Data != nil {
		fmt.Fprintf(f.writer, "Data: %v\n", event.Data)
	}

	return nil
}

// FormatError Formatting error
func (f *TextFormatter) FormatError(err error) error {
	if f.color {
		errorColor := color.New(color.FgRed, color.Bold).SprintFunc()
		fmt.Fprintf(f.writer, "%s: %v\n", errorColor("incorrect"), err)
	} else {
		fmt.Fprintf(f.writer, "Error: %v\n", err)
	}
	return nil
}

// printColored Prints colored text
func (f *TextFormatter) printColored(text string, attr color.Attribute) {
	if f.color {
		colorFunc := color.New(attr).SprintFunc()
		fmt.Fprintln(f.writer, colorFunc(text))
	} else {
		fmt.Fprintln(f.writer, text)
	}
}