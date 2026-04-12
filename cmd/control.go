package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"cli-debugger/internal/api"
)

// suspendCmd represents the suspend command
var suspendCmd = &cobra.Command{
	Use:   "suspend",
	Short: "Suspend execution",
	Long: `Suspend execution of the target or a specific thread.
If --thread-id is not provided, suspends the entire VM.`,
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

		// Suspend
		if err := client.Suspend(ctx, threadID); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(3)
		}

		if threadID != "" {
			fmt.Printf("Thread %s suspended\n", threadID)
		} else {
			fmt.Println("VM suspended")
		}
	},
}

// resumeCmd represents the resume command
var resumeCmd = &cobra.Command{
	Use:   "resume",
	Short: "Resume execution",
	Long: `Resume execution of the target or a specific thread.
If --thread-id is not provided, resumes the entire VM.`,
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

		// Resume
		if err := client.Resume(ctx, threadID); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(3)
		}

		if threadID != "" {
			fmt.Printf("Thread %s resumed\n", threadID)
		} else {
			fmt.Println("VM resumed")
		}
	},
}

func init() {
	rootCmd.AddCommand(suspendCmd)
	rootCmd.AddCommand(resumeCmd)

	suspendCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to suspend (optional)")
	resumeCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID to resume (optional)")
}
