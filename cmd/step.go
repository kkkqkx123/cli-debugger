package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"cli-debugger/internal/api"
)

var stepType string

// stepCmd represents the step command
var stepCmd = &cobra.Command{
	Use:   "step",
	Short: "Step through code",
	Long: `Step through code execution.
Requires --thread-id flag. Use --type to specify step mode (into, over, out).`,
	Run: func(cmd *cobra.Command, args []string) {
		if threadID == "" {
			fmt.Fprintf(os.Stderr, "Error: --thread-id is required\n")
			os.Exit(1)
		}

		if stepType == "" {
			stepType = "into"
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

		// Step
		var stepErr error
		switch stepType {
		case "into":
			stepErr = client.StepInto(ctx, threadID)
		case "over":
			stepErr = client.StepOver(ctx, threadID)
		case "out":
			stepErr = client.StepOut(ctx, threadID)
		default:
			fmt.Fprintf(os.Stderr, "Error: invalid step type '%s'. Use 'into', 'over', or 'out'\n", stepType)
			os.Exit(1)
		}

		if stepErr != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", stepErr)
			os.Exit(3)
		}

		fmt.Printf("Stepped %s on thread %s\n", stepType, threadID)
	},
}

func init() {
	rootCmd.AddCommand(stepCmd)
	stepCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to step")
	stepCmd.Flags().StringVar(&stepType, "type", "into", "Step type: into, over, or out")
	stepCmd.MarkFlagRequired("thread-id")
}
