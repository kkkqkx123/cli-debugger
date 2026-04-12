package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display version information",
	Long:  `Display the version information of the debugger`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Multi-language debugging CLI")
		fmt.Println("Version: 0.1.0-dev")
		fmt.Println("Build Time: 2024-01-01")
		fmt.Printf("Supported protocols: %v\n", getSupportedProtocols())
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}

// getSupportedProtocols - Retrieve a list of supported protocols
func getSupportedProtocols() []string {
	// TODO: 从插件注册表获取
	return []string{"jdwp"}
}