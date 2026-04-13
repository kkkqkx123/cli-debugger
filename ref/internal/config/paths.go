package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// GetGlobalConfigPath Get global configuration path
func GetGlobalConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("Failed to get user home directory: %v", err)
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

// GetProjectConfigPath Get the path to the project configuration file.
func GetProjectConfigPath() string {
	return ".debugger.yaml"
}

// GetConfigSearchPaths Get Config Search Paths
func GetConfigSearchPaths() []string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = ""
	}

	var paths []string

	// 1. Current catalog
	paths = append(paths, ".")

	// 2. User configuration directory
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

	// 3. System configuration directory
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

// EnsureConfigDir Ensure that the configuration directory exists
func EnsureConfigDir() (string, error) {
	configPath, err := GetGlobalConfigPath()
	if err != nil {
		return "", err
	}

	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", fmt.Errorf("Failed to create configuration directory: %v", err)
	}

	return configDir, nil
}

// GetPluginConfigPath Get Plugin Config Path
func GetPluginConfigPath(pluginName string) (string, error) {
	configDir, err := EnsureConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, fmt.Sprintf("plugin-%s.yaml", pluginName)), nil
}

// GetCacheDir Get cache directory
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
		return "", fmt.Errorf("Failed to create cache directory: %v", err)
	}

	return cacheDir, nil
}

// GetLogDir Get Log Directory
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
		return "", fmt.Errorf("Failed to create log directory: %v", err)
	}

	return logDir, nil
}