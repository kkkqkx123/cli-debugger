package output

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/fatih/color"
)

// StreamOutput handles streaming output for monitor mode
type StreamOutput struct {
	writer    io.Writer
	color     bool
	interval  time.Duration
	startTime time.Time
	tickCount int
}

// NewStreamOutput creates a new StreamOutput
func NewStreamOutput(writer io.Writer, color bool, interval time.Duration) *StreamOutput {
	return &StreamOutput{
		writer:    writer,
		color:     color,
		interval:  interval,
		startTime: time.Now(),
		tickCount: 0,
	}
}

// PrintHeader prints the monitor mode header
func (s *StreamOutput) PrintHeader(title string) {
	s.tickCount++
	elapsed := time.Since(s.startTime)

	// Clear screen and move cursor to top
	fmt.Fprint(s.writer, "\033[2J\033[H")

	if s.color {
		titleColor := color.New(color.FgCyan, color.Bold).SprintFunc()
		timeColor := color.New(color.FgHiBlack).SprintFunc()
		sepColor := color.New(color.FgHiBlack).SprintFunc()

		fmt.Fprintf(s.writer, "%s\n", titleColor(fmt.Sprintf("=== %s ===", title)))
		fmt.Fprintf(s.writer, "%s  Refresh: %v  Elapsed: %v  Tick: %d\n",
			timeColor("Monitor Mode:"),
			s.interval,
			elapsed.Round(time.Second),
			s.tickCount)
		fmt.Fprintln(s.writer, sepColor(strings.Repeat("─", 60)))
	} else {
		fmt.Fprintf(s.writer, "=== %s ===\n", title)
		fmt.Fprintf(s.writer, "Monitor Mode:  Refresh: %v  Elapsed: %v  Tick: %d\n",
			s.interval,
			elapsed.Round(time.Second),
			s.tickCount)
		fmt.Fprintln(s.writer, strings.Repeat("-", 60))
	}
}

// PrintFooter prints the monitor mode footer
func (s *StreamOutput) PrintFooter() {
	if s.color {
		promptColor := color.New(color.FgHiBlack).SprintFunc()
		fmt.Fprintln(s.writer, promptColor("\nPress Ctrl+C to stop monitoring"))
	} else {
		fmt.Fprintln(s.writer, "\nPress Ctrl+C to stop monitoring")
	}
}

// PrintSeparator prints a separator between ticks
func (s *StreamOutput) PrintSeparator() {
	if s.color {
		sepColor := color.New(color.FgHiBlack).SprintFunc()
		fmt.Fprintln(s.writer, sepColor(strings.Repeat("─", 60)))
	} else {
		fmt.Fprintln(s.writer, strings.Repeat("-", 60))
	}
}

// PrintTickHeader prints the tick timestamp
func (s *StreamOutput) PrintTickHeader() {
	timestamp := time.Now().Format(time.RFC3339)
	if s.color {
		timeColor := color.New(color.FgHiBlack).SprintFunc()
		tickColor := color.New(color.FgCyan, color.Bold).SprintFunc()
		fmt.Fprintf(s.writer, "\n%s %s\n", tickColor(fmt.Sprintf("[Tick #%d]", s.tickCount)), timeColor(timestamp))
	} else {
		fmt.Fprintf(s.writer, "\n[Tick #%d] %s\n", s.tickCount, timestamp)
	}
}

// PrintStatus prints a status line
func (s *StreamOutput) PrintStatus(status string, success bool) {
	if s.color {
		if success {
			statusColor := color.New(color.FgGreen).SprintFunc()
			fmt.Fprintf(s.writer, "%s\n", statusColor(fmt.Sprintf("✓ %s", status)))
		} else {
			statusColor := color.New(color.FgRed).SprintFunc()
			fmt.Fprintf(s.writer, "%s\n", statusColor(fmt.Sprintf("✗ %s", status)))
		}
	} else {
		fmt.Fprintf(s.writer, "[%s] %s\n", status, func() string {
			if success {
				return "OK"
			}
			return "FAIL"
		}())
	}
}

// ClearScreen clears the terminal screen
func (s *StreamOutput) ClearScreen() {
	fmt.Fprint(s.writer, "\033[2J\033[H")
}

// MoveCursorHome moves cursor to home position
func (s *StreamOutput) MoveCursorHome() {
	fmt.Fprint(s.writer, "\033[H")
}

// PrintErrorMessage prints an error message in monitor mode
func (s *StreamOutput) PrintErrorMessage(err error) {
	if s.color {
		errorColor := color.New(color.FgRed).SprintFunc()
		fmt.Fprintf(s.writer, "%s %v\n", errorColor("Error:"), err)
	} else {
		fmt.Fprintf(s.writer, "Error: %v\n", err)
	}
}

// PrintInfoMessage prints an info message in monitor mode
func (s *StreamOutput) PrintInfoMessage(msg string) {
	if s.color {
		infoColor := color.New(color.FgCyan).SprintFunc()
		fmt.Fprintf(s.writer, "%s %s\n", infoColor("Info:"), msg)
	} else {
		fmt.Fprintf(s.writer, "Info: %s\n", msg)
	}
}

// IsTerminal checks if the writer is a terminal
func (s *StreamOutput) IsTerminal() bool {
	if f, ok := s.writer.(*os.File); ok {
		info, err := f.Stat()
		if err != nil {
			return false
		}
		return (info.Mode() & os.ModeCharDevice) != 0
	}
	return false
}
