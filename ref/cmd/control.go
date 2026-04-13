package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"cli-debugger/internal/api"
)

// suspendCmd represents the suspend command
var suspendCmd = &cobra.Command{
	Use:     "suspend",
	Short:   "Suspend execution",
	Long:    `Suspend execution of the target or a specific thread.\nIf --thread-id is not provided, suspends the entire VM.`,
	Example: `  debugger suspend
  debugger suspend --thread-id 1234`,
	RunE: runSuspend,
}

func runSuspend(cmd *cobra.Command, args []string) error {
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

	// Suspend
	if err := client.Suspend(ctx, threadID); err != nil {
		return fmt.Errorf("failed to suspend: %w", err)
	}

	if threadID != "" {
		fmt.Printf("Thread %s suspended\n", threadID)
	} else {
		fmt.Println("VM suspended")
	}
	return nil
}

// resumeCmd represents the resume command
var resumeCmd = &cobra.Command{
	Use:     "resume",
	Short:   "Resume execution",
	Long:    `Resume execution of the target or a specific thread.\nIf --thread-id is not provided, resumes the entire VM.`,
	Example: `  debugger resume
  debugger resume --thread-id 1234`,
	RunE: runResume,
}

func runResume(cmd *cobra.Command, args []string) error {
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

	// Resume
	if err := client.Resume(ctx, threadID); err != nil {
		return fmt.Errorf("failed to resume: %w", err)
	}

	if threadID != "" {
		fmt.Printf("Thread %s resumed\n", threadID)
	} else {
		fmt.Println("VM resumed")
	}
	return nil
}

func init() {
	rootCmd.AddCommand(suspendCmd)
	rootCmd.AddCommand(resumeCmd)

	suspendCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to suspend (optional)")
	resumeCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to resume (optional)")
}
