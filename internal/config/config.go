package config

import (
	"fmt"
)

// Config 全局配置结构
type Config struct {
	// 连接配置
	Protocol string `mapstructure:"protocol" yaml:"protocol" toml:"protocol"`
	Host     string `mapstructure:"host" yaml:"host" toml:"host"`
	Port     int    `mapstructure:"port" yaml:"port" toml:"port"`
	Timeout  int    `mapstructure:"timeout" yaml:"timeout" toml:"timeout"`

	// 输出配置
	Output   string `mapstructure:"output" yaml:"output" toml:"output"`
	Color    bool   `mapstructure:"color" yaml:"color" toml:"color"`

	// 监控模式配置
	Watch    bool   `mapstructure:"watch" yaml:"watch" toml:"watch"`
	Interval int    `mapstructure:"interval" yaml:"interval" toml:"interval"`

	// 调试配置
	Verbose  bool   `mapstructure:"verbose" yaml:"verbose" toml:"verbose"`

	// 插件特定配置
	Plugins  map[string]interface{} `mapstructure:"plugins" yaml:"plugins" toml:"plugins"`
}

// Profile 命名配置文件
type Profile struct {
	Name   string `mapstructure:"name" yaml:"name" toml:"name"`
	Config Config `mapstructure:"config" yaml:"config" toml:"config"`
}

// GlobalConfig 全局配置文件结构
type GlobalConfig struct {
	// 默认配置
	Defaults Config `mapstructure:"defaults" yaml:"defaults" toml:"defaults"`

	// 命名配置文件
	Profiles []Profile `mapstructure:"profiles" yaml:"profiles" toml:"profiles"`

	// 插件配置
	Plugins map[string]interface{} `mapstructure:"plugins" yaml:"plugins" toml:"plugins"`
}

// NewDefaultConfig 创建默认配置
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

// Validate 验证配置
func (c *Config) Validate() error {
	if c.Protocol == "" {
		return NewValidationError("protocol", "协议名称不能为空")
	}
	if c.Host == "" {
		return NewValidationError("host", "主机地址不能为空")
	}
	if c.Port <= 0 || c.Port > 65535 {
		return NewValidationError("port", "端口号必须在 1-65535 范围内")
	}
	if c.Timeout <= 0 {
		return NewValidationError("timeout", "超时时间必须大于 0")
	}
	if c.Output != "text" && c.Output != "json" && c.Output != "table" {
		return NewValidationError("output", "输出格式必须是 text, json 或 table")
	}
	if c.Interval <= 0 {
		return NewValidationError("interval", "监控间隔必须大于 0")
	}
	return nil
}

// ValidationError 配置验证错误
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("配置验证失败 [%s]: %s", e.Field, e.Message)
}

func NewValidationError(field, message string) *ValidationError {
	return &ValidationError{
		Field:   field,
		Message: message,
	}
}