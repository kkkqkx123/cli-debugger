package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "显示版本信息",
	Long:  `显示调试器的版本信息`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("多语言调试 CLI")
		fmt.Println("版本: 0.1.0-dev")
		fmt.Println("构建时间: 2024-01-01")
		fmt.Printf("支持的协议：%v\n", getSupportedProtocols())
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}

// getSupportedProtocols 获取支持的协议列表
func getSupportedProtocols() []string {
	// TODO: 从插件注册表获取
	return []string{"jdwp"}
}