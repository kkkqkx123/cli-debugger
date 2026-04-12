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
	Use:   "threads",
	Short: "List all threads",
	Long: `List all threads in the debugged process.
Shows thread ID, name, state, and other information.`,
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

		// Get threads
		threads, err := client.GetThreads(ctx)
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

		if err := formatter.FormatThreads(threads); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.AddCommand(threadsCmd)
}
