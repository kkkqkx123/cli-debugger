package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"cli-debugger/internal/api"
	"cli-debugger/internal/output"
)

var (
	breakpointLocation string
	breakpointCondition string
	breakpointID       string
)

// breakpointsCmd represents the breakpoints command
var breakpointsCmd = &cobra.Command{
	Use:     "breakpoints",
	Short:   "Manage breakpoints",
	Long:    `List, set, or remove breakpoints.\nUse subcommands to perform specific operations.`,
	Example: `  debugger breakpoints list
  debugger breakpoints set --location "com.example.MyClass:42"
  debugger breakpoints set --location "com.example.MyClass:42" --condition "x > 10"
  debugger breakpoints remove --breakpoint-id bp-1
  debugger breakpoints clear`,
}

var breakpointsListCmd = &cobra.Command{
	Use:     "list",
	Short:   "List all breakpoints",
	Example: `  debugger breakpoints list
  debugger breakpoints list -o json`,
	RunE: runBreakpointsList,
}

func runBreakpointsList(cmd *cobra.Command, args []string) error {
	// Create client
	client, err := api.CreateClient(viper.GetString("protocol"))
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}

	// Connect
	ctx := context.Background()
	if err := client.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	// Get breakpoints
	bps, err := client.GetBreakpoints(ctx)
	if err != nil {
		return fmt.Errorf("failed to get breakpoints: %w", err)
	}

	// Format output
	formatter := output.NewFormatter(
		output.GetFormatterType(viper.GetString("output")),
		viper.GetBool("color"),
	)
	formatter.SetWriter(os.Stdout)

	if err := formatter.FormatBreakpoints(bps); err != nil {
		return fmt.Errorf("failed to format breakpoints: %w", err)
	}

	return nil
}

var breakpointsSetCmd = &cobra.Command{
	Use:     "set",
	Short:   "Set a breakpoint",
	Long:    `Set a breakpoint at a specific location.\nThe location format depends on the debugging protocol (e.g., "com.example.MyClass:42" for line 42).`,
	Example: `  debugger breakpoints set --location "com.example.MyClass:42"
  debugger breakpoints set --location "com.example.MyClass:100" --condition "x > 10"`,
	RunE: runBreakpointsSet,
}

func runBreakpointsSet(cmd *cobra.Command, args []string) error {
	if breakpointLocation == "" {
		return fmt.Errorf("--location is required")
	}

	// Create client
	client, err := api.CreateClient(viper.GetString("protocol"))
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}

	// Connect
	ctx := context.Background()
	if err := client.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	// Set breakpoint
	bpID, err := client.SetBreakpoint(ctx, breakpointLocation, breakpointCondition)
	if err != nil {
		return fmt.Errorf("failed to set breakpoint: %w", err)
	}

	fmt.Printf("Breakpoint set: %s\n", bpID)
	return nil
}

var breakpointsRemoveCmd = &cobra.Command{
	Use:     "remove",
	Short:   "Remove a breakpoint",
	Example: `  debugger breakpoints remove --breakpoint-id bp-1`,
	RunE: runBreakpointsRemove,
}

func runBreakpointsRemove(cmd *cobra.Command, args []string) error {
	if breakpointID == "" {
		return fmt.Errorf("--breakpoint-id is required")
	}

	// Create client
	client, err := api.CreateClient(viper.GetString("protocol"))
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}

	// Connect
	ctx := context.Background()
	if err := client.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	// Remove breakpoint
	if err := client.RemoveBreakpoint(ctx, breakpointID); err != nil {
		return fmt.Errorf("failed to remove breakpoint: %w", err)
	}

	fmt.Printf("Breakpoint removed: %s\n", breakpointID)
	return nil
}

var breakpointsClearCmd = &cobra.Command{
	Use:     "clear",
	Short:   "Clear all breakpoints",
	Example: `  debugger breakpoints clear`,
	RunE: runBreakpointsClear,
}

func runBreakpointsClear(cmd *cobra.Command, args []string) error {
	// Create client
	client, err := api.CreateClient(viper.GetString("protocol"))
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}

	// Connect
	ctx := context.Background()
	if err := client.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	// Clear breakpoints
	if err := client.ClearBreakpoints(ctx); err != nil {
		return fmt.Errorf("failed to clear breakpoints: %w", err)
	}

	fmt.Println("All breakpointss cleared")
	return nil
}

func init() {
	rootCmd.AddCommand(breakpointsCmd)
	breakpointsCmd.AddCommand(breakpointsListCmd)
	breakpointsCmd.AddCommand(breakpointsSetCmd)
	breakpointsCmd.AddCommand(breakpointsRemoveCmd)
	breakpointsCmd.AddCommand(breakpointsClearCmd)

	breakpointsSetCmd.Flags().StringVar(&breakpointLocation, "location", "", "Breakpoint location (e.g., class:line)")
	breakpointsSetCmd.Flags().StringVar(&breakpointCondition, "condition", "", "Conditional breakpoint expression")
	breakpointsSetCmd.MarkFlagRequired("location")

	breakpointsRemoveCmd.Flags().StringVar(&breakpointID, "breakpoint-id", "", "Breakpoint ID to remove")
	breakpointsRemoveCmd.MarkFlagRequired("breakpoint-id")
}
