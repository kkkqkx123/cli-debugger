package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile      string
	protocol     string
	host         string
	port         int
	timeout      int
	outputFormat string
	jsonOutput   bool
	watchMode    bool
	interval     int
	verbose      bool
	noColor      bool
)

// Execute Executes the root command.
func Execute() error {
	return rootCmd.Execute()
}

// rootCmd Indicates the base command
var rootCmd = &cobra.Command{
	Use:   "debugger",
	Short: "Multilingual Debugging CLI Client",
	Long: `Multi language Debugging CLI Client - A lightweight debugging tool that supports multiple debugging protocols
Support plugin architecture, different debugging protocols can be selected through the -- protocol flag.
By default, it supports JDWP (Java Debugging Protocol) and can be extended to support other languages in the future.`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Override output format if --json is set
		if jsonOutput {
			outputFormat = "json"
		}
		// Initialization Configuration
		return initConfig(cmd)
	},
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
}

// initConfig Initialization Configuration
func initConfig(cmd *cobra.Command) error {
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
	viper.BindPFlag("protocol", cmd.PersistentFlags().Lookup("protocol"))
	viper.BindPFlag("host", cmd.PersistentFlags().Lookup("host"))
	viper.BindPFlag("port", cmd.PersistentFlags().Lookup("port"))
	viper.BindPFlag("timeout", cmd.PersistentFlags().Lookup("timeout"))
	viper.BindPFlag("output", cmd.PersistentFlags().Lookup("output"))
	viper.BindPFlag("color", cmd.PersistentFlags().Lookup("no-color"))

	return nil
}