package config

import (
	"cli-debugger/pkg/errors"
)

// Config Global Configuration Structure
type Config struct {
	// Connection Configuration
	Protocol string `mapstructure:"protocol" yaml:"protocol" toml:"protocol"`
	Host     string `mapstructure:"host" yaml:"host" toml:"host"`
	Port     int    `mapstructure:"port" yaml:"port" toml:"port"`
	Timeout  int    `mapstructure:"timeout" yaml:"timeout" toml:"timeout"`

	// Output Configuration
	Output   string `mapstructure:"output" yaml:"output" toml:"output"`
	Color    bool   `mapstructure:"color" yaml:"color" toml:"color"`

	// Monitor Mode Configuration
	Watch    bool   `mapstructure:"watch" yaml:"watch" toml:"watch"`
	Interval int    `mapstructure:"interval" yaml:"interval" toml:"interval"`

	// Debugging Configuration
	Verbose  bool   `mapstructure:"verbose" yaml:"verbose" toml:"verbose"`

	// Plugin Specific Configuration
	Plugins  map[string]interface{} `mapstructure:"plugins" yaml:"plugins" toml:"plugins"`
}

// Profile Naming a profile
type Profile struct {
	Name   string `mapstructure:"name" yaml:"name" toml:"name"`
	Config Config `mapstructure:"config" yaml:"config" toml:"config"`
}

// GlobalConfig global configuration file structure
type GlobalConfig struct {
	// default configuration
	Defaults Config `mapstructure:"defaults" yaml:"defaults" toml:"defaults"`

	// Naming Configuration Files
	Profiles []Profile `mapstructure:"profiles" yaml:"profiles" toml:"profiles"`

	// Plug-in Configuration
	Plugins map[string]interface{} `mapstructure:"plugins" yaml:"plugins" toml:"plugins"`
}

// NewDefaultConfig Creating a Default Configuration
func NewDefaultConfig() Config {
	return Config{
		Protocol: "jdwp",
		Host:     "127.0.0.1",
		Port:     5005,
		Timeout:  30,
		Output:   "text",
		Color:    true,
		Watch:    false,
		Interval: 1,
		Verbose:  false,
		Plugins:  make(map[string]interface{}),
	}
}

// Validate Validates the configuration
func (c *Config) Validate() error {
	if err := errors.ValidateRequired("protocol", c.Protocol); err != nil {
		return err
	}
	if err := errors.ValidateRequired("host", c.Host); err != nil {
		return err
	}
	if err := errors.ValidateRange("port", c.Port, 1, 65535); err != nil {
		return err
	}
	if err := errors.ValidatePositive("timeout", c.Timeout); err != nil {
		return err
	}
	if c.Output != "" && c.Output != "text" && c.Output != "json" && c.Output != "table" {
		return errors.NewInputError(errors.ErrInvalidFormat, "The output format must be text, json or table.")
	}
	if c.Interval != 0 {
		if err := errors.ValidatePositive("interval", c.Interval); err != nil {
			return err
		}
	}
	return nil
}
