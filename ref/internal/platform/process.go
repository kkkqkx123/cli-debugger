package platform

import (
	"fmt"
	"net"
	"os/exec"
	"strconv"
	"strings"
)

// ProcessInfo contains information about a running process
type ProcessInfo struct {
	PID  int    `json:"pid"`
	Name string `json:"name"`
}

// ProcessDiscoverer interface for discovering running processes
type ProcessDiscoverer interface {
	FindProcesses() ([]ProcessInfo, error)
	FindProcessByPort(port int) (*ProcessInfo, error)
	FindProcessByName(name string) ([]ProcessInfo, error)
}

// runCommand executes a command and returns stdout
func runCommand(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("command %s %v failed: %w", name, args, err)
	}
	return string(output), nil
}

// checkPort checks if a port is in use
func checkPort(port int) bool {
	conn, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// containsCaseInsensitive checks if a string contains a substring case-insensitively
func containsCaseInsensitive(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// parsePID parses a PID from a string
func parsePID(s string) int {
	pid, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return 0
	}
	return pid
}
