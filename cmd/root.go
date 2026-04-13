package cmd

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	pkgerrors "cli-debugger/pkg/errors"
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
	if err := rootCmd.Execute(); err != nil {
		// Handle error with proper exit code
		exitCode := determineExitCode(err)
		if verbose {
			printVerboseError(err)
		} else {
			printUserError(err)
		}
		os.Exit(exitCode)
		return err
	}
	return nil
}

// rootCmd Indicates the base command
var rootCmd = &cobra.Command{
	Use:   "debugger",
	Short: "Multilingual Debugging CLI Client",
	Long: `Multi language Debugging CLI Client - A lightweight debugging tool that supports multiple debugging protocols.

Supports plugin architecture, different debugging protocols can be selected through the --protocol flag.
By default, it supports JDWP (Java Debugging Protocol) and can be extended to support other languages in the future.`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Override output format if --json is set
		if jsonOutput {
			outputFormat = "json"
		}
		// Initialize configuration
		return initConfig(cmd)
	},
	SilenceUsage:  true,
	SilenceErrors: true,
}

func init() {
	// Global flags
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "Configuration file path")
	rootCmd.PersistentFlags().StringVar(&protocol, "protocol", "", "Debugging protocol name (jdwp, dap, etc.)")
	rootCmd.PersistentFlags().StringVar(&host, "host", "127.0.0.1", "Target host address")
	rootCmd.PersistentFlags().IntVar(&port, "port", 5005, "Target debug port")
	rootCmd.PersistentFlags().IntVar(&timeout, "timeout", 30, "Request timeout in seconds")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "text", "Output format (text/json/table)")
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "JSON format output (shortcut flag)")
	rootCmd.PersistentFlags().BoolVarP(&watchMode, "watch", "w", false, "Enable monitor mode")
	rootCmd.PersistentFlags().IntVarP(&interval, "interval", "i", 1, "Monitor refresh interval (seconds)")
	rootCmd.PersistentFlags().BoolVar(&verbose, "verbose", false, "Display protocol-level details")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "Disable color output")
}

// initConfig Initialization Configuration
func initConfig(cmd *cobra.Command) error {
	if cfgFile != "" {
		// Use the specified configuration file
		viper.SetConfigFile(cfgFile)
	} else {
		// Find Configuration file
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
	viper.SetDefault("color", !noColor)

	// Read configuration file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return pkgerrors.WrapInputError(err, pkgerrors.ErrInvalidFormat, "Failed to read configuration file")
		}
		// Configuration file does not exist, use default
	}

	// Bind command line arguments to viper
	_ = viper.BindPFlag("protocol", cmd.PersistentFlags().Lookup("protocol"))
	_ = viper.BindPFlag("host", cmd.PersistentFlags().Lookup("host"))
	_ = viper.BindPFlag("port", cmd.PersistentFlags().Lookup("port"))
	_ = viper.BindPFlag("timeout", cmd.PersistentFlags().Lookup("timeout"))
	_ = viper.BindPFlag("output", cmd.PersistentFlags().Lookup("output"))
	_ = viper.BindPFlag("color", cmd.PersistentFlags().Lookup("no-color"))

	return nil
}

// determineExitCode determines the exit code based on error type
func determineExitCode(err error) int {
	if err == nil {
		return 0
	}

	var apiErr *pkgerrors.APIError
	if errors.As(err, &apiErr) {
		return pkgerrors.GetExitCode(apiErr.Code)
	}

	// Default exit code for unknown errors
	return 1
}

// printVerboseError prints detailed error information
func printVerboseError(err error) {
	if apiErr, ok := err.(*pkgerrors.APIError); ok {
		fmt.Fprintf(os.Stderr, "\n")
		fmt.Fprintf(os.Stderr, "Error Type: %s\n", pkgerrors.ErrorTypeToString(apiErr.Type))
		fmt.Fprintf(os.Stderr, "Error Code: %d\n", apiErr.Code)
		fmt.Fprintf(os.Stderr, "Message: %s\n", apiErr.Message)
		if apiErr.Cause != nil {
			fmt.Fprintf(os.Stderr, "Cause: %v\n", apiErr.Cause)
		}
		printErrorSuggestion(apiErr)
		fmt.Fprintf(os.Stderr, "\n")
	} else {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
	}
}

// printUserError prints a user-friendly error message
func printUserError(err error) {
	if apiErr, ok := err.(*pkgerrors.APIError); ok {
		fmt.Fprintf(os.Stderr, "Error: %s\n", apiErr.Message)
		if apiErr.Cause != nil {
			fmt.Fprintf(os.Stderr, "Detail: %v\n", apiErr.Cause)
		}
		printErrorSuggestion(apiErr)
	} else {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
	}
}

// printErrorSuggestion prints a suggestion for resolving the error
func printErrorSuggestion(apiErr *pkgerrors.APIError) {
	switch apiErr.Code {
	case pkgerrors.ErrConnectionFailed, pkgerrors.ErrConnectionRefused:
		fmt.Fprintf(os.Stderr, "Suggestion: Verify the target host and port. Ensure the debug server is running.\n")
	case pkgerrors.ErrConnectionTimeout:
		fmt.Fprintf(os.Stderr, "Suggestion: Check network connectivity. Consider increasing the timeout with --timeout.\n")
	case pkgerrors.ErrHandshakeFailed:
		fmt.Fprintf(os.Stderr, "Suggestion: Ensure the target is running the expected debugging protocol (e.g., JDWP for Java).\n")
	case pkgerrors.ErrResourceNotFound:
		fmt.Fprintf(os.Stderr, "Suggestion: Check that the specified thread ID or breakpoint ID exists.\n")
	case pkgerrors.ErrInvalidInput:
		fmt.Fprintf(os.Stderr, "Suggestion: Use --help to see the correct command usage.\n")
	case pkgerrors.ErrUnsupportedCommand:
		fmt.Fprintf(os.Stderr, "Suggestion: Check the protocol's capabilities with 'debugger version'.\n")
	}
}

// IsVerbose returns whether verbose mode is enabled
func IsVerbose() bool {
	return verbose
}

// IsNoColor returns whether color output is disabled
func IsNoColor() bool {
	return noColor
}

// ContainsCaseInsensitive checks if a string contains a substring case-insensitively
func ContainsCaseInsensitive(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
