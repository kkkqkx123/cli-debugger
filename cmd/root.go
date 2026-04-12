package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile string
	protocol string
	host string
	port int
	timeout int
	outputFormat string
	jsonOutput bool
	watchMode bool
	interval int
	verbose bool
	noColor bool
)

// rootCmd 表示基础命令
var rootCmd = &cobra.Command{
	Use:   "debugger",
	Short: "多语言调试 CLI 客户端",
	Long: `多语言调试 CLI 客户端 - 支持多种调试协议的轻量级调试工具

支持插件化架构，可通过 --protocol 标志选择不同的调试协议。
默认支持 JDWP (Java 调试协议)，未来可扩展支持其他语言。`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// 初始化配置
		return initConfig()
	},
}

// Execute 执行根命令
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// 全局标志
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "配置文件路径")
	rootCmd.PersistentFlags().StringVar(&protocol, "protocol", "", "调试协议名称 (jdwp, dap, 等)")
	rootCmd.PersistentFlags().StringVar(&host, "host", "127.0.0.1", "目标主机地址")
	rootCmd.PersistentFlags().IntVar(&port, "port", 5005, "目标调试端口")
	rootCmd.PersistentFlags().IntVar(&timeout, "timeout", 30, "请求超时时间（秒）")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "text", "输出格式 (text/json/table)")
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "JSON 格式输出（快捷标志）")
	rootCmd.PersistentFlags().BoolVarP(&watchMode, "watch", "w", false, "启用监控模式")
	rootCmd.PersistentFlags().IntVarP(&interval, "interval", "i", 1, "监控刷新间隔（秒）")
	rootCmd.PersistentFlags().BoolVar(&verbose, "verbose", false, "显示协议级详细信息")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "禁用彩色输出")

	// 如果设置了 --json，则覆盖 output 格式
	rootCmd.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
		if jsonOutput {
			outputFormat = "json"
		}
		return initConfig()
	}
}

// initConfig 初始化配置
func initConfig() error {
	if cfgFile != "" {
		// 使用指定的配置文件
		viper.SetConfigFile(cfgFile)
	} else {
		// 查找配置文件
		viper.AddConfigPath(".")
		viper.SetConfigName(".debugger")
	}

	// 设置环境变量前缀
	viper.SetEnvPrefix("DEBUGGER")
	viper.AutomaticEnv()

	// 设置默认值
	viper.SetDefault("protocol", "jdwp")
	viper.SetDefault("host", "127.0.0.1")
	viper.SetDefault("port", 5005)
	viper.SetDefault("timeout", 30)
	viper.SetDefault("output", "text")
	viper.SetDefault("color", true)

	// 读取配置文件
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// 配置文件不存在，使用默认值
		} else {
			return fmt.Errorf("读取配置文件失败: %v", err)
		}
	}

	// 绑定命令行参数到 viper
	viper.BindPFlag("protocol", rootCmd.PersistentFlags().Lookup("protocol"))
	viper.BindPFlag("host", rootCmd.PersistentFlags().Lookup("host"))
	viper.BindPFlag("port", rootCmd.PersistentFlags().Lookup("port"))
	viper.BindPFlag("timeout", rootCmd.PersistentFlags().Lookup("timeout"))
	viper.BindPFlag("output", rootCmd.PersistentFlags().Lookup("output"))
	viper.BindPFlag("color", rootCmd.PersistentFlags().Lookup("no-color"))

	return nil
}