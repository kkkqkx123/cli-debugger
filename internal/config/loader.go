package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Loader 配置加载器
type Loader struct {
	viper *viper.Viper
}

// NewLoader 创建新的配置加载器
func NewLoader() *Loader {
	v := viper.New()
	return &Loader{viper: v}
}

// Load 加载配置
func (l *Loader) Load(configFile string, profileName string) (*Config, error) {
	// 设置默认值
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

	// 设置环境变量
	l.viper.SetEnvPrefix("DEBUGGER")
	l.viper.AutomaticEnv()

	// 绑定环境变量到配置键
	l.viper.BindEnv("protocol", "DEBUGGER_PROTOCOL")
	l.viper.BindEnv("host", "DEBUGGER_HOST")
	l.viper.BindEnv("port", "DEBUGGER_PORT")
	l.viper.BindEnv("timeout", "DEBUGGER_TIMEOUT")
	l.viper.BindEnv("output", "DEBUGGER_OUTPUT")
	l.viper.BindEnv("color", "DEBUGGER_COLOR")
	l.viper.BindEnv("watch", "DEBUGGER_WATCH")
	l.viper.BindEnv("interval", "DEBUGGER_INTERVAL")
	l.viper.BindEnv("verbose", "DEBUGGER_VERBOSE")

	// 加载配置文件
	if configFile != "" {
		// 使用指定的配置文件
		l.viper.SetConfigFile(configFile)
	} else {
		// 查找配置文件
		l.viper.SetConfigName(".debugger")
		l.viper.AddConfigPath(".")
		l.viper.AddConfigPath("$HOME/.config/debugger")
		l.viper.AddConfigPath("/etc/debugger")
	}

	// 读取配置文件
	if err := l.viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// 配置文件存在但读取失败
			return nil, fmt.Errorf("读取配置文件失败: %v", err)
		}
		// 配置文件不存在，继续使用默认值
	}

	// 加载全局配置文件
	globalConfig, err := l.loadGlobalConfig()
	if err != nil {
		return nil, err
	}

	// 合并配置
	config := l.mergeConfigs(globalConfig, profileName)

	// 验证配置
	if err := config.Validate(); err != nil {
		return nil, err
	}

	return config, nil
}

// loadGlobalConfig 加载全局配置文件
func (l *Loader) loadGlobalConfig() (*GlobalConfig, error) {
	globalViper := viper.New()
	globalViper.SetConfigName("config")
	globalViper.SetConfigType("yaml")
	globalViper.AddConfigPath("$HOME/.config/debugger")
	globalViper.AddConfigPath("/etc/debugger")

	if err := globalViper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// 全局配置文件不存在，返回空配置
			return &GlobalConfig{
				Defaults: NewDefaultConfig(),
				Profiles: []Profile{},
				Plugins:  make(map[string]interface{}),
			}, nil
		}
		return nil, fmt.Errorf("读取全局配置文件失败: %v", err)
	}

	var globalConfig GlobalConfig
	if err := globalViper.Unmarshal(&globalConfig); err != nil {
		return nil, fmt.Errorf("解析全局配置文件失败: %v", err)
	}

	return &globalConfig, nil
}

// mergeConfigs 合并配置
func (l *Loader) mergeConfigs(globalConfig *GlobalConfig, profileName string) *Config {
	// 从全局配置获取默认值
	config := globalConfig.Defaults

	// 如果指定了配置文件，则应用该配置
	if profileName != "" {
		for _, profile := range globalConfig.Profiles {
			if profile.Name == profileName {
				// 合并配置
				config = mergeConfig(config, profile.Config)
				break
			}
		}
	}

	// 应用当前配置文件的配置
	currentConfig := Config{}
	if err := l.viper.Unmarshal(&currentConfig); err == nil {
		config = mergeConfig(config, currentConfig)
	}

	// 应用插件配置
	if globalConfig.Plugins != nil {
		config.Plugins = globalConfig.Plugins
	}

	return &config
}

// mergeConfig 合并两个配置
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
	// Color 是布尔值，需要特殊处理
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

	// 合并插件配置
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

// SaveGlobalConfig 保存全局配置
func (l *Loader) SaveGlobalConfig(config *GlobalConfig) error {
	globalPath, err := GetGlobalConfigPath()
	if err != nil {
		return err
	}

	// 确保目录存在
	if err := os.MkdirAll(filepath.Dir(globalPath), 0755); err != nil {
		return fmt.Errorf("创建配置目录失败: %v", err)
	}

	globalViper := viper.New()
	globalViper.SetConfigFile(globalPath)

	// 将配置转换为 map
	configMap := make(map[string]interface{})
	configMap["defaults"] = config.Defaults
	configMap["profiles"] = config.Profiles
	configMap["plugins"] = config.Plugins

	globalViper.Set("defaults", config.Defaults)
	globalViper.Set("profiles", config.Profiles)
	globalViper.Set("plugins", config.Plugins)

	if err := globalViper.WriteConfig(); err != nil {
		return fmt.Errorf("保存全局配置失败: %v", err)
	}

	return nil
}

// GetConfigValue 获取配置值
func (l *Loader) GetConfigValue(key string) interface{} {
	return l.viper.Get(key)
}

// SetConfigValue 设置配置值
func (l *Loader) SetConfigValue(key string, value interface{}) {
	l.viper.Set(key, value)
}

// SaveConfig 保存当前配置
func (l *Loader) SaveConfig() error {
	if l.viper.ConfigFileUsed() == "" {
		return errors.New("没有活动的配置文件")
	}

	if err := l.viper.WriteConfig(); err != nil {
		return fmt.Errorf("保存配置文件失败: %v", err)
	}

	return nil
}