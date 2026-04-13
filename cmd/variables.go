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

var frameIndex int

// variablesCmd represents the variables command
var variablesCmd = &cobra.Command{
	Use:     "variables",
	Short:   "Get local variables",
	Long:    `Get local variables from a specific stack frame.\nRequires --thread-id flag. Use --frame-index to specify the frame (default: 0).`,
	Example: `  debugger variables --thread-id 1234
  debugger variables --thread-id 1234 --frame-index 2
  debugger variables --thread-id 1234 -o json`,
	RunE: runVariables,
}

func runVariables(cmd *cobra.Command, args []string) error {
	if threadID == "" {
		return fmt.Errorf("--thread-id is required")
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

	// Get variables
	vars, err := client.GetLocalVariables(ctx, threadID, frameIndex)
	if err != nil {
		return fmt.Errorf("failed to get local variables: %w", err)
	}

	// Format output
	formatter := output.NewFormatter(
		output.GetFormatterType(viper.GetString("output")),
		viper.GetBool("color"),
	)
	formatter.SetWriter(os.Stdout)

	if err := formatter.FormatVariables(vars); err != nil {
		return fmt.Errorf("failed to format variables: %w", err)
	}

	return nil
}

func init() {
	rootCmd.AddCommand(variablesCmd)
	variablesCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to inspect")
	variablesCmd.Flags().IntVar(&frameIndex, "frame-index", 0, "Stack frame index (default: 0)")
	variablesCmd.MarkFlagRequired("thread-id")
}
