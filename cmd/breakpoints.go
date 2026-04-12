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
	Use:   "breakpoints",
	Short: "Manage breakpoints",
	Long: `List, set, or remove breakpoints.
Use subcommands to perform specific operations.`,
}

var breakpointsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all breakpoints",
	Run: func(cmd *cobra.Command, args []string) {
		// Create client
		client, err := api.CreateClient(viper.GetString("protocol"))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		// Connect
		ctx := context.Background()
		if err := client.Connect(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(2)
		}
		defer client.Close()

		// Get breakpoints
		bps, err := client.GetBreakpoints(ctx)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(3)
		}

		// Format output
		formatter := output.NewFormatter(
			output.GetFormatterType(viper.GetString("output")),
			viper.GetBool("color"),
		)
		formatter.SetWriter(os.Stdout)

		if err := formatter.FormatBreakpoints(bps); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	},
}

var breakpointsSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Set a breakpoint",
	Long: `Set a breakpoint at a specific location.
The location format depends on the debugging protocol (e.g., "com.example.MyClass:42" for line 42).`,
	Run: func(cmd *cobra.Command, args []string) {
		if breakpointLocation == "" {
			fmt.Fprintf(os.Stderr, "Error: --location is required\n")
			os.Exit(1)
		}

		// Create client
		client, err := api.CreateClient(viper.GetString("protocol"))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		// Connect
		ctx := context.Background()
		if err := client.Connect(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(2)
		}
		defer client.Close()

		// Set breakpoint
		bpID, err := client.SetBreakpoint(ctx, breakpointLocation, breakpointCondition)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(3)
		}

		fmt.Printf("Breakpoint set: %s\n", bpID)
	},
}

var breakpointsRemoveCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove a breakpoint",
	Run: func(cmd *cobra.Command, args []string) {
		if breakpointID == "" {
			fmt.Fprintf(os.Stderr, "Error: --breakpoint-id is required\n")
			os.Exit(1)
		}

		// Create client
		client, err := api.CreateClient(viper.GetString("protocol"))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		// Connect
		ctx := context.Background()
		if err := client.Connect(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(2)
		}
		defer client.Close()

		// Remove breakpoint
		if err := client.RemoveBreakpoint(ctx, breakpointID); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(3)
		}

		fmt.Printf("Breakpoint removed: %s\n", breakpointID)
	},
}

var breakpointsClearCmd = &cobra.Command{
	Use:   "clear",
	Short: "Clear all breakpoints",
	Run: func(cmd *cobra.Command, args []string) {
		// Create client
		client, err := api.CreateClient(viper.GetString("protocol"))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		// Connect
		ctx := context.Background()
		if err := client.Connect(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(2)
		}
		defer client.Close()

		// Clear breakpoints
		if err := client.ClearBreakpoints(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(3)
		}

		fmt.Println("All breakpoints cleared")
	},
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
