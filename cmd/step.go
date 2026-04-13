package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"cli-debugger/internal/api"
)

var stepType string

// stepCmd represents the step command
var stepCmd = &cobra.Command{
	Use:     "step",
	Short:   "Step through code",
	Long:    `Step through code execution.\nRequires --thread-id flag. Use --type to specify step mode (into, over, out).`,
	Example: `  debugger step --thread-id 1234 --type into
  debugger step --thread-id 1234 --type over
  debugger step --thread-id 1234 --type out`,
	RunE: runStep,
}

func runStep(cmd *cobra.Command, args []string) error {
	if threadID == "" {
		return fmt.Errorf("--thread-id is required")
	}

	if stepType == "" {
		stepType = "into"
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
		return fmt.Errorf("invalid step type '%s'. Use 'into', 'over', or 'out'", stepType)
	}

	if stepErr != nil {
		return fmt.Errorf("failed to step: %w", stepErr)
	}

	fmt.Printf("Stepped %s on thread %s\n", stepType, threadID)
	return nil
}

func init() {
	rootCmd.AddCommand(stepCmd)
	stepCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to step")
	stepCmd.Flags().StringVar(&stepType, "type", "into", "Step type: into, over, or out")
	stepCmd.MarkFlagRequired("thread-id")
}
