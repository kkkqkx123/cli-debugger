package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"cli-debugger/internal/api"
	"cli-debugger/internal/monitor"
	"cli-debugger/internal/output"
)

var (
	monitorCommand string
	monitorTimeout int
)

// monitorCmd represents the monitor command
var monitorCmd = &cobra.Command{
	Use:   "monitor",
	Short: "Monitor debug state in real-time",
	Long: `Monitor debug state in real-time with continuous polling.
Supports watching threads, stack, locals, or breakpoints.

Examples:
  debugger monitor --watch --command threads
  debugger monitor -w -c stack --thread-id 1
  debugger monitor -w -c locals --thread-id 1 --frame 0
  debugger monitor -w -c threads -i 2 --timeout 120`,
	RunE: runMonitor,
}

func runMonitor(cmd *cobra.Command, args []string) error {
	// Override output format if --json is set
	if jsonOutput {
		outputFormat = "json"
	}

	// Validate command
	if monitorCommand == "" {
		monitorCommand = "threads"
	}

	// Validate timeout
	if monitorTimeout <= 0 {
		monitorTimeout = 60
	}

	if !watchMode {
		// Single execution mode: run command once
		return runSingleCommand(cmd.Context())
	}

	// Monitor mode: start polling
	return runMonitorMode(cmd.Context())
}

// runSingleCommand executes a single command and exits
func runSingleCommand(ctx context.Context) error {
	client, err := api.CreateClient(viper.GetString("protocol"))
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}

	if err := client.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	formatter := output.NewFormatter(
		output.GetFormatterType(outputFormat),
		!noColor,
	)

	return executeCommand(ctx, client, formatter, monitorCommand)
}

// runMonitorMode starts the monitoring loop
func runMonitorMode(ctx context.Context) error {
	client, err := api.CreateClient(viper.GetString("protocol"))
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}

	if err := client.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	// Create poller
	poller := monitor.NewPoller()
	poller.SetInterval(time.Duration(interval) * time.Second)
	poller.SetTimeout(time.Duration(monitorTimeout) * time.Second)

	// Create stream output
	streamOut := output.NewStreamOutput(os.Stdout, !noColor, time.Duration(interval)*time.Second)

	// Set the monitor command
	poller.SetCommand(func(ctx context.Context) error {
		formatter := output.NewFormatter(
			output.GetFormatterType(outputFormat),
			!noColor,
		)

		streamOut.PrintHeader(fmt.Sprintf("Monitoring: %s", monitorCommand))
		streamOut.PrintTickHeader()

		if err := executeCommand(ctx, client, formatter, monitorCommand); err != nil {
			streamOut.PrintErrorMessage(err)
			return err
		}

		streamOut.PrintFooter()
		return nil
	})

	// Start monitoring
	return poller.Start(ctx)
}

// executeCommand executes the specified monitor command
func executeCommand(ctx context.Context, client api.DebugProtocol, formatter output.Formatter, command string) error {
	switch command {
	case "threads":
		threads, err := client.GetThreads(ctx)
		if err != nil {
			return fmt.Errorf("failed to get threads: %w", err)
		}
		return formatter.FormatThreads(threads)

	case "stack":
		// Get first thread if not specified
		tid := threadID
		if tid == "" {
			threads, err := client.GetThreads(ctx)
			if err != nil {
				return fmt.Errorf("failed to get threads: %w", err)
			}
			if len(threads) == 0 {
				return fmt.Errorf("no threads available")
			}
			tid = threads[0].ID
		}

		frames, err := client.GetThreadStack(ctx, tid)
		if err != nil {
			return fmt.Errorf("failed to get stack: %w", err)
		}
		return formatter.FormatStack(frames)

	case "locals":
		tid := threadID
		if tid == "" {
			threads, err := client.GetThreads(ctx)
			if err != nil {
				return fmt.Errorf("failed to get threads: %w", err)
			}
			if len(threads) == 0 {
				return fmt.Errorf("no threads available")
			}
			tid = threads[0].ID
		}

		variables, err := client.GetLocalVariables(ctx, tid, frameIndex)
		if err != nil {
			return fmt.Errorf("failed to get locals: %w", err)
		}
		return formatter.FormatVariables(variables)

	case "breakpoints":
		bps, err := client.GetBreakpoints(ctx)
		if err != nil {
			return fmt.Errorf("failed to get breakpoints: %w", err)
		}
		return formatter.FormatBreakpoints(bps)

	case "version":
		info, err := client.Version(ctx)
		if err != nil {
			return fmt.Errorf("failed to get version: %w", err)
		}
		return formatter.FormatVersion(info)

	default:
		return fmt.Errorf("unknown monitor command: %s (supported: threads, stack, locals, breakpoints, version)", command)
	}
}

func init() {
	rootCmd.AddCommand(monitorCmd)

	monitorCmd.Flags().BoolVarP(&watchMode, "watch", "w", false, "Enable continuous monitoring mode")
	monitorCmd.Flags().StringVarP(&monitorCommand, "command", "c", "threads", "Command to monitor (threads, stack, locals, breakpoints, version)")
	monitorCmd.Flags().IntVarP(&interval, "interval", "i", 1, "Refresh interval in seconds")
	monitorCmd.Flags().IntVar(&monitorTimeout, "timeout", 60, "Total monitoring timeout in seconds")
	monitorCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID (for stack/locals)")
	monitorCmd.Flags().IntVar(&frameIndex, "frame", 0, "Stack frame index (for locals)")
}
