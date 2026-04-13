package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Loader Configuration Loader
type Loader struct {
	viper *viper.Viper
}

// NewLoader Creates a new configuration loader.
func NewLoader() *Loader {
	v := viper.New()
	return &Loader{viper: v}
}

// Load Load Configuration
func (l *Loader) Load(configFile string, profileName string) (*Config, error) {
	// Setting default values
	defaultConfig := NewDefaultConfig()
	l.viper.SetDefault("protocol", defaultConfig.Protocol)
	l.viper.SetDefault("host", defaultConfig.Host)
	l.viper.SetDefault("port", defaultConfig.Port)
	l.viper.SetDefault("timeout", defaultConfig.Timeout)
	l.viper.SetDefault("output", defaultConfig.Output)
	l.viper.SetDefault("color", defaultConfig.Color)
	l.viper.SetDefault("watch", defaultConfig.Watch)
	l.viper.SetDefault("interval", defaultConfig.Interval)
	l.viper.SetDefault("verbose", defaultConfig.Verbose)

	// Setting environment variables
	l.viper.SetEnvPrefix("DEBUGGER")
	l.viper.AutomaticEnv()

	// Bind environment variables to configuration keys
	l.viper.BindEnv("protocol", "DEBUGGER_PROTOCOL")
	l.viper.BindEnv("host", "DEBUGGER_HOST")
	l.viper.BindEnv("port", "DEBUGGER_PORT")
	l.viper.BindEnv("timeout", "DEBUGGER_TIMEOUT")
	l.viper.BindEnv("output", "DEBUGGER_OUTPUT")
	l.viper.BindEnv("color", "DEBUGGER_COLOR")
	l.viper.BindEnv("watch", "DEBUGGER_WATCH")
	l.viper.BindEnv("interval", "DEBUGGER_INTERVAL")
	l.viper.BindEnv("verbose", "DEBUGGER_VERBOSE")

	// Load Configuration File
	if configFile != "" {
		// Use the specified configuration file
		l.viper.SetConfigFile(configFile)
	} else {
		// Find Configuration File
		l.viper.SetConfigName(".debugger")
		l.viper.AddConfigPath(".")
		l.viper.AddConfigPath("$HOME/.config/debugger")
		l.viper.AddConfigPath("/etc/debugger")
	}

	// Read configuration file
	if err := l.viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// Configuration file exists but reading failed
			return nil, fmt.Errorf("Failed to read configuration file: %v", err)
		}
		// Configuration file does not exist, continue to use the default
	}

	// Loading the global configuration file
	globalConfig, err := l.loadGlobalConfig()
	if err != nil {
		return nil, err
	}

	// Merge Configuration
	config := l.mergeConfigs(globalConfig, profileName)

	// Verify Configuration
	if err := config.Validate(); err != nil {
		return nil, err
	}

	return config, nil
}

// loadGlobalConfig Load Global Configuration File
func (l *Loader) loadGlobalConfig() (*GlobalConfig, error) {
	globalViper := viper.New()
	globalViper.SetConfigName("config")
	globalViper.SetConfigType("yaml")
	globalViper.AddConfigPath("$HOME/.config/debugger")
	globalViper.AddConfigPath("/etc/debugger")

	if err := globalViper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Global configuration file does not exist, return empty configuration
			return &GlobalConfig{
				Defaults: NewDefaultConfig(),
				Profiles: []Profile{},
				Plugins:  make(map[string]interface{}),
			}, nil
		}
		return nil, fmt.Errorf("Failed to read global configuration file: %v", err)
	}

	var globalConfig GlobalConfig
	if err := globalViper.Unmarshal(&globalConfig); err != nil {
		return nil, fmt.Errorf("Failed to parse global configuration file: %v", err)
	}

	return &globalConfig, nil
}

// mergeConfigs mergeConfigs
func (l *Loader) mergeConfigs(globalConfig *GlobalConfig, profileName string) *Config {
	// Getting default values from global configuration
	config := globalConfig.Defaults

	// If a configuration file is specified, the configuration is applied
	if profileName != "" {
		for _, profile := range globalConfig.Profiles {
			if profile.Name == profileName {
				// Merge Configuration
				config = mergeConfig(config, profile.Config)
				break
			}
		}
	}

	// Apply the configuration of the current profile
	currentConfig := Config{}
	if err := l.viper.Unmarshal(&currentConfig); err == nil {
		config = mergeConfig(config, currentConfig)
	}

	// Application Plugin Configuration
	if globalConfig.Plugins != nil {
		config.Plugins = globalConfig.Plugins
	}

	return &config
}

// mergeConfig merges two configurations
func mergeConfig(base, override Config) Config {
	result := base

	if override.Protocol != "" {
		result.Protocol = override.Protocol
	}
	if override.Host != "" {
		result.Host = override.Host
	}
	if override.Port != 0 {
		result.Port = override.Port
	}
	if override.Timeout != 0 {
		result.Timeout = override.Timeout
	}
	if override.Output != "" {
		result.Output = override.Output
	}
	// Color is a boolean value and requires special handling
	if override.Color != base.Color {
		result.Color = override.Color
	}
	if override.Watch != base.Watch {
		result.Watch = override.Watch
	}
	if override.Interval != 0 {
		result.Interval = override.Interval
	}
	if override.Verbose != base.Verbose {
		result.Verbose = override.Verbose
	}

	// Merge Plugin Configuration
	if override.Plugins != nil {
		if result.Plugins == nil {
			result.Plugins = make(map[string]interface{})
		}
		for k, v := range override.Plugins {
			result.Plugins[k] = v
		}
	}

	return result
}

// SaveGlobalConfig Saves the global configuration.
func (l *Loader) SaveGlobalConfig(config *GlobalConfig) error {
	globalPath, err := GetGlobalConfigPath()
	if err != nil {
		return err
	}

	// Make sure the catalog exists
	if err := os.MkdirAll(filepath.Dir(globalPath), 0755); err != nil {
		return fmt.Errorf("Failed to create configuration directory: %v", err)
	}

	globalViper := viper.New()
	globalViper.SetConfigFile(globalPath)

	// Converting a configuration to a map
	configMap := make(map[string]interface{})
	configMap["defaults"] = config.Defaults
	configMap["profiles"] = config.Profiles
	configMap["plugins"] = config.Plugins

	globalViper.Set("defaults", config.Defaults)
	globalViper.Set("profiles", config.Profiles)
	globalViper.Set("plugins", config.Plugins)

	if err := globalViper.WriteConfig(); err != nil {
		return fmt.Errorf("Failed to save global configuration: %v", err)
	}

	return nil
}

// GetConfigValue Get Configuration Value
func (l *Loader) GetConfigValue(key string) interface{} {
	return l.viper.Get(key)
}

// SetConfigValue Sets the configuration value.
func (l *Loader) SetConfigValue(key string, value interface{}) {
	l.viper.Set(key, value)
}

// SaveConfig saves the current configuration
func (l *Loader) SaveConfig() error {
	if l.viper.ConfigFileUsed() == "" {
		return errors.New("No active profiles")
	}

	if err := l.viper.WriteConfig(); err != nil {
		return fmt.Errorf("Failed to save configuration file: %v", err)
	}

	return nil
}