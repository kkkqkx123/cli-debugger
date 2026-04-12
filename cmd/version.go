package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"cli-debugger/internal/api"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display version information",
	Long:  `Display the version information of the debugger`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Multi-language debugging CLI")
		fmt.Println("Version: 0.1.0-dev")
		fmt.Println("Build Time: 2026-04-12")
		fmt.Printf("Supported protocols: %v\n", api.GetRegisteredProtocols())
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}