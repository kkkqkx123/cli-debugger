package jdwp

import (
	"testing"
)

func TestNewPlugin(t *testing.T) {
	plugin := NewPlugin()
	if plugin == nil {
		t.Error("Plugin should not be nil")
	}
	if plugin.client == nil {
		t.Error("client should not be nil")
	}
}

func TestNewClient(t *testing.T) {
	client := NewClient()
	if client == nil {
		t.Error("Client should not be nil")
	}
	if client.port != 5005 {
		t.Errorf("The default port should be 5005; the actual port is: %d", client.port)
	}
	if client.timeout != 30*1e9 { // 30 seconds in nanoseconds
		t.Errorf("The default timeout should be 30s, actual: %v", client.timeout)
	}
}

func TestSetConfig(t *testing.T) {
	client := NewClient()
	client.SetConfig("192.168.1.100", 6000, 60)

	if client.host != "192.168.1.100" {
		t.Errorf("The host should be 192.168.1.100; the actual value is: %s", client.host)
	}
	if client.port != 6000 {
		t.Errorf("Port should be 6000, actual: %d", client.port)
	}
}

func TestIsConnected(t *testing.T) {
	client := NewClient()
	if client.IsConnected() {
		t.Error("New clients should not be connected")
	}
}

func TestProtocolName(t *testing.T) {
	plugin := NewPlugin()
	name := plugin.ProtocolName()
	if name != "jdwp" {
		t.Errorf("The protocol name should be jdwp; the actual one is: %s", name)
	}
}

func TestSupportedLanguages(t *testing.T) {
	plugin := NewPlugin()
	languages := plugin.SupportedLanguages()
	if len(languages) == 0 {
		t.Error("The list of supported languages should not be empty")
	}

	expectedLanguages := []string{"java", "kotlin", "scala"}
	for i, lang := range expectedLanguages {
		if i >= len(languages) || languages[i] != lang {
			t.Errorf("Supported languages should contain %s", lang)
		}
	}
}

func TestCapabilities(t *testing.T) {
	plugin := NewPlugin()
	caps, err := plugin.Capabilities(nil)
	if err != nil {
		t.Errorf("Ability acquisition failed: %v", err)
	}
	if caps == nil {
		t.Error("Capability should not be nil")
	}
	if !caps.SupportsVersion {
		t.Error("The Version command should be supported")
	}
	if !caps.SupportsThreads {
		t.Error("The Threads command should be supported")
	}
	if !caps.SupportsBreakpoints {
		t.Error("The Breakpoints command should be supported")
	}
}

func TestEncodeString(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"hello", 9},      // 4 bytes length + 5 bytes string
		{"", 4},           // 4 bytes length + 0 bytes string
		{"test123", 11},   // 4 bytes length + 7 bytes string
	}

	for _, tt := range tests {
		result := EncodeString(tt.input)
		if len(result) != tt.expected {
			t.Errorf("EncodeString(%q) 长度应为 %d, 实际：%d", tt.input, tt.expected, len(result))
		}
	}
}

func TestDecodeString(t *testing.T) {
	tests := []struct {
		input    []byte
		expected string
		hasError bool
	}{
		{[]byte{0, 0, 0, 5, 'h', 'e', 'l', 'l', 'o'}, "hello", false},
		{[]byte{0, 0, 0, 0}, "", false},
		{[]byte{0, 0, 0}, "", true}, // Data too short
	}

	for _, tt := range tests {
		result, _, err := DecodeString(tt.input)
		if tt.hasError {
			if err == nil {
				t.Error("should return an error")
			}
		} else {
			if err != nil {
				t.Errorf("No error should be returned: %v", err)
			}
			if result != tt.expected {
				t.Errorf("DecodeString result should be %q, actual: %q", tt.expected, result)
			}
		}
	}
}

func TestBytesToUint32(t *testing.T) {
	tests := []struct {
		input    []byte
		expected uint32
	}{
		{[]byte{0, 0, 0, 1}, 1},
		{[]byte{0, 0, 1, 0}, 256},
		{[]byte{0, 1, 0, 0}, 65536},
		{[]byte{1, 0, 0, 0}, 16777216},
		{[]byte{255, 255, 255, 255}, 4294967295},
	}

	for _, tt := range tests {
		result := bytesToUint32(tt.input)
		if result != tt.expected {
			t.Errorf("bytesToUint32(%v) 应为 %d, 实际：%d", tt.input, tt.expected, result)
		}
	}
}

func TestUint32ToBytes(t *testing.T) {
	tests := []struct {
		input    uint32
		expected []byte
	}{
		{1, []byte{0, 0, 0, 1}},
		{256, []byte{0, 0, 1, 0}},
		{65536, []byte{0, 1, 0, 0}},
		{16777216, []byte{1, 0, 0, 0}},
	}

	for _, tt := range tests {
		result := uint32ToBytes(tt.input)
		for i, b := range tt.expected {
			if result[i] != b {
				t.Errorf("uint32ToBytes(%d) 位置 %d 应为 %d, 实际：%d", tt.input, i, b, result[i])
			}
		}
	}
}

func TestGetThreadStateString(t *testing.T) {
	tests := []struct {
		input    int
		expected string
	}{
		{ThreadStateZombie, "zombie"},
		{ThreadStateRunning, "running"},
		{ThreadStateSleeping, "sleeping"},
		{ThreadStateMonitor, "waiting-for-monitor"},
		{ThreadStateWait, "waiting"},
		{ThreadStateNotStarted, "not-started"},
		{999, "unknown(999)"},
	}

	for _, tt := range tests {
		result := GetThreadStateString(tt.input)
		if result != tt.expected {
			t.Errorf("GetThreadStateString(%d) 应为 %q, 实际：%q", tt.input, tt.expected, result)
		}
	}
}

func TestJDWPError(t *testing.T) {
	tests := []struct {
		code     JDWPError
		expected string
	}{
		{ErrNone, "error-free"},
		{ErrInvalidClass, "void class"},
		{ErrOutOfMemory, "lack of memory"},
		{JDWPError(999), "Unknown error (999)"},
	}

	for _, tt := range tests {
		result := tt.code.Error()
		if result != tt.expected {
			t.Errorf("JDWPError(%d).Error() 应为 %q, 实际：%q", tt.code, tt.expected, result)
		}
	}
}

func TestPacketReader(t *testing.T) {
	data := []byte{0, 0, 0, 5, 'h', 'e', 'l', 'l', 'o', 0, 0, 0, 42}
	reader := newPacketReader(data)

	// Test Reading Strings
	str, err := reader.readString()
	if err != nil {
		t.Errorf("String reading failed: %v", err)
	}
	if str != "hello" {
		t.Errorf("The string should be hello, but it's actually %s.", str)
	}

	// Test reading integers
	val := reader.readInt()
	if val != 42 {
		t.Errorf("The integer should be 42; the actual value is: %d", val)
	}
}

func TestIsPrimitiveTag(t *testing.T) {
	primitiveTags := []byte{'B', 'C', 'D', 'F', 'I', 'J', 'S', 'Z'}
	nonPrimitiveTags := []byte{'L', 'A', 'N', 'V'}

	for _, tag := range primitiveTags {
		if !isPrimitiveTag(tag) {
			t.Errorf("%c should be the original type", tag)
		}
	}

	for _, tag := range nonPrimitiveTags {
		if isPrimitiveTag(tag) {
			t.Errorf("%c should not be the original type", tag)
		}
	}
}