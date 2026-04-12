package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewDefaultConfig(t *testing.T) {
	config := NewDefaultConfig()

	if config.Protocol != "jdwp" {
		t.Errorf("默认协议应为 jdwp, 实际：%s", config.Protocol)
	}
	if config.Host != "127.0.0.1" {
		t.Errorf("默认主机应为 127.0.0.1, 实际：%s", config.Host)
	}
	if config.Port != 5005 {
		t.Errorf("默认端口应为 5005, 实际：%d", config.Port)
	}
	if config.Timeout != 30 {
		t.Errorf("默认超时应为 30, 实际：%d", config.Timeout)
	}
}

func TestConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{
			name: "有效配置",
			config: Config{
				Protocol: "jdwp",
				Host:     "127.0.0.1",
				Port:     5005,
				Timeout:  30,
			},
			wantErr: false,
		},
		{
			name: "空协议",
			config: Config{
				Protocol: "",
				Host:     "127.0.0.1",
				Port:     5005,
				Timeout:  30,
			},
			wantErr: true,
		},
		{
			name: "无效端口",
			config: Config{
				Protocol: "jdwp",
				Host:     "127.0.0.1",
				Port:     99999,
				Timeout:  30,
			},
			wantErr: true,
		},
		{
			name: "无效输出格式",
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
		t.Errorf("GetGlobalConfigPath 失败：%v", err)
	}
	if path == "" {
		t.Error("全局配置路径不应为空")
	}
}

func TestGetProjectConfigPath(t *testing.T) {
	path := GetProjectConfigPath()
	expected := ".debugger.yaml"
	if path != expected {
		t.Errorf("项目配置路径应为 %s, 实际：%s", expected, path)
	}
}

func TestEnsureConfigDir(t *testing.T) {
	dir, err := EnsureConfigDir()
	if err != nil {
		t.Errorf("EnsureConfigDir 失败：%v", err)
	}
	if dir == "" {
		t.Error("配置目录路径不应为空")
	}

	// 检查目录是否存在
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Errorf("配置目录 %s 不存在", dir)
	}
}

func TestGetConfigSearchPaths(t *testing.T) {
	paths := GetConfigSearchPaths()
	if len(paths) == 0 {
		t.Error("配置搜索路径不应为空")
	}

	// 当前目录应该始终在列表中
	found := false
	for _, p := range paths {
		if p == "." {
			found = true
			break
		}
	}
	if !found {
		t.Error("当前目录应该在配置搜索路径中")
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
		t.Errorf("协议应保持为 jdwp, 实际：%s", result.Protocol)
	}
	if result.Host != "192.168.1.100" {
		t.Errorf("主机应被覆盖为 192.168.1.100, 实际：%s", result.Host)
	}
	if result.Port != 6000 {
		t.Errorf("端口应被覆盖为 6000, 实际：%d", result.Port)
	}
	if result.Color != false {
		t.Errorf("Color 应被覆盖为 false, 实际：%v", result.Color)
	}
}

func TestValidationError(t *testing.T) {
	err := NewValidationError("port", "端口号必须在 1-65535 范围内")
	if err == nil {
		t.Fatal("ValidationError 不应为 nil")
	}

	expectedMsg := "配置验证失败 [port]: 端口号必须在 1-65535 范围内"
	if err.Error() != expectedMsg {
		t.Errorf("错误消息应为 %q, 实际：%q", expectedMsg, err.Error())
	}
}

func TestLoader_NewLoader(t *testing.T) {
	loader := NewLoader()
	if loader == nil {
		t.Error("Loader 不应为 nil")
	}
	if loader.viper == nil {
		t.Error("viper 实例不应为 nil")
	}
}

func TestLoader_LoadWithTempFile(t *testing.T) {
	// 创建临时配置文件
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, ".debugger.yaml")

	configContent := `protocol: jdwp
host: 127.0.0.1
port: 5005
timeout: 30
output: text
`

	if err := os.WriteFile(configFile, []byte(configContent), 0644); err != nil {
		t.Fatalf("写入临时配置文件失败：%v", err)
	}

	// 加载配置
	loader := NewLoader()
	config, err := loader.Load(configFile, "")
	if err != nil {
		t.Errorf("加载配置失败：%v", err)
	}

	if config.Protocol != "jdwp" {
		t.Errorf("协议应为 jdwp, 实际：%s", config.Protocol)
	}
	if config.Port != 5005 {
		t.Errorf("端口应为 5005, 实际：%d", config.Port)
	}
}