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

var threadID string

// threadsCmd represents the threads command
var threadsCmd = &cobra.Command{
	Use:     "threads",
	Short:   "List all threads",
	Long:    `List all threads in the debugged process.\nShows thread ID, name, state, priority, and daemon status.`,
	Example: `  debugger threads
  debugger threads --host 127.0.0.1 --port 5005
  debugger threads -o json
  debugger threads -o table`,
	RunE: runThreads,
}

func runThreads(cmd *cobra.Command, args []string) error {
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

	// Get threads
	threads, err := client.GetThreads(ctx)
	if err != nil {
		return fmt.Errorf("failed to get threads: %w", err)
	}

	// Format output
	formatter := output.NewFormatter(
		output.GetFormatterType(viper.GetString("output")),
		viper.GetBool("color"),
	)
	formatter.SetWriter(os.Stdout)

	if err := formatter.FormatThreads(threads); err != nil {
		return fmt.Errorf("failed to format threads: %w", err)
	}

	return nil
}

func init() {
	rootCmd.AddCommand(threadsCmd)
}
