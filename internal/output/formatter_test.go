package output

import (
	"bytes"
	"testing"
	"time"

	"cli-debugger/pkg/types"
)

func TestNewTextFormatter(t *testing.T) {
	f := NewTextFormatter(true)
	if f == nil {
		t.Error("TextFormatter should not be nil")
	}
	if !f.color {
		t.Error("color should be true")
	}
}

func TestNewJSONFormatter(t *testing.T) {
	f := NewJSONFormatter()
	if f == nil {
		t.Error("JSONFormatter should not be nil.")
	}
}

func TestNewTableFormatter(t *testing.T) {
	f := NewTableFormatter(true)
	if f == nil {
		t.Error("TableFormatter should not be nil")
	}
}

func TestGetFormatterType(t *testing.T) {
	tests := []struct {
		input    string
		expected FormatterType
	}{
		{"text", TextFormatType},
		{"json", JSONFormatType},
		{"table", TableFormatType},
		{"invalid", TextFormatType}, // default value
		{"", TextFormatType},        // Empty String Default Value
	}

	for _, tt := range tests {
		result := GetFormatterType(tt.input)
		if result != tt.expected {
			t.Errorf("GetFormatterType(%q) = %v, expected %v", tt.input, result, tt.expected)
		}
	}
}

func TestNewFormatter(t *testing.T) {
	tests := []struct {
		typeStr  string
		expected FormatterType
	}{
		{"text", TextFormatType},
		{"json", JSONFormatType},
		{"table", TableFormatType},
	}

	for _, tt := range tests {
		f := NewFormatter(tt.expected, true)
		if f == nil {
			t.Errorf("NewFormatter(%q) 返回 nil", tt.typeStr)
		}
	}
}

func TestTextFormatter_FormatVersion(t *testing.T) {
	var buf bytes.Buffer
	f := NewTextFormatter(false)
	f.SetWriter(&buf)

	info := &types.VersionInfo{
		ProtocolVersion: "1.8",
		RuntimeVersion:  "17.0.8",
		RuntimeName:     "OpenJDK",
		Description:     "Test JVM",
	}

	err := f.FormatVersion(info)
	if err != nil {
		t.Errorf("FormatVersion failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Output should not be null")
	}
}

func TestTextFormatter_FormatThreads(t *testing.T) {
	var buf bytes.Buffer
	f := NewTextFormatter(false)
	f.SetWriter(&buf)

	threads := []*types.ThreadInfo{
		{ID: "1", Name: "main", State: "running", Priority: 5},
		{ID: "2", Name: "worker", State: "waiting", Priority: 3, IsDaemon: true},
	}

	err := f.FormatThreads(threads)
	if err != nil {
		t.Errorf("FormatThreads failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Output should not be null")
	}
}

func TestTextFormatter_FormatStack(t *testing.T) {
	var buf bytes.Buffer
	f := NewTextFormatter(false)
	f.SetWriter(&buf)

	frames := []*types.StackFrame{
		{ID: "1", Method: "main", Location: "com.example.Main", Line: 10},
		{ID: "2", Method: "run", Location: "com.example.Worker", Line: 25, IsNative: true},
	}

	err := f.FormatStack(frames)
	if err != nil {
		t.Errorf("FormatStack failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Output should not be null")
	}
}

func TestTextFormatter_FormatVariables(t *testing.T) {
	var buf bytes.Buffer
	f := NewTextFormatter(false)
	f.SetWriter(&buf)

	variables := []*types.Variable{
		{Name: "count", Type: "int", Value: 42, IsPrimitive: true},
		{Name: "name", Type: "String", Value: "test", IsPrimitive: false},
		{Name: "active", Type: "boolean", Value: true, IsPrimitive: true},
	}

	err := f.FormatVariables(variables)
	if err != nil {
		t.Errorf("FormatVariables failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Output should not be null")
	}
}

func TestTextFormatter_FormatBreakpoints(t *testing.T) {
	var buf bytes.Buffer
	f := NewTextFormatter(false)
	f.SetWriter(&buf)

	breakpoints := []*types.BreakpointInfo{
		{ID: "1", Location: "com.example.Main:10", Enabled: true, HitCount: 5},
		{ID: "2", Location: "com.example.Worker:25", Enabled: false, Condition: "x > 10"},
	}

	err := f.FormatBreakpoints(breakpoints)
	if err != nil {
		t.Errorf("FormatBreakpoints failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Output should not be null")
	}
}

func TestTextFormatter_FormatEvent(t *testing.T) {
	var buf bytes.Buffer
	f := NewTextFormatter(false)
	f.SetWriter(&buf)

	event := &types.DebugEvent{
		Type:      "breakpoint",
		ThreadID:  "1",
		Location:  "com.example.Main:10",
		Timestamp: time.Now(),
		Data:      map[string]interface{}{"reason": "user breakpoint"},
	}

	err := f.FormatEvent(event)
	if err != nil {
		t.Errorf("FormatEvent failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Output should not be null")
	}
}

func TestJSONFormatter_FormatVersion(t *testing.T) {
	var buf bytes.Buffer
	f := NewJSONFormatter()
	f.SetWriter(&buf)

	info := &types.VersionInfo{
		ProtocolVersion: "1.8",
		RuntimeVersion:  "17.0.8",
		RuntimeName:     "OpenJDK",
	}

	err := f.FormatVersion(info)
	if err != nil {
		t.Errorf("FormatVersion failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Output should not be null")
	}
}