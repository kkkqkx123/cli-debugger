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
	Use:   "variables",
	Short: "Get local variables",
	Long: `Get local variables from a specific stack frame.
Requires --thread-id and --frame-index flags.`,
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

		// Get variables
		vars, err := client.GetLocalVariables(ctx, threadID, frameIndex)
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

		if err := formatter.FormatVariables(vars); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.AddCommand(variablesCmd)
	variablesCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to inspect")
	variablesCmd.Flags().IntVar(&frameIndex, "frame-index", 0, "Stack frame index (default: 0)")
	variablesCmd.MarkFlagRequired("thread-id")
}
