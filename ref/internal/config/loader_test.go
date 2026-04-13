package config

import (
	"os"
	"path/filepath"
	"testing"

	"cli-debugger/pkg/errors"
)

func TestNewDefaultConfig(t *testing.T) {
	config := NewDefaultConfig()

	if config.Protocol != "jdwp" {
		t.Errorf("The default protocol should be jdwp; the actual protocol is: %s", config.Protocol)
	}
	if config.Host != "127.0.0.1" {
		t.Errorf("The default host should be 127.0.0.1; the actual host is: %s", config.Host)
	}
	if config.Port != 5005 {
		t.Errorf("The default port should be 5005; the actual port is: %d", config.Port)
	}
	if config.Timeout != 30 {
		t.Errorf("The default timeout should be 30, but the actual value is: %d", config.Timeout)
	}
}

func TestConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{
			name: "Efficient Configuration",
			config: Config{
				Protocol: "jdwp",
				Host:     "127.0.0.1",
				Port:     5005,
				Timeout:  30,
			},
			wantErr: false,
		},
		{
			name: "null hypothesis",
			config: Config{
				Protocol: "",
				Host:     "127.0.0.1",
				Port:     5005,
				Timeout:  30,
			},
			wantErr: true,
		},
		{
			name: "invalid port (computing)",
			config: Config{
				Protocol: "jdwp",
				Host:     "127.0.0.1",
				Port:     99999,
				Timeout:  30,
			},
			wantErr: true,
		},
		{
			name: "Invalid output format",
			config: Config{
				Protocol: "jdwp",
				Host:     "127.0.0.1",
				Port:     5005,
				Timeout:  30,
				Output:   "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGetGlobalConfigPath(t *testing.T) {
	path, err := GetGlobalConfigPath()
	if err != nil {
		t.Errorf("GetGlobalConfigPath failed: %v", err)
	}
	if path == "" {
		t.Error("The global configuration path should not be empty")
	}
}

func TestGetProjectConfigPath(t *testing.T) {
	path := GetProjectConfigPath()
	expected := ".debugger.yaml"
	if path != expected {
		t.Errorf("The project configuration path should be %s, but the actual path is %s.", expected, path)
	}
}

func TestEnsureConfigDir(t *testing.T) {
	dir, err := EnsureConfigDir()
	if err != nil {
		t.Errorf("EnsureConfigDir failed: %v", err)
	}
	if dir == "" {
		t.Error("The configuration directory path should not be empty")
	}

	// Check if the directory exists
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Errorf("The configuration directory %s does not exist.", dir)
	}
}

func TestGetConfigSearchPaths(t *testing.T) {
	paths := GetConfigSearchPaths()
	if len(paths) == 0 {
		t.Error("Configuring the search path should not be empty")
	}

	// The current directory should always be in the list
	found := false
	for _, p := range paths {
		if p == "." {
			found = true
			break
		}
	}
	if !found {
		t.Error("The current directory should be in the configuration search path")
	}
}

func TestMergeConfig(t *testing.T) {
	base := Config{
		Protocol: "jdwp",
		Host:     "127.0.0.1",
		Port:     5005,
		Timeout:  30,
		Output:   "text",
		Color:    true,
	}

	override := Config{
		Host:  "192.168.1.100",
		Port:  6000,
		Color: false,
	}

	result := mergeConfig(base, override)

	if result.Protocol != "jdwp" {
		t.Errorf("The protocol should remain jdwp; the actual value is: %s", result.Protocol)
	}
	if result.Host != "192.168.1.100" {
		t.Errorf("The host should be set to 192.168.1.100; the actual value is: %s", result.Host)
	}
	if result.Port != 6000 {
		t.Errorf("The port should be set to 6000; the actual value is: %d", result.Port)
	}
	if result.Color != false {
		t.Errorf(`The value of "Color" should be overridden to "false"; the actual value is: %v.`, result.Color)
	}
}

func TestValidationError(t *testing.T) {
	err := errors.NewInputError(errors.ErrOutOfRange, "The port number must be in the range 1-65535")
	if err == nil {
		t.Fatal("ValidationError should not be nil")
	}

	expectedMsg := "[input:103] The port number must be in the range 1-65535"
	if err.Error() != expectedMsg {
		t.Errorf("Error message should be %q, actual: %q", expectedMsg, err.Error())
	}
}

func TestLoader_NewLoader(t *testing.T) {
	loader := NewLoader()
	if loader == nil {
		t.Error("Loader should not be nil")
	}
	if loader.viper == nil {
		t.Error("The viper instance should not be nil")
	}
}

func TestLoader_LoadWithTempFile(t *testing.T) {
	// Creating a Temporary Configuration File
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, ".debugger.yaml")

	configContent := `protocol: jdwp
host: 127.0.0.1
port: 5005
timeout: 30
output: text
`

	if err := os.WriteFile(configFile, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write to the temporary configuration file: %v", err)
	}

	// Load Configuration
	loader := NewLoader()
	config, err := loader.Load(configFile, "")
	if err != nil {
		t.Errorf("Configuration loading failed: %v", err)
	}

	if config.Protocol != "jdwp" {
		t.Errorf("The protocol should be jdwp, but the actual one is: %s", config.Protocol)
	}
	if config.Port != 5005 {
		t.Errorf("The port should be 5005; the actual value is: %d", config.Port)
	}
}