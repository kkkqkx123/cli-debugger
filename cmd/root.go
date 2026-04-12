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

// rootCmd Indicates the base command
var rootCmd = &cobra.Command{
	Use:   "debugger",
	Short: "Multilingual Debugging CLI Client",
	Long: `多语言调试 CLI 客户端 - 支持多种调试协议的轻量级调试工具

支持插件化架构，可通过 --protocol 标志选择不同的调试协议。
默认支持 JDWP (Java 调试协议)，未来可扩展支持其他语言。`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Initialization Configuration
		return initConfig()
	},
}

// Execute Executes the root command.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// global symbol
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "Configuration file path")
	rootCmd.PersistentFlags().StringVar(&protocol, "protocol", "", "Debugging protocol name (jdwp, dap, etc.)")
	rootCmd.PersistentFlags().StringVar(&host, "host", "127.0.0.1", "target host address")
	rootCmd.PersistentFlags().IntVar(&port, "port", 5005, "target debug port")
	rootCmd.PersistentFlags().IntVar(&timeout, "timeout", 30, "Request timeout in seconds")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "text", "Output format (text/json/table)")
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "JSON format output (shortcut flag)")
	rootCmd.PersistentFlags().BoolVarP(&watchMode, "watch", "w", false, "Enable Monitor Mode")
	rootCmd.PersistentFlags().IntVarP(&interval, "interval", "i", 1, "Monitor Refresh Interval (sec)")
	rootCmd.PersistentFlags().BoolVar(&verbose, "verbose", false, "Display protocol level details")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "Disable color output")

	// If --json is set, the output format is overridden.
	rootCmd.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
		if jsonOutput {
			outputFormat = "json"
		}
		return initConfig()
	}
}

// initConfig Initialization Configuration
func initConfig() error {
	if cfgFile != "" {
		// Use the specified configuration file
		viper.SetConfigFile(cfgFile)
	} else {
		// Find Configuration File
		viper.AddConfigPath(".")
		viper.SetConfigName(".debugger")
	}

	// Setting the environment variable prefix
	viper.SetEnvPrefix("DEBUGGER")
	viper.AutomaticEnv()

	// Setting default values
	viper.SetDefault("protocol", "jdwp")
	viper.SetDefault("host", "127.0.0.1")
	viper.SetDefault("port", 5005)
	viper.SetDefault("timeout", 30)
	viper.SetDefault("output", "text")
	viper.SetDefault("color", true)

	// Read configuration file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Configuration file does not exist, use default
		} else {
			return fmt.Errorf("Failed to read configuration file: %v", err)
		}
	}

	// Bind command line arguments to viper
	viper.BindPFlag("protocol", rootCmd.PersistentFlags().Lookup("protocol"))
	viper.BindPFlag("host", rootCmd.PersistentFlags().Lookup("host"))
	viper.BindPFlag("port", rootCmd.PersistentFlags().Lookup("port"))
	viper.BindPFlag("timeout", rootCmd.PersistentFlags().Lookup("timeout"))
	viper.BindPFlag("output", rootCmd.PersistentFlags().Lookup("output"))
	viper.BindPFlag("color", rootCmd.PersistentFlags().Lookup("no-color"))

	return nil
}