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
	Use:   "stack",
	Short: "Get thread stack trace",
	Long: `Get the stack trace of a specific thread.
Requires --thread-id flag to specify which thread to inspect.`,
	Run: func(cmd *cobra.Command, args []string) {
		if threadID == "" {
			fmt.Fprintf(os.Stderr, "Error: --thread-id is required\n")
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

		// Get stack
		stack, err := client.GetThreadStack(ctx, threadID)
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

		if err := formatter.FormatStack(stack); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.AddCommand(stackCmd)
	stackCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to inspect")
	stackCmd.MarkFlagRequired("thread-id")
}
