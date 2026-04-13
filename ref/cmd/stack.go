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

// stackCmd represents the stack command
var stackCmd = &cobra.Command{
	Use:     "stack",
	Short:   "Get thread stack trace",
	Long:    `Get the stack trace of a specific thread.\nRequires --thread-id flag to specify which thread to inspect.`,
	Example: `  debugger stack --thread-id 1234
  debugger stack --thread-id 1234 -o json
  debugger stack --thread-id 1234 -o table`,
	RunE: runStack,
}

func runStack(cmd *cobra.Command, args []string) error {
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

	// Get stack
	stack, err := client.GetThreadStack(ctx, threadID)
	if err != nil {
		return fmt.Errorf("failed to get stack: %w", err)
	}

	// Format output
	formatter := output.NewFormatter(
		output.GetFormatterType(viper.GetString("output")),
		viper.GetBool("color"),
	)
	formatter.SetWriter(os.Stdout)

	if err := formatter.FormatStack(stack); err != nil {
		return fmt.Errorf("failed to format stack: %w", err)
	}

	return nil
}

func init() {
	rootCmd.AddCommand(stackCmd)
	stackCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to inspect")
	stackCmd.MarkFlagRequired("thread-id")
}
