package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// GetGlobalConfigPath 获取全局配置文件路径
func GetGlobalConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("获取用户主目录失败: %v", err)
	}

	var configDir string
	switch runtime.GOOS {
	case "windows":
		// Windows: %APPDATA%\debugger\config.yaml
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(homeDir, "AppData", "Roaming")
		}
		configDir = filepath.Join(appData, "debugger")
	case "darwin":
		// macOS: ~/Library/Application Support/debugger/config.yaml
		configDir = filepath.Join(homeDir, "Library", "Application Support", "debugger")
	default:
		// Linux/Unix: ~/.config/debugger/config.yaml
		configDir = filepath.Join(homeDir, ".config", "debugger")
	}

	return filepath.Join(configDir, "config.yaml"), nil
}

// GetProjectConfigPath 获取项目配置文件路径
func GetProjectConfigPath() string {
	return ".debugger.yaml"
}

// GetConfigSearchPaths 获取配置文件搜索路径
func GetConfigSearchPaths() []string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = ""
	}

	var paths []string

	// 1. 当前目录
	paths = append(paths, ".")

	// 2. 用户配置目录
	if homeDir != "" {
		switch runtime.GOOS {
		case "windows":
			appData := os.Getenv("APPDATA")
			if appData == "" {
				appData = filepath.Join(homeDir, "AppData", "Roaming")
			}
			paths = append(paths, filepath.Join(appData, "debugger"))
		case "darwin":
			paths = append(paths, filepath.Join(homeDir, "Library", "Application Support", "debugger"))
		default:
			paths = append(paths, filepath.Join(homeDir, ".config", "debugger"))
		}
	}

	// 3. 系统配置目录
	switch runtime.GOOS {
	case "windows":
		programData := os.Getenv("PROGRAMDATA")
		if programData != "" {
			paths = append(paths, filepath.Join(programData, "debugger"))
		}
	case "darwin":
		paths = append(paths, "/Library/Application Support/debugger")
	default:
		paths = append(paths, "/etc/debugger")
	}

	return paths
}

// EnsureConfigDir 确保配置目录存在
func EnsureConfigDir() (string, error) {
	configPath, err := GetGlobalConfigPath()
	if err != nil {
		return "", err
	}

	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", fmt.Errorf("创建配置目录失败: %v", err)
	}

	return configDir, nil
}

// GetPluginConfigPath 获取插件配置文件路径
func GetPluginConfigPath(pluginName string) (string, error) {
	configDir, err := EnsureConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, fmt.Sprintf("plugin-%s.yaml", pluginName)), nil
}

// GetCacheDir 获取缓存目录
func GetCacheDir() (string, error) {
	var cacheDir string
	switch runtime.GOOS {
	case "windows":
		// Windows: %LOCALAPPDATA%\debugger\cache
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			localAppData = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local")
		}
		cacheDir = filepath.Join(localAppData, "debugger", "cache")
	case "darwin":
		// macOS: ~/Library/Caches/debugger
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		cacheDir = filepath.Join(homeDir, "Library", "Caches", "debugger")
	default:
		// Linux/Unix: ~/.cache/debugger
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		cacheDir = filepath.Join(homeDir, ".cache", "debugger")
	}

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return "", fmt.Errorf("创建缓存目录失败: %v", err)
	}

	return cacheDir, nil
}

// GetLogDir 获取日志目录
func GetLogDir() (string, error) {
	var logDir string
	switch runtime.GOOS {
	case "windows":
		// Windows: %LOCALAPPDATA%\debugger\logs
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			localAppData = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local")
		}
		logDir = filepath.Join(localAppData, "debugger", "logs")
	case "darwin":
		// macOS: ~/Library/Logs/debugger
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		logDir = filepath.Join(homeDir, "Library", "Logs", "debugger")
	default:
		// Linux/Unix: ~/.local/share/debugger/logs
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		logDir = filepath.Join(homeDir, ".local", "share", "debugger", "logs")
	}

	if err := os.MkdirAll(logDir, 0755); err != nil {
		return "", fmt.Errorf("创建日志目录失败: %v", err)
	}

	return logDir, nil
}